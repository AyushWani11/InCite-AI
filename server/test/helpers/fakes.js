// In-memory stand-ins for the Gemini and Pinecone SDKs.
//
// Tests must run without API keys or network access. Instead of changing the
// app code to accept mocks, we pre-fill Node's module cache: when app code
// later calls require('@google/genai') or require('@pinecone-database/pinecone'),
// Node hands back these fakes. This file must therefore be required BEFORE the
// app is loaded.
const Module = require('module');

// Dimensions of the fake embeddings. Large enough that unrelated words rarely
// hash to the same slot (which would fake a similarity between them).
const DIM = 1024;

const state = {
	gemini: {
		// Every generateContent call: { model, prompt, request }
		calls: [],
		// Every streamed reply (chat answers): { model, history, config }
		chats: [],
		// Per-test hooks (reset() restores the defaults below)
		generate: null, // ({ model, prompt, request }) => string
		// ({ model, history }) => string, or an array of pieces to stream;
		// an Error in the array is thrown at that point, mid-stream.
		chatReply: null,
	},
	pinecone: {
		namespaces: new Map(), // namespace -> Map(id -> record)
		queries: [],
		deletes: [],
		upsertBatches: [], // { namespace, size } per successful upsertRecords call
		upsertAttempts: 0, // every upsertRecords call, including failed ones
		// (attemptNumber, records) => Error | null: simulate upsert failures
		upsertFailure: null,
		deleteFails: false, // simulate Pinecone being unavailable for deletes
		// Real Pinecone may answer 404 for a namespace that has no records yet.
		missingNamespaceThrows: false,
		// What describeIndex returns; mirrors the real "research-assistant".
		indexConfig: null,
	},
};

const DEFAULT_INDEX_CONFIG = {
	dimension: 768,
	metric: 'cosine',
	vectorType: 'dense',
	spec: { serverless: { cloud: 'aws', region: 'us-east-1' } },
	status: { ready: true, state: 'Ready' },
	embed: { model: 'llama-text-embed-v2', fieldMap: { text: 'text' } },
};

function reset() {
	state.gemini.calls = [];
	state.gemini.chats = [];
	// Like real JSON mode: if a schema was requested, reply with valid JSON.
	state.gemini.generate = ({ request }) => {
		const schema = request?.config?.responseJsonSchema;
		return schema ? JSON.stringify(sampleFromSchema(schema)) : 'fake reply';
	};
	state.gemini.chatReply = () => 'fake answer';
	state.pinecone.namespaces = new Map();
	state.pinecone.queries = [];
	state.pinecone.deletes = [];
	state.pinecone.upsertBatches = [];
	state.pinecone.upsertAttempts = 0;
	state.pinecone.upsertFailure = () => null;
	state.pinecone.deleteFails = false;
	state.pinecone.missingNamespaceThrows = false;
	state.pinecone.indexConfig = structuredClone(DEFAULT_INDEX_CONFIG);
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

// A small value that satisfies a JSON Schema (the subset our schemas use).
function sampleFromSchema(schema) {
	if (schema.enum) return schema.enum[0];
	switch (schema.type) {
		case 'object':
			return Object.fromEntries(
				Object.entries(schema.properties || {}).map(([k, sub]) => [k, sampleFromSchema(sub)])
			);
		case 'array':
			return Array.from({ length: Math.max(1, schema.minItems || 0) }, () =>
				sampleFromSchema(schema.items || { type: 'string' })
			);
		case 'integer':
		case 'number':
			return schema.minimum ?? 1;
		case 'boolean':
			return true;
		default:
			return 'sample text';
	}
}

// The text of a `contents` value: a string, a turn, or a list of either.
function textOf(contents) {
	if (typeof contents === 'string') return contents;
	const list = Array.isArray(contents) ? contents : [contents];
	return list
		.flatMap((c) => (typeof c === 'string' ? [c] : (c?.parts || []).map((p) => p.text || '')))
		.join('\n');
}

// ---------- Fake Gemini SDK (@google/genai) ----------
// Same surface the app uses: ai.models.generateContent / generateContentStream,
// whose responses expose the reply as `.text`.
class FakeGoogleGenAI {
	constructor(options) {
		this.options = options;
		this.models = {
			async generateContent({ model, contents, config }) {
				if (!model) throw new Error('[fake gemini] model is required');
				const call = { model, prompt: textOf(contents), request: { contents, config } };
				state.gemini.calls.push(call);
				return { text: await state.gemini.generate(call) }; // may be async
			},
			// Like the real SDK: the promise settles once the request is
			// accepted (a rejected request throws here), then pieces stream.
			async generateContentStream({ model, contents, config }) {
				if (!model) throw new Error('[fake gemini] model is required');
				const record = { model, history: contents, config };
				state.gemini.chats.push(record);
				const reply = await state.gemini.chatReply(record);
				const pieces = Array.isArray(reply) ? reply : [reply];
				return (async function* () {
					for (const piece of pieces) {
						if (piece instanceof Error) throw piece;
						yield { text: piece };
					}
				})();
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

function notFound(nsName) {
	const err = new Error(`[fake pinecone] namespace "${nsName}" not found`);
	err.name = 'PineconeNotFoundError';
	return err;
}

// Pinecone accepts string, number, boolean or list-of-strings metadata.
function checkMetadataValue(key, value) {
	const ok =
		typeof value === 'string' ||
		typeof value === 'number' ||
		typeof value === 'boolean' ||
		(Array.isArray(value) && value.every((v) => typeof v === 'string'));
	if (!ok) {
		throw new Error(`[fake pinecone] invalid metadata value for "${key}": ${JSON.stringify(value)}`);
	}
}

function fakeNamespace(nsName) {
	const textField = () => state.pinecone.indexConfig.embed?.fieldMap?.text;
	const missing = () => !state.pinecone.namespaces.has(nsName);

	return {
		// Integrated embedding: Pinecone embeds each record's text field.
		async upsertRecords(records) {
			if (!state.pinecone.indexConfig.embed) {
				throw new Error('[fake pinecone] upsertRecords needs an index with integrated embedding');
			}
			if (!Array.isArray(records) || records.length === 0) {
				throw new Error('[fake pinecone] upsertRecords needs a non-empty array');
			}
			if (records.length > 96) {
				throw new Error(`[fake pinecone] at most 96 records per upsertRecords call, got ${records.length}`);
			}
			const attempt = ++state.pinecone.upsertAttempts;
			const failure = state.pinecone.upsertFailure(attempt, records);
			if (failure) throw failure;
			state.pinecone.upsertBatches.push({ namespace: nsName, size: records.length });
			const store = namespaceStore(nsName);
			for (const record of records) {
				const { id, _id, ...fields } = record;
				const recordId = id ?? _id;
				if (!recordId) throw new Error('[fake pinecone] every record needs an id');
				if (typeof fields[textField()] !== 'string') {
					throw new Error(`[fake pinecone] record ${recordId} has no "${textField()}" text to embed`);
				}
				for (const [k, v] of Object.entries(fields)) checkMetadataValue(k, v);
				store.set(recordId, {
					id: recordId,
					values: fakeEmbed(fields[textField()]),
					metadata: structuredClone(fields),
				});
			}
		},
		async searchRecords({ query, fields }) {
			state.pinecone.queries.push({
				namespace: nsName,
				topK: query.topK,
				filter: query.filter,
				text: query.inputs?.text,
			});
			if (missing()) {
				if (state.pinecone.missingNamespaceThrows) throw notFound(nsName);
				return { result: { hits: [] }, usage: {} };
			}
			const vector = fakeEmbed(query.inputs.text);
			const hits = [...namespaceStore(nsName).values()]
				.filter((r) => matchesFilter(r.metadata, query.filter))
				.map((r) => ({
					_id: r.id,
					_score: r.values.reduce((s, x, i) => s + x * vector[i], 0),
					fields: Object.fromEntries(
						(fields || Object.keys(r.metadata))
							.filter((f) => f in r.metadata)
							.map((f) => [f, r.metadata[f]])
					),
				}))
				.sort((a, b) => b._score - a._score)
				.slice(0, query.topK);
			return { result: { hits }, usage: {} };
		},
		async deleteAll() {
			state.pinecone.deletes.push({ namespace: nsName, options: 'ALL' });
			if (state.pinecone.deleteFails) {
				throw new Error('[fake pinecone] service unavailable');
			}
			if (missing()) {
				if (state.pinecone.missingNamespaceThrows) throw notFound(nsName);
				return;
			}
			state.pinecone.namespaces.delete(nsName); // an emptied namespace disappears
		},
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
			if (state.pinecone.deleteFails) {
				throw new Error('[fake pinecone] service unavailable');
			}
			if (missing()) {
				if (state.pinecone.missingNamespaceThrows) throw notFound(nsName);
				return;
			}
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
	async describeIndex(name) {
		return { name, ...structuredClone(state.pinecone.indexConfig) };
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

install('@google/genai', { GoogleGenAI: FakeGoogleGenAI });
install('@pinecone-database/pinecone', { Pinecone: FakePinecone });

module.exports = { state, reset, fakeEmbed, sampleFromSchema, DIM };
