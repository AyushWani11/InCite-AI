// Chunks are embedded by Pinecone (integrated embedding) and stored in one
// namespace per user, "v2-<userId>", so a search can only see the caller's
// own papers.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp, registerUser, uploadPdf } = require('./helpers/harness');
const { makePdf } = require('./helpers/pdf');

let app, vectorStore;

const ns = (user) => `v2-${user.id}`;
const records = (name) => [...(app.fakes.state.pinecone.namespaces.get(name)?.values() || [])];

async function upload(user, filename, lines) {
	const res = await uploadPdf(user, filename, makePdf({ pages: [lines] }));
	assert.equal(res.status, 201);
	assert.equal(res.body.papers.length, 1, `upload of ${filename} failed`);
	return res.body.papers[0]._id;
}

async function ask(user, question) {
	const form = new FormData();
	form.append('question', question);
	form.append('history', '[]');
	return user.post('/api/chat', { form });
}

before(async () => {
	app = await startApp();
	vectorStore = require('../utils/vectorStore'); // same (faked) modules as the app
});
after(() => app.stop());

test("each user's chunks are stored in their own namespace", async () => {
	const alice = await registerUser(app.base, 'alice');
	const bob = await registerUser(app.base, 'bob');
	const a = await upload(alice, 'a.pdf', ['Alice writes about penguins in Antarctica.']);
	const b = await upload(bob, 'b.pdf', ['Bob writes about cacti in Arizona.']);

	assert.ok(records(ns(alice)).length > 0);
	assert.ok(records(ns(alice)).every((r) => r.metadata.paperId === a));
	assert.ok(records(ns(bob)).every((r) => r.metadata.paperId === b));
	assert.match(records(ns(alice))[0].metadata.text, /penguins/);
	assert.equal(records(ns(alice))[0].id, `${a}#0`);
});

test("chat only searches the caller's namespace", async () => {
	const carol = await registerUser(app.base, 'carol');
	const dave = await registerUser(app.base, 'dave');
	await upload(carol, 'c.pdf', ['Carol studies volcanoes and magma chambers.']);
	await upload(dave, 'd.pdf', ['Dave studies volcanoes and lava flows.']);

	const before = app.fakes.state.pinecone.queries.length;
	const res = await ask(dave, 'What do we know about volcanoes?');
	assert.equal(res.status, 200);

	const queries = app.fakes.state.pinecone.queries.slice(before);
	assert.ok(queries.length > 0, 'chat should search Pinecone');
	assert.ok(queries.every((q) => q.namespace === ns(dave)), JSON.stringify(queries));
	const sent = JSON.stringify(app.fakes.state.gemini.chats.at(-1).history);
	assert.match(sent, /lava flows/);
	assert.doesNotMatch(sent, /magma chambers/);
});

test('long papers are sent to Pinecone in batches of at most 96', async () => {
	const erin = await registerUser(app.base, 'erin');
	const filler = 'with plenty of extra words to make this sentence long enough';
	const lines = Array.from(
		{ length: 130 },
		(_, i) => `Sentence ${i} is about marine biology ${filler} ${filler} ${filler} ${filler} ${filler}.`
	);
	const paperId = await upload(erin, 'long.pdf', lines);

	const batches = app.fakes.state.pinecone.upsertBatches.filter((b) => b.namespace === ns(erin));
	const stored = records(ns(erin)).filter((r) => r.metadata.paperId === paperId).length;
	assert.ok(stored > 96, `expected over 96 chunks, got ${stored}`);
	assert.ok(batches.length >= 2);
	assert.ok(batches.every((b) => b.size <= 96));
	assert.equal(batches.reduce((s, b) => s + b.size, 0), stored);
});

test('indexing the same paper again replaces its chunks instead of duplicating', async () => {
	const userId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
	const text = 'First sentence here. Second sentence here. Third sentence here.';
	await vectorStore.addPaperChunks('p1', userId, 'Title', text);
	const count = records(`v2-${userId}`).length;
	assert.ok(count > 0, 'first indexing should store chunks');
	await vectorStore.addPaperChunks('p1', userId, 'Title', text);
	assert.equal(records(`v2-${userId}`).length, count);
});

test('a user without a namespace yet can search and delete without errors', async () => {
	app.fakes.state.pinecone.missingNamespaceThrows = true; // like a real 404
	try {
		const userId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
		assert.deepEqual(await vectorStore.searchRelevantChunks('anything', 4, null, userId), []);
		await vectorStore.deleteVectorsByUser(userId);
		await vectorStore.deleteVectorsByPaper('somepaper', userId);
	} finally {
		app.fakes.state.pinecone.missingNamespaceThrows = false;
	}
});

test('searching without a user id is refused', async () => {
	await assert.rejects(() => vectorStore.searchRelevantChunks('q', 4, null, undefined), /userId/);
});

test('the old shared "papers" namespace is never read, written or deleted', async () => {
	const legacy = new Map([['old-1', { id: 'old-1', values: [], metadata: { text: 'old' } }]]);
	app.fakes.state.pinecone.namespaces.set('papers', legacy);

	const frank = await registerUser(app.base, 'frank');
	const paper = await upload(frank, 'f.pdf', ['Frank studies tides.']);
	await ask(frank, 'What about tides?');
	await frank.del(`/api/paper/delete/${paper}`);
	await frank.del('/api/paper/delete-all');

	const touched = [
		...app.fakes.state.pinecone.queries,
		...app.fakes.state.pinecone.deletes,
		...app.fakes.state.pinecone.upsertBatches,
	].filter((op) => op.namespace === 'papers');
	assert.deepEqual(touched, []);
	assert.equal(app.fakes.state.pinecone.namespaces.get('papers').size, 1);
});
