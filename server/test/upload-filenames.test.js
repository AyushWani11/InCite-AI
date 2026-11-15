// Uploaded filenames are UTF-8 (browsers send them that way). They become the
// paper's title when the PDF has no embedded title, so they must survive
// intact, including accents and non-Latin scripts.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp, registerUser, uploadPdf } = require('./helpers/harness');
const { makePdf } = require('./helpers/pdf');

let app, user;

before(async () => {
	app = await startApp();
	user = await registerUser(app.base, 'utf8user');
});
after(() => app.stop());

test('non-ASCII filenames are stored and shown correctly', async () => {
	const name = 'résumé – Müller 東京.pdf';
	const res = await uploadPdf(user, name, makePdf({ pages: [['Some text.']] }));
	assert.equal(res.status, 201);
	const paper = res.body.papers[0];
	assert.equal(paper.filename, name);
	assert.equal(paper.title, name); // no embedded title, so the filename is used
});
