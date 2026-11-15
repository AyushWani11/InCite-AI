const express = require('express');
const fs = require('fs').promises;
const multer = require('multer');
const { parsePdf } = require('../utils/pdf');
const { streamText } = require('../utils/llm');
const authLogin = require('../middleware/authToken');
const ChatHistory = require('../models/chatlog.js');
const Paper = require('../models/paper');
const { searchRelevantChunks } = require('../utils/vectorStore');
const { findOwnedPaper, readPaperFile } = require('../utils/papers');
const { choosePaper } = require('../utils/paperSelection');
require('dotenv').config();

// A selected paper up to this many characters (~25k tokens) is given to the
// model in full; longer ones are searched for the most relevant chunks.
function fullTextMaxChars() {
	return Number(process.env.CHAT_FULL_TEXT_MAX_CHARS) || 100000;
}
const CHUNKS_PER_ANSWER = 4;
// Without a selected paper, this many chunks are compared to pick the paper.
const CANDIDATE_CHUNKS = 20;

const NOT_FOUND_REPLY =
	"I couldn't find anything about that in your papers. Try selecting a paper, " +
	'or rephrase your question.';

const formatChunks = (chunks) =>
	chunks.map((c, i) => `Excerpt ${i + 1}:\n${c.text}`).join('\n\n');

const router = express.Router();
// defParamCharset: browsers send filenames as UTF-8; multer 2 assumes latin1.
const upload = multer({ dest: 'uploads/', defParamCharset: 'utf8' });

const generationConfig = {
	temperature: 0.3,
	topP: 0.95,
	topK: 64,
	maxOutputTokens: 8192,
};

router.post('/', authLogin, upload.single('file'), async (req, res) => {
	const userQuestion = req.body.question;
	let chatHistory = req.body.history || '[]';
	let fileContent = '';
	// The selected paper's MongoDB _id (not its title, which is not unique and
	// may come from the PDF's own metadata rather than the filename).
	let paperId = req.body.paperId;

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
		let context = '';
		let sourceLabel = 'uploaded file';

		if (req.file) {
			// 1. A file attached to this message: answer from it.
			if (req.file.mimetype === 'application/pdf') {
				const buffer = await fs.readFile(req.file.path);
				const parsed = await parsePdf(buffer);
				fileContent = parsed.text;
			} else {
				fileContent = await fs.readFile(req.file.path, 'utf-8');
			}
			await fs.unlink(req.file.path);
			context = fileContent;
		} else if (paperId) {
			// 2. A selected paper, identified by its _id and checked for ownership.
			const paper = await findOwnedPaper(paperId, req.user.id);
			if (!paper) return res.status(404).json({ error: 'Paper not found.' });
			sourceLabel = paper.title;

			const pdf = await readPaperFile(paper);
			const text = pdf ? (await parsePdf(pdf)).text : '';
			if (text && text.length <= fullTextMaxChars()) {
				// Short enough: the model reads the whole paper.
				context = text;
			} else {
				// Too long: only its chunks most relevant to the question.
				const chunks = await searchRelevantChunks(userQuestion, CHUNKS_PER_ANSWER, paper._id, req.user.id);
				context = chunks.length ? formatChunks(chunks) : text.slice(0, fullTextMaxChars());
			}
		} else {
			// 3. No paper selected: find the paper the question is about.
			if (!(await Paper.exists({ uploadedBy: req.user.id }))) {
				return res.status(400).json({
					error: 'You have no papers uploaded. Please upload or select a paper first.',
				});
			}
			const matches = await searchRelevantChunks(userQuestion, CANDIDATE_CHUNKS, null, req.user.id);
			const { paper, best } = choosePaper(matches);
			if (!paper) {
				// Nothing relevant enough: say so rather than let the model guess.
				console.log(`No paper matched the question (best chunk score: ${best ?? 'none'})`);
				res.setHeader('Content-Type', 'text/plain');
				return res.send(NOT_FOUND_REPLY);
			}
			console.log(`Chose "${paper.title}" (top-3 average ${paper.score.toFixed(3)}, best chunk ${best.toFixed(3)})`);
			sourceLabel = paper.title;
			context = formatChunks(paper.chunks.slice(0, CHUNKS_PER_ANSWER));
		}

		if (!context || context.trim().length < 20) {
			return res.status(400).json({
				error:
					'No context available to answer that. Please select or upload a paper.',
			});
		}

		// Earlier turns, then one new user turn that carries the context and
		// the question. Gemini expects user and model turns to alternate, so
		// drop a trailing user turn (e.g. a question whose answer failed).
		while (validatedHistory.at(-1)?.role === 'user') validatedHistory.pop();
		const contents = [
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

		// Throws here (before anything is sent) if Gemini rejects the request.
		const reply = await streamText(contents, generationConfig);

		res.setHeader('Content-Type', 'text/plain');
		res.setHeader('Transfer-Encoding', 'chunked');

		for await (const piece of reply) {
			res.write(piece);
		}
		res.end();
	} catch (error) {
		console.error('Chat error:', error);
		// If part of the answer was already streamed, the status can no longer
		// change; just end the response. (Setting it would throw again.)
		if (res.headersSent) return res.end();
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
