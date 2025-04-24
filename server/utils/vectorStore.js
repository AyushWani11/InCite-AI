const { Pinecone } = require('@pinecone-database/pinecone');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const pc = new Pinecone({
	apiKey: process.env.PINECONE_API_KEY,
});

const indexName = process.env.PINECONE_INDEX_NAME;
const namespaceName = 'papers';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embedder = genAI.getGenerativeModel({ model: 'embedding-001' });

function splitIntoSentences(text, maxChunkSize = 400) {
	const sentences = text.split(/(?<=[.?!])\s+(?=[A-Z])/); // split by sentence
	const chunks = [];

	let current = '';
	for (let sentence of sentences) {
		if ((current + sentence).length > maxChunkSize) {
			if (current) chunks.push(current.trim());
			current = sentence;
		} else {
			current += ' ' + sentence;
		}
	}
	if (current) chunks.push(current.trim());
	return chunks;
}

// 🔹 Embed a string of text using Gemini
async function embedText(text) {
	const cleaned = text
		.replace(/[^a-zA-Z0-9\s.,;:?!()'"-]/g, '')
		.replace(/\s+/g, ' ')
		.trim();

	if (!cleaned || cleaned.length < 10) {
		throw new Error('Chunk skipped: content too short or invalid.');
	}

	const result = await embedder.embedContent({
		content: {
			parts: [{ text: cleaned }],
			role: 'user',
		},
	});

	const embedding = result?.embedding?.values;

	if (!Array.isArray(embedding)) {
		console.error('❌ Invalid embedding structure:', result);
		throw new Error('Gemini did not return a valid embedding array');
	}

	return embedding;
}

// ✅ Add chunks from a paper to Pinecone
async function addPaperChunks(paperId, title, text) {
	const index = pc.index(indexName);
	const ns = index.namespace(namespaceName);

	const chunkSize = 1000;
	const chunks = splitIntoSentences(text);

	for (let i = 0; i < text.length; i += chunkSize) {
		chunks.push(text.slice(i, i + chunkSize));
	}

	const vectors = await Promise.all(
		chunks.map(async (chunk, i) => {
			const embedding = await embedText(chunk);
			return {
				id: uuidv4(),
				values: embedding,
				metadata: {
					paperId,
					title,
					chunkIndex: i,
					text: chunk,
				},
			};
		})
	);

	await ns.upsert(vectors);
	console.log(`✅ ${vectors.length} chunks indexed for paper "${title}"`);
}

// ✅ Search relevant chunks given a question
async function searchRelevantChunks(query, topK = 4) {
	const index = pc.index(indexName);
	const ns = index.namespace(namespaceName);

	const queryEmbedding = await embedText(query);

	const result = await ns.query({
		topK,
		vector: queryEmbedding,
		includeMetadata: true,
		includeValues: false,
	});

	return result.matches.map((match) => ({
		text: match.metadata.text,
		meta: match.metadata,
		score: match.score,
	}));
}

module.exports = {
	addPaperChunks,
	searchRelevantChunks,
};
