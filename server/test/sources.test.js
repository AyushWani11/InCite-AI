// Phase 6.4: every answer says where it came from, in an X-Sources header
// (URL-encoded JSON, since header values must be ASCII).
const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { startApp, registerUser, uploadPdf } = require('./helpers/harness');
const { makePdf } = require('./helpers/pdf');

let app, user, smallPaper, longPaper;

const sourcesOf = (res) => {
	const raw = res.headers.get('x-sources');
	return raw === null ? null : JSON.parse(decodeURIComponent(raw));
};

async function ask(question, { paperId, file } = {}) {
	const form = new FormData();
	form.append('question', question);
	form.append('history', '[]');
	if (paperId) form.append('paperId', paperId);
	if (file) form.append('file', new Blob([file.bytes], { type: 'application/pdf' }), file.name);
	return user.post('/api/chat', { form });
}

before(async () => {
	app = await startApp();
	user = await registerUser(app.base, 'sources');
	smallPaper = (
		await uploadPdf(user, 'tides.pdf', makePdf({ pages: [['Tides follow the moon and the sun.']] }))
	).body.papers[0];
	const lines = Array.from(
		{ length: 20 },
		(_, i) => `Glacier note ${i}: the glacier retreated quickly in warm summers ${'and slowly in cold winters '.repeat(6)}.`
	);
	longPaper = (await uploadPdf(user, 'glaciers.pdf', makePdf({ pages: [lines] }))).body.papers[0];
});
afterEach(() => delete process.env.CHAT_FULL_TEXT_MAX_CHARS);
after(() => app.stop());

test('an automatically chosen paper is cited with the excerpts used', async () => {
	const res = await ask('Why did the glacier retreat in warm summers?');
	assert.equal(res.status, 200);
	const [source, ...rest] = sourcesOf(res);
	assert.deepEqual(rest, []);
	assert.equal(source.paperId, longPaper._id);
	assert.equal(source.title, 'glaciers.pdf');
	assert.equal(source.scope, 'excerpts');
	assert.ok(source.excerpts.length >= 1 && source.excerpts.length <= 8);
	assert.deepEqual(source.excerpts, [...source.excerpts].sort((a, b) => a - b), 'sorted');
	// They are the chunks the model was actually given.
	const context = JSON.stringify(app.fakes.state.gemini.chats.at(-1).history);
	assert.equal((context.match(/Excerpt \d+:/g) || []).length, source.excerpts.length);
});

test('a selected short paper is cited as read in full', async () => {
	const res = await ask('What do tides follow?', { paperId: smallPaper._id });
	assert.deepEqual(sourcesOf(res), [{ paperId: smallPaper._id, title: 'tides.pdf', scope: 'full text' }]);
});

test('a selected long paper is cited with its excerpts', async () => {
	process.env.CHAT_FULL_TEXT_MAX_CHARS = '300';
	const res = await ask('What happened in warm summers?', { paperId: longPaper._id });
	const [source] = sourcesOf(res);
	assert.equal(source.scope, 'excerpts');
	assert.equal(source.paperId, longPaper._id);
});

test('an attached file is cited by its name, even with non-ASCII characters', async () => {
	const res = await ask('What is this about?', {
		file: { name: 'Études – océans.pdf', bytes: makePdf({ pages: [['Ocean currents move heat.']] }) },
	});
	assert.equal(res.status, 200);
	assert.deepEqual(sourcesOf(res), [{ title: 'Études – océans.pdf', scope: 'attached file' }]);
});

test('the "not found" reply has no sources', async () => {
	const res = await ask('Recommend pizza toppings please');
	assert.match(res.body, /couldn't find/i);
	assert.equal(sourcesOf(res), null);
});

test('browsers on the frontend site are allowed to read the header (CORS)', async () => {
	const res = await user.get('/api/auth/check-login');
	assert.match(res.headers.get('access-control-expose-headers') || '', /X-Sources/i);
});
