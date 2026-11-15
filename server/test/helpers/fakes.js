// In-memory stand-ins for the Gemini and Pinecone SDKs.
//
// Tests must run without API keys or network access. Instead of changing the
// app code to accept mocks, we pre-fill Node's module cache: when app code
// later calls require('@google/generative-ai') or
// require('@pinecone-database/pinecone'), Node hands back these fakes.
// This file must therefore be required BEFORE the app is loaded.
const Module = require('module');

const DIM = 64;

const state = {
	gemini: {
		// Every generateContent call: { model, prompt, request }
		calls: [],
		// Every chat turn: { model, history, message }
		chats: [],
		embedCalls: 0,
		// Per-test hooks (reset() restores the defaults below)
		generate: null, // ({ model, prompt, request }) => string
		chatReply: null, // ({ history, message }) => string
		embedFails: null, // (text) => boolean, simulate an embedding error
	},
	pinecone: {
		namespaces: new Map(), // namespace -> Map(id -> record)
		queries: [],
		deletes: [],
	},
};

function reset() {
	state.gemini.calls = [];
	state.gemini.chats = [];
	state.gemini.embedCalls = 0;
	state.gemini.generate = () => '{}';
	state.gemini.chatReply = () => 'fake answer';
	state.gemini.embedFails = () => false;
	state.pinecone.namespaces = new Map();
	state.pinecone.queries = [];
	state.pinecone.deletes = [];
}
reset();

// ---------- Fake embeddings ----------
// Deterministic bag-of-words vector: texts that share words get similar
// vectors, so retrieval tests behave sensibly without a real model.
function hashWord(word) {
	let h = 2166136261;
	for (let i = 0; i < word.length; i++) {
		h ^= word.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return (h >>> 0) % DIM;
}

function fakeEmbed(text) {
	const v = new Array(DIM).fill(0);
	for (const w of text.toLowerCase().match(/[a-z0-9]+/g) || []) {
		v[hashWord(w)] += 1;
	}
	const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
	return v.map((x) => x / norm);
}

function textOf(request) {
	if (typeof request === 'string') return request;
	const contents = request?.contents || (request?.content ? [request.content] : []);
	return contents
		.flatMap((c) => c.parts || [])
		.map((p) => p.text || '')
		.join('\n');
}

// ---------- Fake Gemini SDK ----------
class FakeGoogleGenerativeAI {
	constructor(apiKey) {
		this.apiKey = apiKey;
	}

	getGenerativeModel({ model }) {
		return {
			model,
			async embedContent(request) {
				state.gemini.embedCalls++;
				const text = textOf(request);
				if (state.gemini.embedFails(text)) {
					throw new Error('[fake] embedding failed');
				}
				return { embedding: { values: fakeEmbed(text) } };
			},
			async generateContent(request) {
				const call = { model, prompt: textOf(request), request };
				state.gemini.calls.push(call);
				const out = state.gemini.generate(call);
				return { response: { text: () => out } };
			},
			startChat({ history = [] } = {}) {
				const turn = async (message) => {
					const record = { model, history, message };
					state.gemini.chats.push(record);
					return state.gemini.chatReply(record);
				};
				return {
					async sendMessage(message) {
						const out = await turn(message);
						return { response: { text: () => out } };
					},
					async sendMessageStream(message) {
						const out = await turn(message);
						async function* stream() {
							yield { text: () => out };
						}
						return {
							stream: stream(),
							response: Promise.resolve({ text: () => out }),
						};
					},
				};
			},
		};
	}
}

// ---------- Fake Pinecone SDK ----------
// Supports the filter shapes the app uses. Like the real service, it rejects
// a plain object where a value or operator was expected.
function matchesFilter(metadata, filter) {
	if (!filter) return true;
	return Object.entries(filter).every(([key, cond]) => {
		if (key === '$and') return cond.every((f) => matchesFilter(metadata, f));
		if (key === '$or') return cond.some((f) => matchesFilter(metadata, f));
		if (cond !== null && typeof cond === 'object' && !Array.isArray(cond)) {
			const ops = Object.keys(cond);
			if (!ops.every((op) => op.startsWith('$'))) {
				throw new Error(
					`[fake pinecone] invalid filter for "${key}": expected a value or $operator`
				);
			}
			return ops.every((op) => {
				const v = cond[op];
				if (op === '$eq') return metadata[key] === v;
				if (op === '$ne') return metadata[key] !== v;
				if (op === '$in') return v.includes(metadata[key]);
				if (op === '$nin') return !v.includes(metadata[key]);
				throw new Error(`[fake pinecone] unsupported operator ${op}`);
			});
		}
		return metadata[key] === cond;
	});
}

function namespaceStore(name) {
	if (!state.pinecone.namespaces.has(name)) {
		state.pinecone.namespaces.set(name, new Map());
	}
	return state.pinecone.namespaces.get(name);
}

function fakeNamespace(nsName) {
	return {
		async upsert(records) {
			if (!Array.isArray(records) || records.length === 0) {
				throw new Error('[fake pinecone] upsert needs a non-empty array');
			}
			const store = namespaceStore(nsName);
			for (const r of records) store.set(r.id, structuredClone(r));
		},
		async query({ topK, vector, filter, includeMetadata }) {
			state.pinecone.queries.push({ namespace: nsName, topK, filter });
			const store = namespaceStore(nsName);
			const matches = [...store.values()]
				.filter((r) => matchesFilter(r.metadata, filter))
				.map((r) => ({
					id: r.id,
					score: r.values.reduce((s, x, i) => s + x * vector[i], 0),
					metadata: includeMetadata ? r.metadata : undefined,
				}))
				.sort((a, b) => b.score - a.score)
				.slice(0, topK);
			return { matches, namespace: nsName };
		},
		// Same contract as SDK 5.x: an array means record ids, anything else
		// IS the metadata filter.
		async deleteMany(options) {
			state.pinecone.deletes.push({ namespace: nsName, options });
			const store = namespaceStore(nsName);
			for (const [id, r] of store) {
				const hit = Array.isArray(options)
					? options.includes(id)
					: matchesFilter(r.metadata, options);
				if (hit) store.delete(id);
			}
		},
	};
}

class FakePinecone {
	constructor(config) {
		this.config = config;
	}
	index(name) {
		return {
			name,
			namespace: (ns) => fakeNamespace(ns),
			...fakeNamespace(''),
		};
	}
}

// ---------- Install into the module cache ----------
function install(name, overrides) {
	const real = require(name); // keep enums/helpers such as SchemaType
	const file = require.resolve(name);
	const fake = new Module(file, module);
	fake.filename = file;
	fake.loaded = true;
	fake.exports = { ...real, ...overrides };
	require.cache[file] = fake;
}

install('@google/generative-ai', { GoogleGenerativeAI: FakeGoogleGenerativeAI });
install('@pinecone-database/pinecone', { Pinecone: FakePinecone });

module.exports = { state, reset, fakeEmbed, DIM };
