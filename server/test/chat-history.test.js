// Saving and reading back chat conversations (/api/chat/save-history and
// /api/chat/history). The client sends what it also sends to /api/chat:
// { history: [{ role: 'user' | 'assistant', text }] }.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp, makeClient, registerUser } = require('./helpers/harness');

let app;
before(async () => {
	app = await startApp();
});
after(async () => {
	await app.stop();
});

const conversation = [
	{ role: 'user', text: 'What does the paper propose?' },
	{ role: 'assistant', text: 'A planner that splits a question into **retrieval steps**.' },
];

// A request with a text/plain body: browsers send these without a CORS
// preflight, which matters for a save made while the page is closing.
const postText = (client, body) =>
	fetch(`${app.base}/api/chat/save-history`, {
		method: 'POST',
		headers: { 'content-type': 'text/plain;charset=UTF-8', cookie: client.cookie },
		body,
	}).then(async (res) => ({ status: res.status, body: await res.json() }));

test('saves a conversation sent as JSON and reads it back unchanged', async () => {
	const alice = await registerUser(app.base, 'histjson');
	const saved = await alice.post('/api/chat/save-history', { json: { history: conversation } });
	assert.equal(saved.status, 201, JSON.stringify(saved.body));
	assert.ok(saved.body.sessionId);

	const list = await alice.get('/api/chat/history');
	assert.equal(list.status, 200);
	assert.deepEqual(
		list.body.chatHistory.map((s) => s.chatSessionId),
		[saved.body.sessionId]
	);

	const one = await alice.get(`/api/chat/history/${saved.body.sessionId}`);
	assert.equal(one.status, 200);
	assert.deepEqual(one.body.history, conversation);
});

test('accepts the same body sent as text/plain', async () => {
	const alice = await registerUser(app.base, 'histtext');
	const saved = await postText(alice, JSON.stringify({ history: conversation }));
	assert.equal(saved.status, 201, JSON.stringify(saved.body));

	const one = await alice.get(`/api/chat/history/${saved.body.sessionId}`);
	assert.deepEqual(one.body.history, conversation);
});

test('saving again with the same sessionId updates that session instead of adding one', async () => {
	const alice = await registerUser(app.base, 'histupsert');
	const sessionId = 'tab-6f1c2a';
	const first = await alice.post('/api/chat/save-history', { json: { sessionId, history: conversation.slice(0, 1) } });
	assert.equal(first.status, 201, JSON.stringify(first.body));
	const second = await alice.post('/api/chat/save-history', { json: { sessionId, history: conversation } });
	assert.equal(second.status, 200, JSON.stringify(second.body));
	assert.equal(second.body.sessionId, sessionId);

	const list = await alice.get('/api/chat/history');
	assert.equal(list.body.chatHistory.length, 1);
	const one = await alice.get(`/api/chat/history/${sessionId}`);
	assert.deepEqual(one.body.history, conversation);
});

test("a session id can't be used to read or overwrite another user's conversation", async () => {
	const alice = await registerUser(app.base, 'histowner');
	const mallory = await registerUser(app.base, 'histother');
	const sessionId = 'shared-id-123';
	await alice.post('/api/chat/save-history', { json: { sessionId, history: conversation } });

	const read = await mallory.get(`/api/chat/history/${sessionId}`);
	assert.equal(read.status, 404);

	const overwrite = [{ role: 'user', text: 'overwritten' }];
	await mallory.post('/api/chat/save-history', { json: { sessionId, history: overwrite } });
	const alicesCopy = await alice.get(`/api/chat/history/${sessionId}`);
	assert.deepEqual(alicesCopy.body.history, conversation);
	const mallorysCopy = await mallory.get(`/api/chat/history/${sessionId}`);
	assert.deepEqual(mallorysCopy.body.history, overwrite);
});

test('rejects malformed histories with a 400 and a reason', async () => {
	const alice = await registerUser(app.base, 'histbad');
	const cases = [
		['not JSON', postText(alice, '{"history": [')],
		['missing history', alice.post('/api/chat/save-history', { json: {} })],
		['empty history', alice.post('/api/chat/save-history', { json: { history: [] } })],
		['unknown role', alice.post('/api/chat/save-history', { json: { history: [{ role: 'system', text: 'hi' }] } })],
		['empty text', alice.post('/api/chat/save-history', { json: { history: [{ role: 'user', text: '  ' }] } })],
		['bad session id', alice.post('/api/chat/save-history', { json: { sessionId: '../x', history: conversation } })],
		[
			'too many messages',
			alice.post('/api/chat/save-history', {
				json: { history: Array.from({ length: 201 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: 'x' })) },
			}),
		],
	];
	for (const [label, pending] of cases) {
		const res = await pending;
		assert.equal(res.status, 400, `${label}: ${res.status} ${JSON.stringify(res.body)}`);
		assert.ok(res.body.error, `${label}: no error message`);
	}
	const list = await alice.get('/api/chat/history');
	assert.equal(list.body.chatHistory.length, 0);
});

test('saving requires login', async () => {
	const anonymous = makeClient(app.base);
	const res = await anonymous.post('/api/chat/save-history', { json: { history: conversation } });
	assert.equal(res.status, 401);
});
