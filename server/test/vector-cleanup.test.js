// Deleting a paper must also delete its searchable chunks in Pinecone,
// otherwise chat keeps quoting papers the user has deleted.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp, registerUser, uploadPdf } = require('./helpers/harness');
const { makePdf } = require('./helpers/pdf');

let app;

const pdfAbout = (word) =>
	makePdf({ pages: [[`This paper is about the ${word}.`, `The ${word} matters a lot.`]] });

async function upload(user, name, word) {
	const res = await uploadPdf(user, name, pdfAbout(word));
	assert.equal(res.body.papers.length, 1);
	return res.body.papers[0]._id;
}

// All stored chunks, as [{ paperId, userId, text }].
function storedChunks() {
	const ns = app.fakes.state.pinecone.namespaces.get('papers') || new Map();
	return [...ns.values()].map((r) => r.metadata);
}

const chunksOf = (paperId) => storedChunks().filter((m) => m.paperId === paperId);

async function askWithoutSelectingAPaper(user, question) {
	const form = new FormData();
	form.append('question', question);
	form.append('history', '[]');
	return user.post('/api/chat', { form });
}

before(async () => {
	app = await startApp();
});
after(() => app.stop());

test('deleting one paper removes its chunks and nobody else’s', async () => {
	const alice = await registerUser(app.base, 'alice');
	const bob = await registerUser(app.base, 'bob');
	const zebra = await upload(alice, 'zebra.pdf', 'zebra');
	const yak = await upload(alice, 'yak.pdf', 'yak');
	const xenon = await upload(bob, 'xenon.pdf', 'xenon');
	assert.ok(chunksOf(zebra).length > 0, 'upload should index chunks');

	assert.equal((await alice.del(`/api/paper/delete/${zebra}`)).status, 200);

	assert.equal(chunksOf(zebra).length, 0, 'deleted paper still has chunks');
	assert.ok(chunksOf(yak).length > 0, "alice's other paper lost its chunks");
	assert.ok(chunksOf(xenon).length > 0, "bob's paper lost its chunks");
});

test('chat cannot quote a paper after it is deleted', async () => {
	const carol = await registerUser(app.base, 'carol');
	const quokka = await upload(carol, 'quokka.pdf', 'quokka');
	await upload(carol, 'otter.pdf', 'otter');

	assert.equal((await carol.del(`/api/paper/delete/${quokka}`)).status, 200);

	const res = await askWithoutSelectingAPaper(carol, 'Tell me about the quokka');
	assert.equal(res.status, 200);
	const sent = JSON.stringify(app.fakes.state.gemini.chats.at(-1).history);
	assert.doesNotMatch(sent, /quokka matters/i, 'deleted paper was used as context');
});

test('delete-all removes all of the caller’s chunks and reports success', async () => {
	const dave = await registerUser(app.base, 'dave');
	const erin = await registerUser(app.base, 'erin');
	await upload(dave, 'one.pdf', 'walrus');
	await upload(dave, 'two.pdf', 'vole');
	const erinPaper = await upload(erin, 'three.pdf', 'urchin');

	const res = await dave.del('/api/paper/delete-all');
	assert.equal(res.status, 200, JSON.stringify(res.body));
	assert.equal(storedChunks().filter((m) => m.userId === dave.id).length, 0);
	assert.ok(chunksOf(erinPaper).length > 0, "erin's chunks were deleted");
});

test('if Pinecone cannot delete, the paper is kept so the user can retry', async () => {
	const frank = await registerUser(app.base, 'frank');
	const paper = await upload(frank, 'tapir.pdf', 'tapir');

	app.fakes.state.pinecone.deleteFails = true;
	try {
		const res = await frank.del(`/api/paper/delete/${paper}`);
		assert.equal(res.status, 500);
	} finally {
		app.fakes.state.pinecone.deleteFails = false;
	}

	// Nothing was half-deleted: the paper and its file are still there.
	assert.equal((await frank.get(`/api/paper/download/${paper}`)).status, 200);
	assert.ok(chunksOf(paper).length > 0);

	// Retrying now works.
	assert.equal((await frank.del(`/api/paper/delete/${paper}`)).status, 200);
	assert.equal(chunksOf(paper).length, 0);
});
