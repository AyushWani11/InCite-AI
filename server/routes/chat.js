const express = require('express');
const fs = require('fs').promises;
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const authLogin = require('../middleware/authToken');
const mongoose = require('mongoose');
const ChatHistory = require('../models/chatlog.js');
const { searchRelevantChunks } = require('../utils/vectorStore');
require('dotenv').config();

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
const generationConfig = {
	temperature: 0.3,
	topP: 0.95,
	topK: 64,
	maxOutputTokens: 8192,
	responseMimeType: 'text/plain',
};

router.post('/', authLogin, upload.single('file'), async (req, res) => {
	const userQuestion = req.body.question;
	let chatHistory = req.body.history || '[]';
	let fileContent = '';
	let paperId = req.body.paperId;
	console.log('paperId:', req.body);

	if (paperId && typeof paperId === 'object') {
		// Handle case where paperId is an object with null prototype
		if (Array.isArray(paperId)) {
			paperId = paperId[0]; // Take first value if array
		} else {
			// Convert object to string or extract value
			paperId = Object.values(paperId)[0] || null;
		}
	}

	// Ensure paperId is a string or null
	paperId = paperId ? String(paperId).trim() : null;

	console.log('Processed paperId:', paperId, typeof paperId);

	// If paperId is provided but no file, fetch from GridFS

	// Parse and validate chatHistory
	try {
		if (typeof chatHistory === 'string') {
			chatHistory = JSON.parse(chatHistory);
		}

		if (!Array.isArray(chatHistory)) {
			chatHistory = [];
		}
	} catch (parseError) {
		console.error('Error parsing chat history:', parseError);
		chatHistory = [];
	}

	// Validate and fix chat history for Gemini API requirements
	const validateAndFixHistory = (history) => {
		if (!history || history.length === 0) return [];

		const fixedHistory = [];

		for (let i = 0; i < history.length; i++) {
			const message = history[i];

			// Convert role names to match Gemini expectations
			let role = message.role;
			if (role === 'assistant') role = 'model';
			if (role !== 'user' && role !== 'model') continue;

			// Ensure first message is always from user
			if (fixedHistory.length === 0 && role !== 'user') {
				continue; // Skip non-user first messages
			}

			// Ensure alternating pattern
			const lastRole =
				fixedHistory.length > 0
					? fixedHistory[fixedHistory.length - 1].role
					: null;
			if (lastRole === role) {
				continue; // Skip consecutive messages from same role
			}

			fixedHistory.push({
				role: role,
				parts: [{ text: message.text || '' }],
			});
		}

		return fixedHistory;
	};

	const validatedHistory = validateAndFixHistory(chatHistory);

	if (!userQuestion || userQuestion.trim().length < 5) {
		return res.status(400).json({ error: 'Question too short or missing' });
	}

	try {
		// File processing remains the same...
		if (req.file) {
			if (req.file.mimetype === 'application/pdf') {
				const buffer = await fs.readFile(req.file.path);
				const parsed = await pdfParse(buffer);
				fileContent = parsed.text;
			} else {
				fileContent = await fs.readFile(req.file.path, 'utf-8');
			}
			await fs.unlink(req.file.path);
		}

		if (paperId && !req.file) {
			try {
				const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
					bucketName: 'papers',
				});

				const chunks = [];
				const stream = bucket.openDownloadStreamByName(paperId);

				for await (const chunk of stream) {
					chunks.push(chunk);
				}

				const buffer = Buffer.concat(chunks);
				const parsed = await pdfParse(buffer);
				fileContent = parsed.text;

				console.log('Successfully loaded paper from GridFS');
			} catch (gridError) {
				console.warn(
					'Could not fetch paper from GridFS, using vector search:',
					gridError
				);
			}
		}

		let context = '';
		let sourceLabel = 'uploaded file';

		if (!fileContent) {
			const { Paper } = require('../models/paper');

			let inferredPaperId = paperId;

			if (!paperId) {
				const userPapers = await Paper.find({ uploadedBy: req.user.id }).select(
					'title _id'
				);

				const titleList = userPapers
					.map((p, idx) => `${idx + 1}. ${p.title}`)
					.join('\n');

				const disambiguationPrompt = `
You are an intelligent research assistant. Based on the user's question, choose the most relevant paper from the list.

User Question: "${userQuestion}"

Paper Titles:
${titleList}

Return ONLY the index of the most relevant paper.
`;

				const result = await model.generateContent(disambiguationPrompt);
				const answerText = result.response.text().trim();

				const selectedIndex =
					parseInt(answerText.match(/\d+/)?.[0] || '-1', 10) - 1;

				if (selectedIndex >= 0 && selectedIndex < userPapers.length) {
					inferredPaperId = userPapers[selectedIndex]._id.toString();
					console.log('📘 Inferred paper:', userPapers[selectedIndex].title);
				} else {
					console.warn(
						'⚠️ Could not confidently infer paper, falling back to all chunks.'
					);
				}
			}

			const topChunks = await searchRelevantChunks(
				userQuestion,
				4,
				inferredPaperId,
				req.user.id
			);
			if (!topChunks.length) {
				return res
					.status(404)
					.json({ error: 'No relevant paper content found.' });
			}
			context = topChunks
				.map((c, i) => `Chunk ${i + 1} (from "${c.meta.title}"):\n${c.text}`)
				.join('\n\n');
			sourceLabel = inferredPaperId
				? topChunks[0].meta.title
				: 'best-matched paper';
		} else {
			context = fileContent;
		}

		// Use validated history instead of raw chatHistory
		const promptHistory = [
			...validatedHistory,
			{
				role: 'user',
				parts: [
					{
						text: `Based on the following content from "${sourceLabel}", answer the user's question.

If the information comes from this paper, mention the paper title in your answer. Answer the question in detail from the paper.

User Question:
${userQuestion}

Paper Content:
${context}`,
					},
				],
			},
		];

		const chatSession = model.startChat({
			generationConfig,
			history: promptHistory,
		});

		const result = await chatSession.sendMessageStream(userQuestion);

		res.setHeader('Content-Type', 'text/plain');
		res.setHeader('Transfer-Encoding', 'chunked');

		for await (const chunk of result.stream) {
			res.write(chunk.text());
		}
		res.end();
	} catch (error) {
		console.error('Chat error:', error);
		res.status(500).json({ error: 'AI generation failed.' });
	}
});

router.post('/save-history', authLogin, async (req, res) => {
	const { history } = req.body;
	if (!history || !Array.isArray(history)) {
		return res.status(400).json({ error: 'Invalid chat history' });
	}

	try {
		const chatSessionId = Date.now().toString();
		await new ChatHistory({
			userId: req.user.id,
			chatSessionId,
			history,
		}).save();
		res.status(200).json({ msg: 'Chat history saved successfully' });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Failed to save chat history' });
	}
});

router.get('/history', authLogin, async (req, res) => {
	try {
		const sessions = await ChatHistory.find({ userId: req.user.id })
			.sort({ createdAt: -1 })
			.select('chatSessionId createdAt')
			.limit(20);
		res.status(200).json({ chatHistory: sessions });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Could not retrieve history' });
	}
});

router.get('/history/:sessionId', authLogin, async (req, res) => {
	try {
		const session = await ChatHistory.findOne({
			userId: req.user.id,
			chatSessionId: req.params.sessionId,
		});
		if (!session) return res.status(404).json({ error: 'Session not found' });
		res.status(200).json({ history: session.history });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Could not retrieve session' });
	}
});

module.exports = router;
