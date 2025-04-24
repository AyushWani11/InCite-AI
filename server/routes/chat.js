const express = require('express');
const fs = require('fs').promises;
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const authLogin = require('../middleware/authToken');
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
	const chatHistory = req.body.history || [];
	let fileContent = '';

	if (!userQuestion || userQuestion.trim().length < 5) {
		return res.status(400).json({ error: 'Question too short or missing' });
	}

	try {
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

		let context = '';
		let sourceLabel = 'uploaded file';

		if (!fileContent) {
			const topChunks = await searchRelevantChunks(userQuestion, 4);
			if (!topChunks.length) {
				return res
					.status(404)
					.json({ error: 'No relevant paper content found.' });
			}
			context = topChunks
				.map((c, i) => `Chunk ${i + 1} (from "${c.meta.title}"):\n${c.text}`)
				.join('\n\n');
			sourceLabel = topChunks[0].meta.title || 'related paper';
		} else {
			context = fileContent;
		}

		const promptHistory = [
			...chatHistory.map((turn) => ({
				role: turn.role,
				parts: [{ text: turn.text }],
			})),
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
