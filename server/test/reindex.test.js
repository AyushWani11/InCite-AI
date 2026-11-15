// scripts/reindex.js: re-embeds every stored paper into its owner's namespace.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startApp, registerUser, uploadPdf } = require('./helpers/harness');
const { makePdf } = require('./helpers/pdf');
const Paper = require('../models/paper');

let app, reindex, alice, bob, papers;
const quiet = () => {};
const records = (ns) => [...(app.fakes.state.pinecone.namespaces.get(ns)?.values() || [])];
const legacy = () => new Map([['old-1', { id: 'old-1', values: [], metadata: { text: 'old' } }]]);

// Start each test from "old data only": papers in MongoDB/GridFS, nothing in
// the new namespaces, and some vectors in the legacy "papers" namespace.
function resetVectors() {
	app.fakes.state.pinecone.namespaces = new Map([['papers', legacy()]]);
	app.fakes.state.pinecone.indexConfig = {
		dimension: 768,
		metric: 'cosine',
		embed: { model: 'llama-text-embed-v2', fieldMap: { text: 'text' } },
	};
}

before(async () => {
	app = await startApp();
	({ reindex } = require('../scripts/reindex'));
	alice = await registerUser(app.base, 'alice');
	bob = await registerUser(app.base, 'bob');
	const up = async (user, name, line) =>
		(await uploadPdf(user, name, makePdf({ pages: [[line]] }))).body.papers[0]._id;
	papers = {
		a1: await up(alice, 'a1.pdf', 'Alice paper one is about owls.'),
		a2: await up(alice, 'a2.pdf', 'Alice paper two is about hawks.'),
		b1: await up(bob, 'b1.pdf', 'Bob paper one is about trout.'),
	};
});
beforeEach(resetVectors);
after(() => app.stop());

test("every paper is indexed into its owner's namespace", async () => {
	const summary = await reindex({ log: quiet });
	assert.equal(summary.indexed, 3);
	assert.deepEqual(summary.failed, []);

	const inAlice = new Set(records(`v2-${alice.id}`).map((r) => r.metadata.paperId));
	assert.deepEqual([...inAlice].sort(), [papers.a1, papers.a2].sort());
	assert.ok(records(`v2-${bob.id}`).every((r) => r.metadata.paperId === papers.b1));
	assert.match(records(`v2-${bob.id}`)[0].metadata.text, /trout/);
});

test('the legacy "papers" namespace is left exactly as it was', async () => {
	await reindex({ log: quiet });
	assert.equal(app.fakes.state.pinecone.namespaces.get('papers').size, 1);
	const touched = [...app.fakes.state.pinecone.deletes, ...app.fakes.state.pinecone.upsertBatches].filter(
		(op) => op.namespace === 'papers'
	);
	assert.deepEqual(touched, []);
});

test('a dry run reports the plan and writes nothing', async () => {
	const lines = [];
	const summary = await reindex({ dryRun: true, log: (l) => lines.push(l) });
	assert.equal(summary.indexed, 3);
	assert.ok(summary.chunks >= 3);
	assert.deepEqual([...app.fakes.state.pinecone.namespaces.keys()], ['papers']);
	assert.ok(lines.some((l) => l.includes('DRY RUN')));
});

test('running it twice does not duplicate chunks', async () => {
	await reindex({ log: quiet });
	const first = records(`v2-${alice.id}`).length;
	await reindex({ log: quiet });
	assert.equal(records(`v2-${alice.id}`).length, first);
});

test('papers stored before file ids existed are reindexed from their own file', async () => {
	// (Use the model's own collection: Mongoose names it "paper", not "papers".)
	const result = await Paper.collection.updateOne(
		{ _id: new mongoose.Types.ObjectId(papers.b1) },
		{ $unset: { fileId: '' } }
	);
	assert.equal(result.modifiedCount, 1, 'the paper should now look like an old record');
	const summary = await reindex({ log: quiet });
	assert.equal(summary.indexed, 3);
	assert.match(records(`v2-${bob.id}`)[0].metadata.text, /trout/);
});

test('a paper whose PDF is missing is skipped and reported; the rest still run', async () => {
	const doc = await Paper.collection.findOne({ _id: new mongoose.Types.ObjectId(papers.a2) });
	const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'papers' });
	await bucket.delete(doc.fileId);

	const summary = await reindex({ log: quiet });
	assert.deepEqual(summary.skipped, [{ id: papers.a2, reason: 'PDF file missing' }]);
	assert.equal(summary.indexed, 2);
});

test('it refuses an index without integrated embedding, before writing anything', async () => {
	delete app.fakes.state.pinecone.indexConfig.embed;
	await assert.rejects(() => reindex({ log: quiet }), /no integrated embedding/);
	assert.deepEqual([...app.fakes.state.pinecone.namespaces.keys()], ['papers']);
});

test('it refuses an index that embeds a different field', async () => {
	app.fakes.state.pinecone.indexConfig.embed.fieldMap = { text: 'chunk_text' };
	await assert.rejects(() => reindex({ log: quiet }), /chunk_text/);
});
