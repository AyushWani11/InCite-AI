// Downloading a paper's PDF requires being logged in as its owner.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp, makeClient, registerUser, uploadPdf } = require('./helpers/harness');
const { makePdf } = require('./helpers/pdf');

let app, alice, bob, alicePdf, alicePaperId, bobPaperId;

before(async () => {
	app = await startApp();
	alice = await registerUser(app.base, 'alice');
	bob = await registerUser(app.base, 'bob');

	alicePdf = makePdf({ pages: [["Alice's private draft."]] });
	alicePaperId = (await uploadPdf(alice, 'draft.pdf', alicePdf)).body.papers[0]._id;
	const bobPdf = makePdf({ pages: [["Bob's paper with the same filename."]] });
	bobPaperId = (await uploadPdf(bob, 'draft.pdf', bobPdf)).body.papers[0]._id;
});

after(() => app.stop());

test('the owner can download their PDF by paper id', async () => {
	const res = await alice.get(`/api/paper/download/${alicePaperId}`);
	assert.equal(res.status, 200);
	assert.match(res.headers.get('content-type'), /application\/pdf/);
	assert.ok(Buffer.compare(res.body, alicePdf) === 0, 'downloaded bytes differ from upload');
});

test('a logged-out visitor cannot download anything', async () => {
	const anon = makeClient(app.base);
	for (const path of [
		`/api/paper/download/${alicePaperId}`,
		'/api/paper/download/draft.pdf', // the old filename-based URL
	]) {
		const res = await anon.get(path);
		assert.equal(res.status, 401, `${path} returned ${res.status}`);
		assert.ok(!Buffer.isBuffer(res.body), `${path} returned a PDF`);
	}
});

test("another user gets 404 for someone else's paper", async () => {
	const res = await bob.get(`/api/paper/download/${alicePaperId}`);
	assert.equal(res.status, 404);
	assert.ok(!Buffer.isBuffer(res.body));
});

test('a shared filename still downloads your own file', async () => {
	const res = await bob.get(`/api/paper/download/${bobPaperId}`);
	assert.equal(res.status, 200);
	assert.ok(Buffer.compare(res.body, alicePdf) !== 0, "bob received alice's file");
});

test('filenames are not accepted in place of paper ids', async () => {
	const res = await alice.get('/api/paper/download/draft.pdf');
	assert.equal(res.status, 404);
});
