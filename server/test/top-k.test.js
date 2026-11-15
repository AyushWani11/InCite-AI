// Phase 6.3: how many chunks an answer gets (top-K) is configurable;
// the default is 8 (measured on real papers: 4 was too few for
// "explain"/"walk me through" questions).
const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { startApp, registerUser, uploadPdf } = require('./helpers/harness');
const { makePdf } = require('./helpers/pdf');

let app, user, longPaper, focusedPaper;

// The context of the latest answer, and how many excerpts it contained.
const lastContext = () => JSON.stringify(app.fakes.state.gemini.chats.at(-1).history);
const excerptCount = () => (lastContext().match(/Excerpt \d+:/g) || []).length;

async function ask(question, paperId) {
	const form = new FormData();
	form.append('question', question);
	form.append('history', '[]');
	if (paperId) form.append('paperId', paperId);
	return user.post('/api/chat', { form });
}

// Sentences long enough (~230 characters) that each becomes its own chunk.
const tail =
	'measured with sensors on each tower across several windy coastal sites during a long study, ' +
	'then compared against maintenance logs and manufacturer specifications.';
// A long paper: 30 chunks that mention turbines only in passing.
const longPages = () => [
	Array.from({ length: 30 }, (_, i) => `Site report ${i}: the turbine output was ${tail}`),
];
// A focused paper: 6 chunks squarely about turbine blade wear.
const focusedPages = () => [
	Array.from({ length: 6 }, (_, i) => `Blade study ${i}: turbine blade wear and blade erosion were ${tail}`),
];

before(async () => {
	app = await startApp();
	user = await registerUser(app.base, 'topk');
	longPaper = (await uploadPdf(user, 'sites.pdf', makePdf({ pages: longPages() }))).body.papers[0]._id;
	focusedPaper = (await uploadPdf(user, 'blades.pdf', makePdf({ pages: focusedPages() }))).body.papers[0]._id;
});
afterEach(() => {
	delete process.env.RETRIEVAL_TOP_K;
	delete process.env.CHAT_FULL_TEXT_MAX_CHARS;
});
after(() => app.stop());

test('a long selected paper gets 8 excerpts by default', async () => {
	process.env.CHAT_FULL_TEXT_MAX_CHARS = '500'; // force retrieval within the paper
	assert.equal((await ask('What about turbine blade wear?', longPaper)).status, 200);
	assert.equal(excerptCount(), 8);
});

test('RETRIEVAL_TOP_K changes how many excerpts an answer gets', async () => {
	process.env.CHAT_FULL_TEXT_MAX_CHARS = '500';
	process.env.RETRIEVAL_TOP_K = '3';
	await ask('What about turbine blade wear?', longPaper);
	assert.equal(excerptCount(), 3);

	process.env.RETRIEVAL_TOP_K = 'lots'; // invalid: back to the default
	await ask('What about turbine blade wear?', longPaper);
	assert.equal(excerptCount(), 8);
});

test("without a selection, the chosen paper's excerpts are topped up to K", async () => {
	// The focused paper wins, but has fewer than K chunks among the 20
	// candidates, so one extra search limited to it fetches the rest.
	process.env.RETRIEVAL_TOP_K = '15';
	const before = app.fakes.state.pinecone.queries.length;
	assert.equal((await ask('What causes turbine blade wear and blade erosion?')).status, 200);

	const queries = app.fakes.state.pinecone.queries.slice(before);
	assert.equal(queries.length, 2, 'one search across papers, one within the chosen paper');
	assert.deepEqual(queries[1].filter, { paperId: { $eq: focusedPaper } });
	assert.equal(excerptCount(), 6, 'all 6 chunks the focused paper has');
	assert.doesNotMatch(lastContext(), /Site report/);
});

test('no top-up search when the candidates already hold enough chunks', async () => {
	process.env.RETRIEVAL_TOP_K = '4';
	const before = app.fakes.state.pinecone.queries.length;
	await ask('What causes turbine blade wear and blade erosion?');
	assert.equal(app.fakes.state.pinecone.queries.length - before, 1);
	assert.equal(excerptCount(), 4);
});
