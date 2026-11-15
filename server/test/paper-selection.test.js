// Phase 4: papers are identified by _id, a selected paper is read in full
// (or by retrieval within it when long), and without a selection the paper
// is chosen by retrieval, refusing to guess when nothing is relevant.
const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { startApp, registerUser, uploadPdf } = require('./helpers/harness');
const { makePdf } = require('./helpers/pdf');
const { choosePaper, rankPapers, minScore, DEFAULT_MIN_SCORE } = require('../utils/paperSelection');

let app;

async function upload(user, filename, pages, title) {
	const res = await uploadPdf(user, filename, makePdf({ pages, title }));
	assert.equal(res.body.papers.length, 1, `upload of ${filename} failed`);
	return res.body.papers[0];
}

async function ask(user, question, paperId) {
	const form = new FormData();
	form.append('question', question);
	form.append('history', '[]');
	if (paperId) form.append('paperId', paperId);
	return user.post('/api/chat', { form });
}

// The text Gemini was given for the latest answer (context + question).
const lastContext = () => JSON.stringify(app.fakes.state.gemini.chats.at(-1).history);

before(async () => {
	app = await startApp();
});
afterEach(() => {
	delete process.env.CHAT_FULL_TEXT_MAX_CHARS;
});
after(() => app.stop());

// ---------- Scoring (pure functions) ----------

const m = (paperId, score) => ({ score, meta: { paperId, title: paperId } });

test('several relevant passages beat a single slightly better match', () => {
	const ranked = rankPapers([m('lucky', 0.6), m('solid', 0.5), m('solid', 0.48), m('solid', 0.46)]);
	assert.equal(ranked[0].paperId, 'solid'); // (0.5+0.48+0.46)/3 = 0.48 > 0.6/3 = 0.2
	assert.equal(ranked[0].chunks.length, 3);
});

test('nothing is chosen when even the best chunk is below the minimum', () => {
	assert.equal(choosePaper([m('a', 0.2), m('b', 0.1)], 0.25).paper, null);
	assert.equal(choosePaper([m('a', 0.3)], 0.25).paper.paperId, 'a');
	assert.equal(choosePaper([], 0.25).paper, null);
});

test('the minimum score defaults to the calibrated 0.25 and can be configured', () => {
	const saved = process.env.PAPER_MATCH_MIN_SCORE;
	try {
		delete process.env.PAPER_MATCH_MIN_SCORE;
		assert.equal(minScore(), DEFAULT_MIN_SCORE);
		assert.equal(DEFAULT_MIN_SCORE, 0.25);
		process.env.PAPER_MATCH_MIN_SCORE = '0.4';
		assert.equal(minScore(), 0.4);
		process.env.PAPER_MATCH_MIN_SCORE = 'nonsense';
		assert.equal(minScore(), DEFAULT_MIN_SCORE);
	} finally {
		process.env.PAPER_MATCH_MIN_SCORE = saved;
	}
});

// ---------- A selected paper (by _id) ----------

test('a selected paper is found by id even if its built-in title differs from the filename', async () => {
	const user = await registerUser(app.base, 'titled');
	const paper = await upload(user, 'agentic.pdf', [['The secret word is ZEPHYR.']], 'Agentic Systems');
	assert.equal(paper.title, 'Agentic Systems');

	const res = await ask(user, 'What is the secret word?', paper._id);
	assert.equal(res.status, 200);
	assert.match(lastContext(), /ZEPHYR/);
	assert.match(lastContext(), /Agentic Systems/);
});

test('a selected small paper is given to the model in full', async () => {
	const user = await registerUser(app.base, 'fulltext');
	const words = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT', 'GOLF', 'HOTEL'];
	const pages = words.map((w) => [`Section ${w}: ${'this section discusses experiments '.repeat(12)}${w}.`]);
	const paper = await upload(user, 'sections.pdf', pages);

	assert.equal((await ask(user, 'Summarize the whole paper', paper._id)).status, 200);
	for (const w of words) assert.match(lastContext(), new RegExp(w), `section ${w} missing`);
});

test('a selected long paper is searched within that paper only', async () => {
	const user = await registerUser(app.base, 'longpaper');
	const filler = 'background material repeated '.repeat(10);
	const target = await upload(user, 'long.pdf', [
		[`${filler} The glacier melted rapidly in 2020.`, `${filler} Unrelated notes about budgets.`],
	]);
	await upload(user, 'other.pdf', [['The glacier in another paper is stable.']]);
	process.env.CHAT_FULL_TEXT_MAX_CHARS = '200'; // treat everything as "long"

	const before = app.fakes.state.pinecone.queries.length;
	assert.equal((await ask(user, 'What happened to the glacier?', target._id)).status, 200);
	const query = app.fakes.state.pinecone.queries.slice(before).at(-1);
	assert.deepEqual(query.filter, { paperId: { $eq: target._id } });
	assert.match(lastContext(), /melted rapidly/);
	assert.doesNotMatch(lastContext(), /is stable/);
});

test("another user's paper id, or a malformed id, gets 404 and nothing is sent to the model", async () => {
	const owner = await registerUser(app.base, 'owner4');
	const stranger = await registerUser(app.base, 'stranger4');
	const paper = await upload(owner, 'private.pdf', [['Private result: OBSIDIAN.']]);

	const chatsBefore = app.fakes.state.gemini.chats.length;
	for (const id of [paper._id, 'not-an-id', 'private.pdf']) {
		const res = await ask(stranger, 'What is the private result?', id);
		assert.equal(res.status, 404, `paperId ${id} returned ${res.status}`);
	}
	assert.equal(app.fakes.state.gemini.chats.length, chatsBefore);
});

// ---------- No paper selected: retrieval picks the paper ----------

test('without a selection, the paper is chosen by retrieval (no extra model call)', async () => {
	const user = await registerUser(app.base, 'picker');
	await upload(user, 'penguins.pdf', [['Penguins huddle together to survive Antarctic winters.']]);
	await upload(user, 'volcano.pdf', [['Volcanoes erupt when magma pressure builds beneath the crust.']]);

	const callsBefore = app.fakes.state.gemini.calls.length;
	const res = await ask(user, 'Why do volcanoes erupt? magma pressure crust');
	assert.equal(res.status, 200);
	assert.equal(app.fakes.state.gemini.calls.length, callsBefore, 'no generateContent call to pick a paper');
	assert.match(lastContext(), /magma pressure/);
	assert.doesNotMatch(lastContext(), /Penguins/);
});

test('duplicate uploads of the same paper do not fill the context with copies', async () => {
	const user = await registerUser(app.base, 'dupes');
	const text = [['Agentic retrieval plans multiple search steps before answering.']];
	for (let i = 0; i < 4; i++) await upload(user, `agentic-${i}.pdf`, text);
	await upload(user, 'unrelated.pdf', [['Soil moisture affects crop yields.']]);

	assert.equal((await ask(user, 'How does agentic retrieval plan search steps?')).status, 200);
	const copies = lastContext().split('plans multiple search steps').length - 1;
	assert.equal(copies, 1, `the same passage appeared ${copies} times`);
});

test('an off-topic question gets an honest "not found" instead of a guess', async () => {
	const user = await registerUser(app.base, 'offtopic');
	await upload(user, 'tides.pdf', [['Tidal forces follow lunar orbital mechanics.']]);

	const chatsBefore = app.fakes.state.gemini.chats.length;
	const res = await ask(user, 'Recommend pizza toppings please');
	assert.equal(res.status, 200);
	assert.match(res.body, /couldn't find/i);
	assert.equal(app.fakes.state.gemini.chats.length, chatsBefore, 'the model should not be asked');
});

test('a user with no papers is told to upload one', async () => {
	const user = await registerUser(app.base, 'nopapers');
	const res = await ask(user, 'What is in my papers?');
	assert.equal(res.status, 400);
	assert.match(res.body.error, /no papers/i);
});
