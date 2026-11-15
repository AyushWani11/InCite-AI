// Summaries, assessments and upload metadata come back from Gemini as JSON.
// Good JSON is used; JSON wrapped in prose is recovered; incomplete or
// garbage output is retried once and then answered with a clean 502.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startApp, registerUser, uploadPdf } = require('./helpers/harness');
const { makePdf } = require('./helpers/pdf');

const SUMMARY = {
	summary: 'A short abstract.',
	contributions: ['A new method.'],
	methodology: 'Controlled experiments.',
	findings: 'It works 12% better.',
	conclusion: 'Promising.',
};
const ASSESSMENT = {
	score: { writingQuality: 'Good', methodology: 'Average', academicStandards: 'Good', overallScore: 72 },
	feedback: { writing: 'Clear.', methodology: 'Small sample.', standards: 'Fine.' },
	improvementSuggestions: ['Add a baseline.'],
	issues: ['No error bars.'],
	'X-Factor': 'Neat idea.',
};

let app, user, paperId;
let replies; // queued Gemini replies for the next calls

const callsFor = (word) => app.fakes.state.gemini.calls.filter((c) => c.prompt.includes(word));

before(async () => {
	app = await startApp();
	user = await registerUser(app.base, 'jsonuser');
	app.fakes.state.gemini.generate = () => (replies.length ? replies.shift() : '{}');
	replies = [JSON.stringify({ authors: ['A. Author'], keywords: ['testing'] })];
	const res = await uploadPdf(user, 'paper.pdf', makePdf({ pages: [['A paper about testing.']] }));
	paperId = res.body.papers[0]._id;
});
beforeEach(() => {
	app.fakes.state.gemini.calls = [];
	replies = [];
});
after(() => app.stop());

test('good JSON is saved and returned', async () => {
	replies = [JSON.stringify(SUMMARY)];
	const res = await user.post(`/api/paper/summarize/${paperId}`);
	assert.equal(res.status, 200);
	assert.deepEqual(res.body.summary, SUMMARY);
	assert.deepEqual((await user.get(`/api/paper/summary/${paperId}`)).body.summary, SUMMARY);
});

test('Gemini is asked for JSON that follows a schema', async () => {
	replies = [JSON.stringify(SUMMARY)];
	await user.post(`/api/paper/summarize/${paperId}`);
	const config = app.fakes.state.gemini.calls.at(-1).request.config;
	assert.equal(config.responseMimeType, 'application/json');
	assert.deepEqual(config.responseJsonSchema.required.sort(), Object.keys(SUMMARY).sort());
});

test('JSON wrapped in text or code fences is still recovered (no retry needed)', async () => {
	replies = ['Sure! Here is the summary:\n```json\n' + JSON.stringify(SUMMARY) + '\n```\nHope this helps.'];
	const res = await user.post(`/api/paper/summarize/${paperId}`);
	assert.equal(res.status, 200);
	assert.deepEqual(res.body.summary, SUMMARY);
	assert.equal(app.fakes.state.gemini.calls.length, 1);
});

test('missing fields are retried once, and a good second answer is used', async () => {
	const { findings, ...incomplete } = SUMMARY;
	replies = [JSON.stringify(incomplete), JSON.stringify(SUMMARY)];
	const res = await user.post(`/api/paper/summarize/${paperId}`);
	assert.equal(res.status, 200);
	assert.deepEqual(res.body.summary, SUMMARY);
	assert.equal(app.fakes.state.gemini.calls.length, 2);
});

test('missing fields twice gives a clean 502 and saves nothing', async () => {
	const fresh = (await uploadPdf(user, 'fresh.pdf', makePdf({ pages: [['Another paper.']] }))).body.papers[0]._id;
	app.fakes.state.gemini.calls = [];
	const { findings, ...incomplete } = SUMMARY;
	replies = [JSON.stringify(incomplete), JSON.stringify(incomplete)];

	const res = await user.post(`/api/paper/summarize/${fresh}`);
	assert.equal(res.status, 502);
	assert.match(res.body.error, /try again/i);
	assert.match(res.body.details, /findings/);
	assert.equal(app.fakes.state.gemini.calls.length, 2);
	assert.equal((await user.get(`/api/paper/summary/${fresh}`)).status, 404);
});

test('garbage twice gives a clean 502 and the server keeps working', async () => {
	replies = ['I cannot do that.', '<<<not json>>>'];
	const res = await user.post(`/api/paper/summarize/${paperId}`);
	assert.equal(res.status, 502);
	assert.equal(typeof res.body.error, 'string');
	assert.equal((await user.get('/api/auth/check-login')).status, 200);
});

test('empty strings for required fields count as missing', async () => {
	const blank = { ...SUMMARY, conclusion: '' };
	replies = [JSON.stringify(blank), JSON.stringify(blank)];
	const res = await user.post(`/api/paper/summarize/${paperId}`);
	assert.equal(res.status, 502);
	assert.match(res.body.details, /conclusion/);
});

test('a good assessment is saved and returned', async () => {
	replies = [JSON.stringify(ASSESSMENT)];
	const res = await user.post(`/api/paper/assess/${paperId}`);
	assert.equal(res.status, 200);
	assert.deepEqual(res.body.assessment, ASSESSMENT);
});

test('assessment values out of range or off the allowed list are rejected', async () => {
	const badScore = structuredClone(ASSESSMENT);
	badScore.score.overallScore = 150;
	const badRating = structuredClone(ASSESSMENT);
	badRating.score.writingQuality = 'Superb';
	replies = [JSON.stringify(badScore), JSON.stringify(badRating)];

	const res = await user.post(`/api/paper/assess/${paperId}`);
	assert.equal(res.status, 502);
	assert.match(res.body.details, /writingQuality|overallScore/);
});

test('an assessment missing a nested field (which would crash the page) is rejected', async () => {
	const noScore = structuredClone(ASSESSMENT);
	delete noScore.score.academicStandards;
	replies = [JSON.stringify(noScore), JSON.stringify(noScore)];
	const res = await user.post(`/api/paper/assess/${paperId}`);
	assert.equal(res.status, 502);
	assert.match(res.body.details, /academicStandards/);
});

test('upload still succeeds when keyword extraction returns garbage', async () => {
	replies = ['nope', 'still nope'];
	const res = await uploadPdf(user, 'kw.pdf', makePdf({ pages: [['Keywords paper.']] }));
	assert.equal(res.status, 201);
	assert.equal(res.body.papers.length, 1);
	assert.deepEqual(res.body.papers[0].keywords, []);
	assert.equal(callsFor('Keywords paper').length, 2, 'one retry, then fall back');
});

test('upload stores extracted authors and keywords when the JSON is good', async () => {
	replies = [JSON.stringify({ authors: ['Ada Lovelace'], keywords: ['engines', 'notes'] })];
	const res = await uploadPdf(user, 'good-kw.pdf', makePdf({ pages: [['Analytical engine notes.']] }));
	assert.deepEqual(res.body.papers[0].authors, ['Ada Lovelace']);
	assert.deepEqual(res.body.papers[0].keywords, ['engines', 'notes']);
});
