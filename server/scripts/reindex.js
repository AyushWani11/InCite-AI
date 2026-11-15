// Re-embeds every stored paper into its owner's Pinecone namespace
// ("<PINECONE_NAMESPACE_PREFIX>-<userId>", e.g. "v2-665f...").
//
// Why this exists: vectors from different embedding models cannot be
// compared, so when the embedding model changes, every paper has to be
// embedded again with the new one. The originals are still in MongoDB/GridFS,
// so this script reads each PDF, splits it into chunks and lets Pinecone embed
// them (the index uses integrated embedding).
//
// It never reads, writes or deletes the old shared "papers" namespace.
// Re-running is safe: each paper's existing chunks in the target namespace
// are replaced, not duplicated.
//
// Usage, from the server/ folder (needs MONGODB_URI, PINECONE_API_KEY and
// PINECONE_INDEX_NAME in server/.env):
//   npm run reindex -- --dry-run   # report what would happen, write nothing
//   npm run reindex                # do it
require('dotenv').config();
const mongoose = require('mongoose');
const { Pinecone } = require('@pinecone-database/pinecone');
const Paper = require('../models/paper');
const { readPaperFile } = require('../utils/papers');
const { parsePdf } = require('../utils/pdf');
const { splitIntoChunks } = require('../utils/chunking');
const {
	addPaperChunks,
	deleteVectorsByPaper,
	namespaceName,
	TEXT_FIELD,
} = require('../utils/vectorStore');

// Refuse to write to an index that cannot embed our text.
async function checkIndex() {
	const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
	const info = await pc.describeIndex(process.env.PINECONE_INDEX_NAME);
	if (!info.embed) {
		throw new Error(
			`Index "${info.name}" has no integrated embedding model. Create one with a ` +
				'hosted model (e.g. llama-text-embed-v2) and field map text -> "text".'
		);
	}
	if (info.embed.fieldMap?.text !== TEXT_FIELD) {
		throw new Error(
			`Index "${info.name}" embeds the field ${JSON.stringify(info.embed.fieldMap)}; ` +
				`the app stores chunk text in "${TEXT_FIELD}".`
		);
	}
	return info;
}

async function reindex({ dryRun = false, log = console.log } = {}) {
	const info = await checkIndex();
	log(`Index "${info.name}": ${info.embed.model}, ${info.dimension} dimensions, ${info.metric}.`);
	log(`Writing to namespaces "${namespaceName('<userId>')}". The old "papers" namespace is not touched.`);
	if (dryRun) log('DRY RUN: nothing will be written.');

	const papers = await Paper.find({}).sort({ createdAt: 1 });
	const summary = { papers: papers.length, indexed: 0, chunks: 0, skipped: [], failed: [] };

	for (const paper of papers) {
		const label = `${paper._id} "${paper.title}"`;
		try {
			if (!paper.uploadedBy) {
				summary.skipped.push({ id: String(paper._id), reason: 'no owner' });
				log(`skip   ${label}: no owner`);
				continue;
			}
			const pdf = await readPaperFile(paper);
			if (!pdf) {
				summary.skipped.push({ id: String(paper._id), reason: 'PDF file missing' });
				log(`skip   ${label}: PDF file missing`);
				continue;
			}
			const { text } = await parsePdf(pdf);
			const userId = String(paper.uploadedBy);

			if (dryRun) {
				const count = splitIntoChunks(text).length;
				summary.indexed++;
				summary.chunks += count;
				log(`would  ${label}: ${count} chunks -> ${namespaceName(userId)}`);
				continue;
			}

			// Clear this paper's chunks from an earlier run first, so a changed
			// chunker cannot leave stale ones behind.
			await deleteVectorsByPaper(paper._id, userId);
			const count = await addPaperChunks(String(paper._id), userId, paper.title, text);
			summary.indexed++;
			summary.chunks += count;
			log(`done   ${label}: ${count} chunks -> ${namespaceName(userId)}`);
		} catch (err) {
			summary.failed.push({ id: String(paper._id), error: err.message });
			log(`FAILED ${label}: ${err.message}`);
		}
	}

	log(
		`\n${dryRun ? 'Would index' : 'Indexed'} ${summary.indexed} of ${summary.papers} papers ` +
			`(${summary.chunks} chunks). Skipped: ${summary.skipped.length}. Failed: ${summary.failed.length}.`
	);
	return summary;
}

async function main() {
	if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in server/.env');
	await mongoose.connect(process.env.MONGODB_URI);
	try {
		const summary = await reindex({ dryRun: process.argv.includes('--dry-run') });
		if (summary.failed.length) process.exitCode = 1;
	} finally {
		await mongoose.disconnect();
	}
}

if (require.main === module) {
	main().catch((err) => {
		console.error('Reindex failed:', err.message);
		process.exit(1);
	});
}

module.exports = { reindex, checkIndex };
