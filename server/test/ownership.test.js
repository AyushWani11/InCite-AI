// Two users, one paper: only the owner may see or change it.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp, registerUser, uploadPdf } = require('./helpers/harness');
const { makePdf } = require('./helpers/pdf');

// A response that satisfies both the summary and the assessment prompts.
const GOOD_JSON = JSON.stringify({
	summary: 'A summary.',
	contributions: ['A contribution.'],
	methodology: 'A method.',
	findings: 'Some findings.',
	conclusion: 'A conclusion.',
	score: {
		writingQuality: 'Good',
		methodology: 'Good',
		academicStandards: 'Good',
		overallScore: 70,
	},
	feedback: { writing: 'w', methodology: 'm', standards: 's' },
	improvementSuggestions: ['Add more data.'],
	issues: [],
	'X-Factor': 'Novel.',
});

let app, alice, bob, paperId;

before(async () => {
	app = await startApp();
	app.fakes.state.gemini.generate = () => GOOD_JSON;
	alice = await registerUser(app.base, 'alice');
	bob = await registerUser(app.base, 'bob');

	const pdf = makePdf({
		pages: [['Alice studies glaciers in Patagonia.', 'Results show rapid melting.']],
	});
	const res = await uploadPdf(alice, 'alice-glaciers.pdf', pdf);
	assert.equal(res.status, 201);
	paperId = res.body.papers[0]._id;
});

after(() => app.stop());

test('control: the owner can summarize, assess and read the results', async () => {
	assert.equal((await alice.post(`/api/paper/summarize/${paperId}`)).status, 200);
	assert.equal((await alice.get(`/api/paper/summary/${paperId}`)).status, 200);
	assert.equal((await alice.post(`/api/paper/assess/${paperId}`)).status, 200);
	assert.equal((await alice.get(`/api/paper/assessment/${paperId}`)).status, 200);
});

test("another user gets 404 for someone else's paper", async () => {
	const callsBefore = app.fakes.state.gemini.calls.length;

	for (const [method, path] of [
		['post', `/api/paper/summarize/${paperId}`],
		['get', `/api/paper/summary/${paperId}`],
		['post', `/api/paper/assess/${paperId}`],
		['get', `/api/paper/assessment/${paperId}`],
	]) {
		const res = await bob[method](path);
		assert.equal(res.status, 404, `${method.toUpperCase()} ${path} returned ${res.status}`);
		assert.ok(!JSON.stringify(res.body).includes('A summary.'), `${path} leaked data`);
	}

	// Bob's requests must not have spent Gemini calls on Alice's paper.
	assert.equal(app.fakes.state.gemini.calls.length, callsBefore);
});

test("another user cannot delete someone else's paper", async () => {
	const res = await bob.del(`/api/paper/delete/${paperId}`);
	assert.equal(res.status, 404);
	assert.equal((await alice.get(`/api/paper/summary/${paperId}`)).status, 200);
});

test("delete-all only removes the caller's own papers", async () => {
	await bob.del('/api/paper/delete-all');
	assert.equal((await alice.get(`/api/paper/summary/${paperId}`)).status, 200);
});

test('search only returns your own papers', async () => {
	const own = await alice.get('/api/paper/search');
	assert.equal(own.status, 200);
	assert.ok(own.body.some((p) => p._id === paperId), 'owner should find her paper');

	for (const query of ['', '?title=alice', `?uploadedBy=${alice.id}`]) {
		const res = await bob.get(`/api/paper/search${query}`);
		assert.equal(res.status, 200);
		assert.deepEqual(res.body, [], `search${query} leaked other users' papers`);
	}
});

test('malformed paper ids get 404, not a 500 crash', async () => {
	for (const bad of ['not-an-id', '123456789012']) {
		const res = await alice.get(`/api/paper/summary/${bad}`);
		assert.equal(res.status, 404, `id "${bad}" returned ${res.status}`);
	}
});
