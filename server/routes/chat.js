const express = require('express');
const crypto = require('crypto');
const fs = require('fs').promises;
const multer = require('multer');
const { parsePdf } = require('../utils/pdf');
const { streamText } = require('../utils/llm');
const authLogin = require('../middleware/authToken');
const ChatHistory = require('../models/chatlog.js');
const mongoose = require('mongoose');
const Paper = require('../models/paper');
const { searchRelevantChunks } = require('../utils/vectorStore');
const { findOwnedPaper, readPaperFile } = require('../utils/papers');
const { choosePaper } = require('../utils/paperSelection');
const { parseSaveRequest, toStored, fromStored, HistoryError } = require('../utils/chatHistory');
require('dotenv').config();

// A selected paper up to this many characters (~25k tokens) is given to the
// model in full; longer ones are searched for the most relevant chunks.
function fullTextMaxChars() {
	return Number(process.env.CHAT_FULL_TEXT_MAX_CHARS) || 100000;
}
// How many chunks (excerpts of at most 400 characters) an answer gets.
// Default 8: measured on real papers, the top 4 covered narrow factual
// questions, but for "explain" / "walk me through" questions ranks 5-8 still
// held relevant passages; 4 more excerpts cost only ~400 tokens.
const DEFAULT_TOP_K = 8;
function chunksPerAnswer() {
	const k = Number.parseInt(process.env.RETRIEVAL_TOP_K, 10);
	return k >= 1 && k <= 20 ? k : DEFAULT_TOP_K;
}
// Without a selected paper, this many chunks are compared to pick the paper.
const CANDIDATE_CHUNKS = 20;

const NOT_FOUND_REPLY =
	"I couldn't find anything about that in your papers. Try selecting a paper, " +
	'or rephrase your question.';

const formatChunks = (chunks) =>
	chunks.map((c, i) => `Excerpt ${i + 1}:\n${c.text}`).join('\n\n');

// A source entry for an answer built from some of a paper's chunks:
// which paper, and which chunks (by position in the paper), in order.
const excerptSource = (paperId, title, chunks) => ({
	paperId: String(paperId),
	title,
	scope: 'excerpts',
	excerpts: [...new Set(chunks.map((c) => c.meta.chunkIndex))].sort((a, b) => a - b),
});

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
		// What the answer is based on, sent to the client in X-Sources.
		let sources = [];

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
			sources = [{ title: req.file.originalname, scope: 'attached file' }];
		} else if (paperId) {
			// 2. A selected paper, identified by its _id and checked for ownership.
			const paper = await findOwnedPaper(paperId, req.user.id);
			if (!paper) return res.status(404).json({ error: 'Paper not found.' });
			sourceLabel = paper.title;

			const pdf = await readPaperFile(paper);
			const text = pdf ? (await parsePdf(pdf)).text : '';
			const id = String(paper._id);
			if (text && text.length <= fullTextMaxChars()) {
				// Short enough: the model reads the whole paper.
				context = text;
				sources = [{ paperId: id, title: paper.title, scope: 'full text' }];
			} else {
				// Too long: only its chunks most relevant to the question.
				const chunks = await searchRelevantChunks(userQuestion, chunksPerAnswer(), paper._id, req.user.id);
				if (chunks.length) {
					context = formatChunks(chunks);
					sources = [excerptSource(id, paper.title, chunks)];
				} else {
					context = text.slice(0, fullTextMaxChars());
					sources = [{ paperId: id, title: paper.title, scope: 'beginning of the paper' }];
				}
			}
		} else {
			// 3. No paper selected: find the paper the question is about.
			if (!(await Paper.exists({ uploadedBy: req.user.id }))) {
				return res.status(400).json({
					error: 'You have no papers uploaded. Please upload or select a paper first.',
				});
			}
			const found = await searchRelevantChunks(userQuestion, CANDIDATE_CHUNKS, null, req.user.id);
			// Ignore chunks of papers that no longer exist (e.g. left over from
			// a failed upload whose clean-up could not reach Pinecone).
			const ids = [...new Set(found.map((m) => m.meta.paperId))].filter((id) =>
				mongoose.isObjectIdOrHexString(id)
			);
			const existing = new Set(
				(await Paper.find({ _id: { $in: ids }, uploadedBy: req.user.id }).select('_id')).map((p) =>
					String(p._id)
				)
			);
			const matches = found.filter((m) => existing.has(m.meta.paperId));
			const { paper, best } = choosePaper(matches);
			if (!paper) {
				// Nothing relevant enough: say so rather than let the model guess.
				console.log(`No paper matched the question (best chunk score: ${best ?? 'none'})`);
				res.setHeader('Content-Type', 'text/plain');
				return res.send(NOT_FOUND_REPLY);
			}
			console.log(`Chose "${paper.title}" (top-3 average ${paper.score.toFixed(3)}, best chunk ${best.toFixed(3)})`);
			sourceLabel = paper.title;
			// The chosen paper's best chunks among the candidates; if other
			// papers took too many candidate slots, search within it for more.
			const k = chunksPerAnswer();
			const chunks =
				paper.chunks.length >= k
					? paper.chunks.slice(0, k)
					: await searchRelevantChunks(userQuestion, k, paper.paperId, req.user.id);
			context = formatChunks(chunks);
			sources = [excerptSource(paper.paperId, paper.title, chunks)];
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
		// The answer is streamed as plain text, so its sources travel in a
		// header, sent before the first word. Header values must be ASCII, so
		// the JSON is URL-encoded (titles can contain any character).
		res.setHeader('X-Sources', encodeURIComponent(JSON.stringify(sources)));

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

// Saves a conversation. With a sessionId (chosen by the client, one per open
// chat) saving again replaces that conversation instead of adding a copy;
// without one, a new session is created. Either way the session belongs to
// the logged-in user: the lookup always includes their id.
router.post('/save-history', authLogin, async (req, res) => {
	let parsed;
	try {
		parsed = parseSaveRequest(req.body);
	} catch (err) {
		if (err instanceof HistoryError) return res.status(400).json({ error: err.message });
		// Express 4 doesn't catch errors thrown by async handlers; answer here.
		console.error('Checking chat history to save failed:', err);
		return res.status(500).json({ error: 'Failed to save chat history' });
	}

	const chatSessionId = parsed.sessionId || crypto.randomUUID();
	try {
		const result = await ChatHistory.findOneAndUpdate(
			{ userId: req.user.id, chatSessionId },
			{ $set: { history: toStored(parsed.messages) } },
			{ upsert: true, runValidators: true, includeResultMetadata: true }
		);
		const created = !result.lastErrorObject?.updatedExisting;
		res.status(created ? 201 : 200).json({ msg: 'Chat history saved', sessionId: chatSessionId });
	} catch (err) {
		console.error('Saving chat history failed:', err);
		res.status(500).json({ error: 'Failed to save chat history' });
	}
});

router.get('/history', authLogin, async (req, res) => {
	try {
		const sessions = await ChatHistory.find({ userId: req.user.id })
			.sort({ updatedAt: -1, createdAt: -1 })
			.select('chatSessionId createdAt updatedAt')
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
		// Same { role, text } shape the client saved.
		res.status(200).json({ history: fromStored(session.history) });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Could not retrieve session' });
	}
});

module.exports = router;
