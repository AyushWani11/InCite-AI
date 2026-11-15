// Phase 6.1: uploads survive temporary Pinecone errors, clean up after
// permanent ones, never crash the server, and report honestly per file.
const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startApp, registerUser, uploadPdf } = require('./helpers/harness');
const { makePdf } = require('./helpers/pdf');
const { mapWithLimit, withRetry } = require('../utils/async');

let app;

// Errors shaped like the Pinecone SDK's.
const rateLimited = () =>
	Object.assign(new Error('Request failed. Status: 429. Too many requests'), {
		name: 'PineconeUnmappedHttpError',
	});
const badRequest = () => Object.assign(new Error('Bad request'), { name: 'PineconeBadRequestError' });

const pdf = (line) => makePdf({ pages: [[line]] });
const records = (user) => [...(app.fakes.state.pinecone.namespaces.get(`v2-${user.id}`)?.values() || [])];
const storedFiles = (user) =>
	mongoose.connection.db.collection('papers.files').countDocuments({ 'metadata.uploadedBy': user.id });
const paperCount = async (user) => (await user.get('/api/paper/user-papers')).body.length;

async function uploadMany(user, files) {
	const form = new FormData();
	for (const [name, bytes] of files) {
		form.append('files', new Blob([bytes], { type: 'application/pdf' }), name);
	}
	return user.post('/api/paper/upload', { form });
}

before(async () => {
	app = await startApp();
});
afterEach(() => {
	app.fakes.state.pinecone.upsertFailure = () => null;
});
after(() => app.stop());

// ---------- Helpers (pure) ----------

test('after a failure, mapWithLimit starts nothing new but waits for running calls', async () => {
	const finished = [];
	const started = [];
	await assert.rejects(
		mapWithLimit([0, 1, 2, 3, 4, 5], 2, async (x) => {
			started.push(x);
			await new Promise((r) => setTimeout(r, x === 1 ? 30 : 5));
			if (x === 0) throw new Error('boom');
			finished.push(x);
		}),
		/boom/
	);
	assert.deepEqual(started, [0, 1], 'no new work after the failure');
	assert.deepEqual(finished, [1], 'the call already running was awaited');
});

test('withRetry retries only transient errors, and gives up after 3 attempts', async () => {
	let calls = 0;
	await assert.rejects(withRetry(async () => { calls++; throw rateLimited(); }), /429/);
	assert.equal(calls, 3);

	calls = 0;
	await assert.rejects(withRetry(async () => { calls++; throw badRequest(); }), /Bad request/);
	assert.equal(calls, 1);
});

// ---------- Through the API ----------

test('a temporary rate-limit error is retried and the upload succeeds', async () => {
	const user = await registerUser(app.base, 'retryok');
	app.fakes.state.pinecone.upsertFailure = (attempt) => (attempt <= 2 ? rateLimited() : null);
	const before = app.fakes.state.pinecone.upsertAttempts;

	const res = await uploadPdf(user, 'ok.pdf', pdf('Retried paper about coral reefs.'));
	assert.equal(res.status, 201);
	assert.equal(res.body.papers.length, 1);
	assert.equal(app.fakes.state.pinecone.upsertAttempts - before, 3, 'two failures, then success');
	assert.ok(records(user).length > 0);
});

test('a permanent error is not retried', async () => {
	const user = await registerUser(app.base, 'noretry');
	app.fakes.state.pinecone.upsertFailure = () => badRequest();
	const before = app.fakes.state.pinecone.upsertAttempts;

	await uploadPdf(user, 'bad.pdf', pdf('This upload hits a permanent error.'));
	assert.equal(app.fakes.state.pinecone.upsertAttempts - before, 1);
});

test('if indexing keeps failing: honest error, nothing left behind, server still up', async () => {
	const user = await registerUser(app.base, 'cleanup');
	app.fakes.state.pinecone.upsertFailure = () => rateLimited(); // never recovers

	const res = await uploadPdf(user, 'doomed.pdf', pdf('This paper cannot be indexed.'));
	assert.equal(res.status, 502);
	assert.equal(res.body.papers.length, 0);
	assert.equal(res.body.failed[0].filename, 'doomed.pdf');
	assert.match(res.body.failed[0].error, /index/i);

	assert.equal(await paperCount(user), 0, 'paper record left behind');
	assert.equal(await storedFiles(user), 0, 'stored PDF left behind');
	assert.deepEqual(records(user), [], 'vectors left behind');
	assert.equal((await user.get('/api/auth/check-login')).status, 200);
});

test('a half-indexed paper is removed completely', async () => {
	const user = await registerUser(app.base, 'halfway');
	const filler = 'with extra words so that every sentence becomes its own chunk of text';
	const lines = Array.from({ length: 130 }, (_, i) => `Sentence ${i} ${filler} ${filler} ${filler} ${filler}.`);
	// The first batch of 96 chunks is stored, then every later call fails.
	let batches = 0;
	app.fakes.state.pinecone.upsertFailure = () => (++batches > 1 ? badRequest() : null);

	const res = await uploadPdf(user, 'long.pdf', makePdf({ pages: [lines] }));
	assert.equal(res.status, 502);
	assert.deepEqual(records(user), [], 'the first batch was not cleaned up');
	assert.equal(await paperCount(user), 0);
	assert.equal(await storedFiles(user), 0);
});

test('a mix of good and unreadable files reports both (207)', async () => {
	const user = await registerUser(app.base, 'mixed');
	const res = await uploadMany(user, [
		['good.pdf', pdf('A perfectly good paper about tides.')],
		['notes.pdf', Buffer.from('this is not a pdf at all')],
	]);
	assert.equal(res.status, 207);
	assert.deepEqual(res.body.papers.map((p) => p.filename), ['good.pdf']);
	assert.equal(res.body.failed.length, 1);
	assert.equal(res.body.failed[0].filename, 'notes.pdf');
	assert.match(res.body.failed[0].error, /readable PDF/i);
	assert.equal(await paperCount(user), 1);
});

test('if every file is unreadable, the response says so (422)', async () => {
	const user = await registerUser(app.base, 'allbad');
	const res = await uploadMany(user, [['junk.pdf', Buffer.from('nope')]]);
	assert.equal(res.status, 422);
	assert.equal(res.body.papers.length, 0);
	assert.equal(res.body.failed[0].filename, 'junk.pdf');
});

test('chat ignores leftover chunks whose paper no longer exists', async () => {
	const user = await registerUser(app.base, 'orphans');
	await uploadPdf(user, 'real.pdf', pdf('Real research on wind turbines.'));
	// Chunks of a paper that is gone (e.g. a clean-up that could not finish).
	const ns = app.fakes.state.pinecone.namespaces.get(`v2-${user.id}`);
	ns.set('aaaaaaaaaaaaaaaaaaaaaaaa#0', {
		id: 'aaaaaaaaaaaaaaaaaaaaaaaa#0',
		values: app.fakes.fakeEmbed('Orphaned ghost text about ghosts and phantoms.'),
		metadata: {
			text: 'Orphaned ghost text about ghosts and phantoms.',
			paperId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
			title: 'Deleted paper',
			chunkIndex: 0,
		},
	});

	const form = new FormData();
	form.append('question', 'Tell me about ghosts and phantoms');
	form.append('history', '[]');
	const chatsBefore = app.fakes.state.gemini.chats.length;
	const res = await user.post('/api/chat', { form });
	assert.equal(res.status, 200);
	const newChats = app.fakes.state.gemini.chats.slice(chatsBefore);
	assert.doesNotMatch(JSON.stringify(newChats), /Orphaned ghost/);
});
