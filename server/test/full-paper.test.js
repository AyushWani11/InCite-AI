// Phase 5: summaries and assessments see the whole paper. Normal papers go
// to the model in one request; only documents above the cap use map-reduce,
// with a limit on the number of calls.
const { test, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { startApp, registerUser, uploadPdf } = require('./helpers/harness');
const { makePdf } = require('./helpers/pdf');
const { sampleFromSchema } = require('./helpers/fakes');
const {
	splitIntoSegments,
	mapWithLimit,
	MAX_SEGMENTS,
	PARALLEL_CALLS,
} = require('../utils/fullPaper');

let app, user;
const words = (s) => s.split(/\s+/).filter(Boolean);

// A paper of `pages` pages; page i contains the marker "MARKERi" and is
// long enough that the whole paper is far over the old 7,000-character cut.
function longPaper(pages = 12) {
	return makePdf({
		pages: Array.from({ length: pages }, (_, i) => [
			`Page ${i} discusses result MARKER${i}.`,
			...Array.from({ length: 14 }, () => 'The experiments and analysis continue in detail here with more words.'),
		]),
	});
}

before(async () => {
	app = await startApp();
	user = await registerUser(app.base, 'fullpaper');
});
beforeEach(() => {
	app.fakes.state.gemini.calls = [];
});
afterEach(() => {
	delete process.env.SUMMARY_FULL_TEXT_MAX_CHARS;
	app.fakes.reset();
});
after(() => app.stop());

// ---------- Segmenting (pure) ----------

test('segments follow paragraph boundaries and keep all the text', () => {
	const paras = Array.from({ length: 30 }, (_, i) => `Paragraph ${i} ${'word '.repeat(40)}`.trim());
	const text = paras.join('\n\n');
	const segments = splitIntoSegments(text, 1000, 50);
	assert.ok(segments.length > 1);
	for (const s of segments) assert.ok(s.length <= 1000, `segment of ${s.length}`);
	for (const p of paras) assert.ok(segments.some((s) => s.includes(p)), 'a paragraph was split or lost');
	assert.deepEqual(words(segments.join(' ')), words(text));
});

test('the number of segments is capped; segments grow instead of dropping text', () => {
	const text = Array.from({ length: 400 }, (_, i) => `Para ${i} ${'x '.repeat(60)}`).join('\n\n');
	const segments = splitIntoSegments(text, 1000, 8);
	assert.ok(segments.length <= 8, `${segments.length} segments`);
	assert.deepEqual(words(segments.join(' ')), words(text));
});

test('a long block without blank lines is still split', () => {
	const text = 'line of text '.repeat(1000);
	const segments = splitIntoSegments(text, 1000, 50);
	assert.ok(segments.length > 1);
	for (const s of segments) assert.ok(s.length <= 1000);
});

test('map calls run at most PARALLEL_CALLS at a time and keep their order', async () => {
	let inFlight = 0;
	let peak = 0;
	const out = await mapWithLimit([1, 2, 3, 4, 5, 6, 7], PARALLEL_CALLS, async (x) => {
		inFlight++;
		peak = Math.max(peak, inFlight);
		await new Promise((r) => setTimeout(r, 10));
		inFlight--;
		return x * 10;
	});
	assert.equal(peak, PARALLEL_CALLS);
	assert.deepEqual(out, [10, 20, 30, 40, 50, 60, 70]);
});

// ---------- Through the API ----------

test('a summary sees the end of the paper, in one request', async () => {
	const paper = (await uploadPdf(user, 'long.pdf', longPaper())).body.papers[0]._id;
	app.fakes.state.gemini.calls = [];

	assert.equal((await user.post(`/api/paper/summarize/${paper}`)).status, 200);
	assert.equal(app.fakes.state.gemini.calls.length, 1);
	const prompt = app.fakes.state.gemini.calls[0].prompt;
	assert.ok(prompt.length > 7000, 'the old cut was 7,000 characters');
	assert.match(prompt, /MARKER0/);
	assert.match(prompt, /MARKER11/); // last page
});

test('an assessment sees the end of the paper, in one request', async () => {
	const paper = (await uploadPdf(user, 'long2.pdf', longPaper())).body.papers[0]._id;
	app.fakes.state.gemini.calls = [];

	assert.equal((await user.post(`/api/paper/assess/${paper}`)).status, 200);
	assert.equal(app.fakes.state.gemini.calls.length, 1);
	assert.match(app.fakes.state.gemini.calls[0].prompt, /MARKER11/);
});

test('above the cap, a summary is built by map-reduce over the whole text', async () => {
	const paper = (await uploadPdf(user, 'huge.pdf', longPaper())).body.papers[0]._id;
	process.env.SUMMARY_FULL_TEXT_MAX_CHARS = '3000'; // treat this paper as "huge"
	// Note-taking calls echo the markers they saw; the final call gets JSON.
	app.fakes.state.gemini.generate = ({ prompt, request }) =>
		request.config?.responseJsonSchema
			? JSON.stringify(sampleFromSchema(request.config.responseJsonSchema))
			: `notes: ${(prompt.match(/MARKER\d+/g) || []).join(' ')}`;
	app.fakes.state.gemini.calls = [];

	const res = await user.post(`/api/paper/summarize/${paper}`);
	assert.equal(res.status, 200);

	const calls = app.fakes.state.gemini.calls;
	const noteCalls = calls.filter((c) => !c.request.config?.responseJsonSchema);
	const finalCall = calls.at(-1);
	assert.ok(noteCalls.length >= 1 && noteCalls.length <= MAX_SEGMENTS, `${noteCalls.length} note calls`);
	assert.ok(finalCall.request.config.responseJsonSchema, 'final call returns the structured summary');
	for (let i = 0; i < 12; i++) {
		assert.ok(noteCalls.some((c) => c.prompt.includes(`MARKER${i}`)), `page ${i} was never read`);
		assert.match(finalCall.prompt, new RegExp(`MARKER${i}\\b`), `notes for page ${i} not combined`);
	}
});

test('a PDF with no extractable text gets a clear 422 instead of a made-up summary', async () => {
	const paper = (await uploadPdf(user, 'scan.pdf', makePdf({ pages: [[' ']] }))).body.papers[0]._id;
	app.fakes.state.gemini.calls = [];
	const res = await user.post(`/api/paper/summarize/${paper}`);
	assert.equal(res.status, 422);
	assert.match(res.body.error, /no extractable text/i);
	assert.equal(app.fakes.state.gemini.calls.length, 0);
});

test('keyword extraction at upload deliberately reads only the start of the paper', async () => {
	await uploadPdf(user, 'kw.pdf', longPaper());
	const metadataCall = app.fakes.state.gemini.calls.find((c) => /keywords/i.test(c.prompt));
	assert.ok(metadataCall);
	assert.match(metadataCall.prompt, /MARKER0/);
	assert.doesNotMatch(metadataCall.prompt, /MARKER11/);
});
