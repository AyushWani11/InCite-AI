const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mongoose = require('mongoose');
const { Readable } = require('stream');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const authLogin = require('../middleware/authToken');
const Paper = require('../models/paper');
const { addPaperChunks } = require('../utils/vectorStore');

require('dotenv').config();

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// 📌 Helper
function isValidDate(date) {
	if (!date) return false;
	const d = new Date(date);
	return !isNaN(d.getTime());
}

// 📥 Upload papers
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
				const parsed = await pdfParse(file.buffer);
				const text = parsed.text;

				const metadata = parsed.info || {};

				// ✨ ML extraction
				let mlData = { authors: [], keywords: [] };
				try {
					let prompt = `
You are an academic assistant. From the following research paper text, extract:
1. A list of author names.
2. A list of 5–10 keywords summarizing the paper.

Respond ONLY in JSON format:
{
  "authors": [...],
  "keywords": [...]
}

Text:
${text.substring(0, 6000)}
				`;

					const result = await model.generateContent(prompt);
					let jsonText = result.response.text().trim();
					if (jsonText.startsWith('```'))
						jsonText = jsonText.replace(/```json|```/g, '').trim();
					mlData = JSON.parse(jsonText);
				} catch (err) {
					console.warn('Gemini ML extraction failed:', err);
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
								uploadedBy: userId,
							});
							await paper.save();

							// ✅ Embed paper into Chroma
							await addPaperChunks(paper._id.toString(), paper.title, text);

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

// 🔍 Search papers
router.get('/search', authLogin, async (req, res) => {
	const { title, author, keyword, fromDate, toDate, uploadedBy } = req.query;
	const query = {};

	if (title) query.title = { $regex: title, $options: 'i' };
	if (author) query.authors = { $elemMatch: { $regex: author, $options: 'i' } };
	if (keyword) query.keywords = { $in: [new RegExp(keyword, 'i')] };
	if (fromDate || toDate) {
		query.publicationDate = {};
		if (fromDate) query.publicationDate.$gte = new Date(fromDate);
		if (toDate) query.publicationDate.$lte = new Date(toDate);
	}
	if (uploadedBy) query.uploadedBy = uploadedBy;

	try {
		const papers = await Paper.find(query).sort({ createdAt: -1 });
		res.status(200).json(papers);
	} catch (err) {
		console.error('Search error:', err);
		res.status(500).json({ error: 'Search failed' });
	}
});

// 📥 Download paper
router.get('/download/:filename', async (req, res) => {
	try {
		const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
			bucketName: 'papers',
		});
		const stream = bucket.openDownloadStreamByName(req.params.filename);
		res.set('Content-Type', 'application/pdf');
		res.set('Content-Disposition', 'inline');
		stream
			.pipe(res)
			.on('error', () => res.status(404).json({ error: 'File not found' }));
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Download failed' });
	}
});

const buildSummaryPrompt = (text) => `
You are an expert academic summarizer. Given a research paper, generate a structured JSON summary that captures both depth and clarity.

Return exactly this JSON format:
{
  "summary": "Concise, well-written abstract of the paper.",
  "contributions": ["Each point must describe a novel or impactful contribution clearly."],
  "methodology": "Explain in detail the techniques, models, or frameworks used. Include dataset, architecture, or mathematical tools if relevant.",
  "findings": "List the concrete results. Include comparisons, metrics, or evidence supporting the claims.",
  "conclusion": "Summarize the takeaway of the paper and what future work it enables."
}

Text:
${text.substring(0, 7000)}
`;

router.post('/summarize/:paperId', authLogin, async (req, res) => {
	try {
		const paper = await Paper.findById(req.params.paperId);
		if (!paper) return res.status(404).json({ error: 'Paper not found' });

		const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
			bucketName: 'papers',
		});
		const chunks = [];

		await new Promise((resolve, reject) => {
			bucket
				.openDownloadStreamByName(paper.filename)
				.on('data', (chunk) => chunks.push(chunk))
				.on('end', resolve)
				.on('error', reject);
		});

		const fullText = (await pdfParse(Buffer.concat(chunks))).text;
		const prompt = buildSummaryPrompt(fullText);

		const result = await model.generateContent(prompt);
		let jsonText = result.response.text().trim();

		// remove markdown code fences
		if (jsonText.startsWith('```')) {
			jsonText = jsonText.replace(/```json|```/g, '').trim();
		}

		const summary = JSON.parse(jsonText);
		paper.summary = summary;
		await paper.save();

		res.status(200).json({
			msg: 'Summary generated and saved',
			summary,
		});
	} catch (err) {
		console.error('Summarization failed:', err);
		res.status(500).json({ error: 'Summarization failed' });
	}
});

router.get('/summary/:paperId', authLogin, async (req, res) => {
	try {
		const paper = await Paper.findById(req.params.paperId);
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

		// Optionally only delete user-uploaded papers:
		const papers = await Paper.find({ uploadedBy: userId });

		const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
			bucketName: 'papers',
		});

		// Delete all files in GridFS by matching filenames
		for (const paper of papers) {
			const files = await mongoose.connection.db
				.collection('papers.files')
				.find({ filename: paper.filename })
				.toArray();

			for (const file of files) {
				await bucket.delete(file._id);
			}
		}

		// Delete from MongoDB collection
		await Paper.deleteMany({ uploadedBy: userId });

		res.status(200).json({ msg: 'All your papers have been deleted' });
	} catch (err) {
		console.error('Delete all error:', err);
		res.status(500).json({ error: 'Failed to delete all papers' });
	}
});

// 🗑️ Delete paper
router.delete('/delete/:id', authLogin, async (req, res) => {
	try {
		const paper = await Paper.findById(req.params.id);
		if (!paper) return res.status(404).json({ error: 'Paper not found' });

		const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
			bucketName: 'papers',
		});
		const files = await mongoose.connection.db
			.collection('papers.files')
			.find({ filename: paper.filename })
			.toArray();

		for (const file of files) await bucket.delete(file._id);
		await Paper.findByIdAndDelete(req.params.id);

		res.status(200).json({ msg: 'Paper deleted' });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Deletion failed' });
	}
});

router.post('/assess/:paperId', authLogin, async (req, res) => {
	try {
		const paper = await Paper.findById(req.params.paperId);
		if (!paper) return res.status(404).json({ error: 'Paper not found' });

		const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
			bucketName: 'papers',
		});

		const chunks = [];
		await new Promise((resolve, reject) => {
			bucket
				.openDownloadStreamByName(paper.filename)
				.on('data', (chunk) => chunks.push(chunk))
				.on('end', resolve)
				.on('error', reject);
		});

		const text = (await pdfParse(Buffer.concat(chunks))).text;

		const prompt = `
You are an academic reasearch paper reviewer who focuses more on content. assume none of the figures are missing.

Analyze the following research paper and return a JSON object with the following structure:

{
  "score": {
    "writingQuality": "Excellent | Good | Average | Poor",
    "methodology": "Excellent | Good | Average | Poor",
    "academicStandards": "Excellent | Good | Average | Poor",
    "overallScore": 0 // integer from 0 to 100
  },
  "feedback": {
    "writing": "Comments on clarity, grammar, organization, tone.",
    "methodology": "Comments on methods, experiments, limitations.",
    "standards": "Comments on formatting, citations, references, compliance."
  },
  "improvementSuggestions": [
    "Specific, actionable recommendation 1",
    "Specific, actionable recommendation 2"
  ],
  "issues": [
    "Flag citation gaps, statistical problems, etc."
  ]
  "X-Factor": "Unique insights, creativity, or impact of the research." 
}

Be sure the overallScore is between 0 and 100 and reflects a fair average based on the 3 category scores.

Text:
${text.substring(0, 10000)}
`;

		const result = await model.generateContent(prompt);
		let responseText = result.response.text().trim();

		if (responseText.startsWith('```')) {
			responseText = responseText.replace(/```json|```/g, '').trim();
		}

		let assessment;
		try {
			assessment = JSON.parse(responseText);
			paper.assessment = assessment;
			await paper.save();
		} catch (e) {
			console.warn('Gemini returned malformed JSON:', responseText);
			return res.status(500).json({ error: 'Failed to parse Gemini response' });
		}

		res.status(200).json({ assessment });
	} catch (err) {
		console.error('Assessment error:', err);
		res.status(500).json({ error: 'Assessment failed' });
	}
});

router.get('/assessment/:paperId', authLogin, async (req, res) => {
	try {
		const paper = await Paper.findById(req.params.paperId);
		if (!paper?.assessment)
			return res.status(404).json({ error: 'Assessment not found' });
		res.status(200).json({ assessment: paper.assessment });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Failed to retrieve assessment' });
	}
});

module.exports = router;
