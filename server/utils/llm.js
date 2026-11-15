// The one place the app talks to Gemini (text generation only; embeddings are
// done by Pinecone, see vectorStore.js).
//
// The model name comes from GEMINI_MODEL, so when Google retires a model,
// moving to the next one is a configuration change, not a code change.
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const DEFAULT_MODEL = 'gemini-3.6-flash';

function modelName() {
	return process.env.GEMINI_MODEL || DEFAULT_MODEL;
}

let client = null;
function gemini() {
	if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
	return client;
}

/**
 * Send a prompt (a string, or a list of { role, parts } turns) and return
 * the reply text.
 */
async function generateText(contents, config) {
	const response = await gemini().models.generateContent({
		model: modelName(),
		contents,
		config,
	});
	return response.text ?? '';
}

/**
 * Start streaming a reply. This resolves only once Gemini has accepted the
 * request, so a rejected request (bad model name, quota, ...) throws here,
 * before the caller has sent anything to the browser. It resolves to an
 * async iterator of text pieces.
 */
async function streamText(contents, config) {
	const stream = await gemini().models.generateContentStream({
		model: modelName(),
		contents,
		config,
	});
	return (async function* () {
		for await (const chunk of stream) {
			if (chunk.text) yield chunk.text;
		}
	})();
}

module.exports = { generateText, streamText, modelName, DEFAULT_MODEL };
