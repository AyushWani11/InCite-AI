// Users often upload files with the same name ("paper.pdf"). Each paper must
// always read, and delete, its own stored PDF, never another user's.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startApp, registerUser, uploadPdf } = require('./helpers/harness');
const { makePdf } = require('./helpers/pdf');

const GOOD_JSON = JSON.stringify({
	summary: 's', contributions: [], methodology: 'm', findings: 'f', conclusion: 'c',
	score: { writingQuality: 'Good', methodology: 'Good', academicStandards: 'Good', overallScore: 70 },
	feedback: { writing: 'w', methodology: 'm', standards: 's' },
	improvementSuggestions: [], issues: [], 'X-Factor': 'x',
});

let app;
const pdfSaying = (word) =>
	makePdf({ pages: [[`${word} is the secret word of this paper.`, `More about ${word}.`]] });

async function upload(user, filename, word) {
	const res = await uploadPdf(user, filename, pdfSaying(word));
	assert.equal(res.status, 201);
	assert.equal(res.body.papers.length, 1, `upload of ${filename} for ${user.name} failed`);
	return res.body.papers[0]._id;
}

// The prompt Gemini received for the most recent generateContent call.
const lastPrompt = () => app.fakes.state.gemini.calls.at(-1).prompt;

async function chat(user, paperId) {
	const form = new FormData();
	form.append('question', 'What is the secret word?');
	form.append('history', '[]');
	form.append('paperId', paperId);
	return user.post('/api/chat', { form });
}

before(async () => {
	app = await startApp();
	app.fakes.state.gemini.generate = () => GOOD_JSON;
});
after(() => app.stop());

test('summarize and assess read the right file when two users share a filename', async () => {
	const alice = await registerUser(app.base, 'alice');
	const bob = await registerUser(app.base, 'bob');
	const alicePaper = await upload(alice, 'paper.pdf', 'ALPHA');
	const bobPaper = await upload(bob, 'paper.pdf', 'BRAVO'); // newer upload

	assert.equal((await alice.post(`/api/paper/summarize/${alicePaper}`)).status, 200);
	assert.match(lastPrompt(), /ALPHA/);
	assert.doesNotMatch(lastPrompt(), /BRAVO/);

	assert.equal((await alice.post(`/api/paper/assess/${alicePaper}`)).status, 200);
	assert.match(lastPrompt(), /ALPHA/);

	assert.equal((await bob.post(`/api/paper/summarize/${bobPaper}`)).status, 200);
	assert.match(lastPrompt(), /BRAVO/);
});

test('chat by filename only opens files the caller uploaded', async () => {
	const carol = await registerUser(app.base, 'carol');
	const dan = await registerUser(app.base, 'dan');
	await upload(carol, 'shared-name.pdf', 'CHARLIE');
	await upload(dan, 'shared-name.pdf', 'DELTA'); // newer upload

	const chatsBefore = app.fakes.state.gemini.chats.length;
	const res = await chat(carol, 'shared-name.pdf');
	assert.equal(res.status, 200);
	const sent = JSON.stringify(app.fakes.state.gemini.chats.at(-1).history);
	assert.match(sent, /CHARLIE/);
	assert.doesNotMatch(sent, /DELTA/);

	// Someone with no file of that name must get nothing from either user.
	const eve = await registerUser(app.base, 'eve');
	const before = app.fakes.state.gemini.chats.length;
	const stranger = await chat(eve, 'shared-name.pdf');
	assert.notEqual(stranger.status, 200);
	const newChats = app.fakes.state.gemini.chats.slice(before);
	assert.ok(
		!JSON.stringify(newChats).match(/CHARLIE|DELTA/),
		"eve's chat received another user's paper"
	);
	assert.ok(chatsBefore < app.fakes.state.gemini.chats.length);
});

test("deleting a paper never deletes another user's file with the same name", async () => {
	const frank = await registerUser(app.base, 'frank');
	const grace = await registerUser(app.base, 'grace');
	const frankPaper = await upload(frank, 'same.pdf', 'FOXTROT');
	const gracePaper = await upload(grace, 'same.pdf', 'GOLF');

	assert.equal((await frank.del(`/api/paper/delete/${frankPaper}`)).status, 200);

	const res = await grace.post(`/api/paper/summarize/${gracePaper}`);
	assert.equal(res.status, 200, "grace's file was deleted along with frank's");
	assert.match(lastPrompt(), /GOLF/);
});

test("delete-all never deletes another user's file with the same name", async () => {
	const heidi = await registerUser(app.base, 'heidi');
	const ivan = await registerUser(app.base, 'ivan');
	await upload(heidi, 'notes.pdf', 'HOTEL');
	const ivanPaper = await upload(ivan, 'notes.pdf', 'INDIA');

	await heidi.del('/api/paper/delete-all');

	const res = await ivan.post(`/api/paper/summarize/${ivanPaper}`);
	assert.equal(res.status, 200, "ivan's file was deleted by heidi's delete-all");
	assert.match(lastPrompt(), /INDIA/);
});

test('papers uploaded before file ids were stored still open their own file', async () => {
	const judy = await registerUser(app.base, 'judy');
	const mallory = await registerUser(app.base, 'mallory');
	const judyPaper = await upload(judy, 'legacy.pdf', 'JULIET');
	await upload(mallory, 'legacy.pdf', 'MIKE'); // newer, same name

	// Simulate an old record: it only knows the filename, not the file id.
	await mongoose.connection.db
		.collection('papers')
		.updateOne({ _id: new mongoose.Types.ObjectId(judyPaper) }, { $unset: { fileId: '' } });

	assert.equal((await judy.post(`/api/paper/summarize/${judyPaper}`)).status, 200);
	assert.match(lastPrompt(), /JULIET/);
	assert.doesNotMatch(lastPrompt(), /MIKE/);
});
