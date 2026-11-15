const { Pinecone } = require('@pinecone-database/pinecone');
const { splitIntoChunks } = require('./chunking');
const { mapWithLimit, withRetry } = require('./async');
require('dotenv').config();

// Embeddings are made by Pinecone itself. The index uses "integrated
// embedding" (llama-text-embed-v2): we send plain text and Pinecone turns it
// into vectors, both when storing chunks and when searching. The record field
// it embeds is set by the index's field map; for our index that is "text".
// Switching embedding model means a new index (see scripts/reindex.js).
const TEXT_FIELD = 'text';
const UPSERT_BATCH_SIZE = 96; // most records Pinecone embeds per request
const UPSERT_PARALLEL = 2; // batches in flight at once (gentle on rate limits)
const RETURN_FIELDS = [TEXT_FIELD, 'paperId', 'title', 'chunkIndex'];

const pc = new Pinecone({
	apiKey: process.env.PINECONE_API_KEY,
});

function namespacePrefix() {
	return process.env.PINECONE_NAMESPACE_PREFIX || 'v2';
}

// Every user has their own namespace, "<prefix>-<userId>". A search can only
// ever see the namespace it is given, so one user's chunks can never show up
// in another user's results, even if a filter were forgotten. The prefix
// marks the embedding version: re-indexing for a new model writes to new
// namespaces (e.g. "v3-...") and leaves the old ones untouched.
function namespaceName(userId) {
	if (!userId) throw new Error('userId is required to choose a namespace');
	return `${namespacePrefix()}-${userId}`;
}

function userNamespace(userId) {
	return pc.index(process.env.PINECONE_INDEX_NAME).namespace(namespaceName(userId));
}

// A namespace only exists once something has been stored in it, so a new
// user's namespace may be "not found". For reads and deletes that simply
// means there is nothing there.
function isNotFound(err) {
	return err?.name === 'PineconeNotFoundError';
}

async function addPaperChunks(paperId, userId, title, text) {
	const chunks = splitIntoChunks(text);
	const records = chunks.map((chunk, i) => ({
		// Deterministic ids: indexing the same paper again overwrites its
		// chunks instead of adding duplicates.
		id: `${paperId}#${i}`,
		[TEXT_FIELD]: chunk,
		paperId: String(paperId),
		title: title ? String(title) : '',
		chunkIndex: i,
	}));

	// Batches of at most 96, two in flight at a time, each retried on rate
	// limits and network errors. If one still fails, this throws; the caller
	// is responsible for cleaning up the half-indexed paper.
	const ns = userNamespace(userId);
	const batches = [];
	for (let start = 0; start < records.length; start += UPSERT_BATCH_SIZE) {
		batches.push(records.slice(start, start + UPSERT_BATCH_SIZE));
	}
	await mapWithLimit(batches, UPSERT_PARALLEL, (batch, i) =>
		withRetry(() => ns.upsertRecords(batch), { label: `upsert batch ${i + 1}/${batches.length}` })
	);
	console.log(`${records.length} chunks indexed for paper "${title}"`);
	return records.length;
}

// The topK chunks most similar to `query`, from this user's papers only
// (optionally just one paper).
async function searchRelevantChunks(query, topK = 4, paperId = null, userId) {
	const ns = userNamespace(userId);
	const search = { topK, inputs: { text: query } };
	if (paperId) search.filter = { paperId: { $eq: String(paperId) } };

	let response;
	try {
		response = await ns.searchRecords({ query: search, fields: RETURN_FIELDS });
	} catch (err) {
		if (isNotFound(err)) return [];
		throw err;
	}

	return response.result.hits.map((hit) => ({
		text: hit.fields[TEXT_FIELD],
		meta: hit.fields,
		score: hit._score,
	}));
}

async function deleteVectorsByUser(userId) {
	try {
		await userNamespace(userId).deleteAll();
	} catch (err) {
		if (!isNotFound(err)) throw err;
	}
	console.log(`All vectors deleted for user ${userId}`);
}

// Note: the Pinecone JS SDK takes the metadata filter itself as the argument
// to deleteMany (not wrapped as { filter: ... }, the Python/REST shape).
async function deleteVectorsByPaper(paperId, userId) {
	try {
		await userNamespace(userId).deleteMany({ paperId: { $eq: String(paperId) } });
	} catch (err) {
		if (!isNotFound(err)) throw err;
	}
	console.log(`Vectors deleted for paper ${paperId}`);
}

module.exports = {
	addPaperChunks,
	searchRelevantChunks,
	deleteVectorsByUser,
	deleteVectorsByPaper,
	namespaceName,
	TEXT_FIELD,
};
