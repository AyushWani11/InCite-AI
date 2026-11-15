const express = require('express');
const multer = require('multer');
const { parsePdf } = require('../utils/pdf');
const mongoose = require('mongoose');
const { Readable } = require('stream');
const { generateStructured, StructuredOutputError } = require('../utils/structured');
const { generateFromFullPaper } = require('../utils/fullPaper');
const {
	buildMetadataPrompt,
	summaryPrompts,
	assessmentPrompts,
} = require('../utils/prompts');
const {
	SUMMARY_SCHEMA,
	ASSESSMENT_SCHEMA,
	METADATA_SCHEMA,
} = require('../utils/schemas');
const authLogin = require('../middleware/authToken');
const Paper = require('../models/paper');
const {
	findOwnedPaper,
	findPaperFile,
	openFileStream,
	readPaperFile,
	deletePaperFile,
} = require('../utils/papers');
const {
	addPaperChunks,
	deleteVectorsByUser,
	deleteVectorsByPaper,
} = require('../utils/vectorStore');

require('dotenv').config();

const router = express.Router();
const upload = multer({
	storage: multer.memoryStorage(),
	// Browsers send filenames as UTF-8; multer 2 assumes latin1 by default,
	// which garbles names like "résumé.pdf".
	defParamCharset: 'utf8',
});

// The paper's text, or null after answering 422 if the PDF has none
// (e.g. a scanned image without a text layer).
function textOrReject(res, text) {
	if (text && text.trim()) return text;
	res.status(422).json({
		error: 'This PDF has no extractable text (it may be a scanned image), so it cannot be analysed.',
	});
	return null;
}

// A reply from Gemini we could not use even after one retry: answer 502
// ("bad gateway": the upstream service misbehaved) with a helpful message.
function sendUnusableAiReply(res, what, err) {
	return res.status(502).json({
		error: `The AI returned a ${what} we could not use, even after retrying. Please try again in a moment.`,
		details: err.problem,
	});
}

// Helper
function isValidDate(date) {
	if (!date) return false;
	const d = new Date(date);
	return !isNaN(d.getTime());
}

// Upload papers
router.post(
	'/upload',
	authLogin,
	upload.array('files', 10),
	async (req, res) => {
		const files = req.files;
		const userId = req.user.id;

		if (!files?.length)
			return res.status(400).json({ error: 'No files uploaded' });

		const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
			bucketName: 'papers',
		});
		const savedPapers = [];

		for (const file of files) {
			try {
				const parsed = await parsePdf(file.buffer);
				const text = parsed.text;

				const metadata = parsed.info || {};

				// Authors and keywords from Gemini. Optional: if this fails, the
				// upload still succeeds using the PDF's own metadata below.
				let mlData = { authors: [], keywords: [] };
				try {
					mlData = await generateStructured({
						prompt: buildMetadataPrompt(text),
						schema: METADATA_SCHEMA,
						label: 'authors/keywords',
					});
				} catch (err) {
					console.warn('Author/keyword extraction failed, using PDF metadata:', err.message);
				}

				const authors =
					Array.isArray(mlData.authors) && mlData.authors.length
						? mlData.authors
						: metadata.Author
						? [metadata.Author]
						: [];

				const keywords =
					Array.isArray(mlData.keywords) && mlData.keywords.length
						? mlData.keywords
						: metadata.Keywords
						? metadata.Keywords.split(',').map((k) => k.trim())
						: [];

				const readStream = new Readable();
				readStream.push(file.buffer);
				readStream.push(null);

				await new Promise((resolve, reject) => {
					const uploadStream = bucket.openUploadStream(file.originalname, {
						contentType: file.mimetype,
						metadata: { uploadedBy: userId },
					});

					readStream
						.pipe(uploadStream)
						.on('error', reject)
						.on('finish', async () => {
							const paper = new Paper({
								title: metadata.Title || file.originalname,
								authors,
								publicationDate: isValidDate(metadata.CreationDate)
									? new Date(metadata.CreationDate)
									: null,
								keywords,
								filename: uploadStream.filename,
								fileId: uploadStream.id,
								uploadedBy: userId,
							});
							await paper.save();

							await addPaperChunks(
								paper._id.toString(),
								userId,
								paper.title,
								text
							);

							savedPapers.push(paper);

							resolve();
						});
				});
			} catch (err) {
				console.error(`Upload failed for file ${file.originalname}:`, err);
			}
		}

		res.status(201).json({ msg: 'Upload complete', papers: savedPapers });
	}
);

// Search papers
router.get('/search', authLogin, async (req, res) => {
	const { title, author, keyword, fromDate, toDate } = req.query;
	// Always limited to the caller's own papers.
	const query = { uploadedBy: req.user.id };

	if (title) query.title = { $regex: title, $options: 'i' };
	if (author) query.authors = { $elemMatch: { $regex: author, $options: 'i' } };
	if (keyword) query.keywords = { $in: [new RegExp(keyword, 'i')] };
	if (fromDate || toDate) {
		query.publicationDate = {};
		if (fromDate) query.publicationDate.$gte = new Date(fromDate);
		if (toDate) query.publicationDate.$lte = new Date(toDate);
	}

	try {
		const papers = await Paper.find(query).sort({ createdAt: -1 });
		res.status(200).json(papers);
	} catch (err) {
		console.error('Search error:', err);
		res.status(500).json({ error: 'Search failed' });
	}
});

// Download (or view inline) one of your own papers, by paper id.
router.get('/download/:paperId', authLogin, async (req, res) => {
	try {
		const paper = await findOwnedPaper(req.params.paperId, req.user.id);
		const file = paper && (await findPaperFile(paper));
		if (!file) return res.status(404).json({ error: 'File not found' });

		res.set('Content-Type', 'application/pdf');
		res.set('Content-Disposition', 'inline');
		res.set('Content-Length', String(file.length));

		// Listen for errors on the file stream itself. An unhandled stream
		// error is an uncaught exception, which would stop the whole server.
		openFileStream(file)
			.on('error', (err) => {
				console.error('Download stream failed:', err);
				if (!res.headersSent) res.status(500).json({ error: 'Download failed' });
				else res.destroy(err);
			})
			.pipe(res);
	} catch (err) {
		console.error('Download failed:', err);
		if (!res.headersSent) res.status(500).json({ error: 'Download failed' });
	}
});

router.post('/summarize/:paperId', authLogin, async (req, res) => {
	try {
		const paper = await findOwnedPaper(req.params.paperId, req.user.id);
		if (!paper) return res.status(404).json({ error: 'Paper not found' });

		const pdfBuffer = await readPaperFile(paper);
		if (!pdfBuffer) {
			return res.status(404).json({ error: 'Paper file not found' });
		}

		const fullText = textOrReject(res, (await parsePdf(pdfBuffer)).text);
		if (fullText === null) return;

		// Only a reply that passes the schema check is saved.
		const summary = await generateFromFullPaper({
			text: fullText,
			schema: SUMMARY_SCHEMA,
			label: 'summary',
			prompts: summaryPrompts,
		});
		paper.summary = summary;
		await paper.save();

		res.status(200).json({
			msg: 'Summary generated and saved',
			summary,
		});
	} catch (err) {
		if (err instanceof StructuredOutputError) return sendUnusableAiReply(res, 'summary', err);
		console.error('Summarization failed:', err);
		res.status(500).json({ error: 'Summarization failed' });
	}
});

router.get('/summary/:paperId', authLogin, async (req, res) => {
	try {
		const paper = await findOwnedPaper(req.params.paperId, req.user.id);
		if (!paper?.summary)
			return res.status(404).json({ error: 'Summary not found' });
		res.status(200).json({ summary: paper.summary });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Failed to retrieve summary' });
	}
});

router.delete('/delete-all', authLogin, async (req, res) => {
	try {
		const userId = req.user.id;

		const papers = await Paper.find({ uploadedBy: userId });

		// Searchable chunks first: if this fails, nothing else has been
		// deleted yet and the user can simply retry.
		await deleteVectorsByUser(userId);

		// Delete each paper's own stored file (never by filename alone, which
		// other users may share).
		for (const paper of papers) {
			await deletePaperFile(paper);
		}

		await Paper.deleteMany({ uploadedBy: userId });

		res.status(200).json({ msg: 'All your papers have been deleted' });
	} catch (err) {
		console.error('Delete all error:', err);
		res.status(500).json({ error: 'Failed to delete all papers' });
	}
});

router.delete('/delete/:id', authLogin, async (req, res) => {
	try {
		const paper = await findOwnedPaper(req.params.id, req.user.id);
		if (!paper) return res.status(404).json({ error: 'Paper not found' });

		// Searchable chunks first: if this fails, the paper is untouched and
		// the user can retry, instead of a "deleted" paper that chat can
		// still quote.
		await deleteVectorsByPaper(paper._id, paper.uploadedBy);
		await deletePaperFile(paper);
		await paper.deleteOne();

		res.status(200).json({ msg: 'Paper deleted' });
	} catch (err) {
		console.error('Delete route failed:', err);
		res.status(500).json({ error: 'Deletion failed' });
	}
});

router.post('/assess/:paperId', authLogin, async (req, res) => {
	try {
		const paper = await findOwnedPaper(req.params.paperId, req.user.id);
		if (!paper) return res.status(404).json({ error: 'Paper not found' });

		const pdfBuffer = await readPaperFile(paper);
		if (!pdfBuffer) {
			return res.status(404).json({ error: 'Paper file not found' });
		}

		const text = textOrReject(res, (await parsePdf(pdfBuffer)).text);
		if (text === null) return;

		// Only a reply that passes the schema check is saved (the client
		// crashes on an assessment without e.g. score.overallScore).
		const assessment = await generateFromFullPaper({
			text,
			schema: ASSESSMENT_SCHEMA,
			label: 'assessment',
			prompts: assessmentPrompts,
		});
		paper.assessment = assessment;
		await paper.save();

		res.status(200).json({ assessment });
	} catch (err) {
		if (err instanceof StructuredOutputError) return sendUnusableAiReply(res, 'assessment', err);
		console.error('Assessment error:', err);
		res.status(500).json({ error: 'Assessment failed' });
	}
});

router.get('/assessment/:paperId', authLogin, async (req, res) => {
	try {
		const paper = await findOwnedPaper(req.params.paperId, req.user.id);
		if (!paper?.assessment)
			return res.status(404).json({ error: 'Assessment not found' });
		res.status(200).json({ assessment: paper.assessment });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Failed to retrieve assessment' });
	}
});

// Get papers uploaded by current user
router.get('/user-papers', authLogin, async (req, res) => {
	try {
		const userId = req.user.id;

		// Find all papers uploaded by the current user
		const papers = await Paper.find({ uploadedBy: userId })
			.sort({ createdAt: -1 }) // Sort by newest first
			.select(
				'title authors filename createdAt publicationDate keywords summary assessment'
			); // Select only needed fields

		res.status(200).json(papers);
	} catch (err) {
		console.error('Error fetching user papers:', err);
		res.status(500).json({ error: 'Failed to fetch your papers' });
	}
});

module.exports = router;
