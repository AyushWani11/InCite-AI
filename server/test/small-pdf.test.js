// Small PDFs (under ~32 KB on Node 26) must parse every time, on every path
// that reads a PDF: upload, summarize/assess, and chat with an attached file.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp, registerUser, uploadPdf } = require('./helpers/harness');
const { makePdf } = require('./helpers/pdf');

const ATTEMPTS = 10;

let app, user;

const tinyPdf = (i) =>
	makePdf({ pad: false, pages: [[`Tiny paper number ${i} about lichens.`]] });

before(async () => {
	app = await startApp();
	user = await registerUser(app.base, 'smallpdf');
});
after(() => app.stop());

test('the test PDFs really are small', () => {
	assert.ok(tinyPdf(0).length < 2048, `tiny PDF is ${tinyPdf(0).length} bytes`);
});

test(`${ATTEMPTS} small PDFs upload and summarize without a parse failure`, async () => {
	for (let i = 0; i < ATTEMPTS; i++) {
		const res = await uploadPdf(user, `tiny-${i}.pdf`, tinyPdf(i));
		assert.equal(res.status, 201);
		assert.equal(res.body.papers.length, 1, `upload ${i} failed to parse`);

		const paperId = res.body.papers[0]._id;
		const sum = await user.post(`/api/paper/summarize/${paperId}`);
		assert.equal(sum.status, 200, `summarize ${i} returned ${sum.status}`);
		assert.match(app.fakes.state.gemini.calls.at(-1).prompt, new RegExp(`number ${i} about lichens`));
	}
});

test(`${ATTEMPTS} small PDFs attached to a chat message are read`, async () => {
	for (let i = 0; i < ATTEMPTS; i++) {
		const form = new FormData();
		form.append('question', 'What is this paper about?');
		form.append('history', '[]');
		form.append('file', new Blob([tinyPdf(i)], { type: 'application/pdf' }), `chat-${i}.pdf`);

		const res = await user.post('/api/chat', { form });
		assert.equal(res.status, 200, `chat ${i} returned ${res.status}`);
		const sent = JSON.stringify(app.fakes.state.gemini.chats.at(-1).history);
		assert.match(sent, new RegExp(`number ${i} about lichens`), `chat ${i} lost the file text`);
	}
});
