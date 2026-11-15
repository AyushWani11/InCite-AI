// Gemini text generation: model from configuration, and chat streaming that
// handles errors without taking the server down.
const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { startApp, registerUser } = require('./helpers/harness');
const { makePdf } = require('./helpers/pdf');

let app, user;

// Chat about an attached PDF (no Pinecone involved).
async function chatAboutFile(question, history = []) {
	const form = new FormData();
	form.append('question', question);
	form.append('history', JSON.stringify(history));
	form.append(
		'file',
		new Blob([makePdf({ pages: [['The paper studies coral reef recovery after bleaching.']] })], {
			type: 'application/pdf',
		}),
		'reef.pdf'
	);
	return user.post('/api/chat', { form });
}

before(async () => {
	app = await startApp();
	user = await registerUser(app.base, 'llmuser');
});
afterEach(() => {
	delete process.env.GEMINI_MODEL;
	app.fakes.state.gemini.chatReply = () => 'fake answer';
});
after(() => app.stop());

test('the model defaults to gemini-3.6-flash', async () => {
	delete process.env.GEMINI_MODEL;
	assert.equal((await chatAboutFile('What does the paper study?')).status, 200);
	assert.equal(app.fakes.state.gemini.chats.at(-1).model, 'gemini-3.6-flash');
});

test('GEMINI_MODEL switches the model without code changes', async () => {
	process.env.GEMINI_MODEL = 'gemini-3.8-flash';
	assert.equal((await chatAboutFile('What does the paper study?')).status, 200);
	assert.equal(app.fakes.state.gemini.chats.at(-1).model, 'gemini-3.8-flash');
});

test('the answer is streamed back to the client', async () => {
	app.fakes.state.gemini.chatReply = () => ['Coral reefs ', 'recover ', 'slowly.'];
	const res = await chatAboutFile('What does the paper study?');
	assert.equal(res.status, 200);
	assert.equal(res.body, 'Coral reefs recover slowly.');
});

test('if Gemini rejects the request, the client gets a clean 500', async () => {
	app.fakes.state.gemini.chatReply = () => {
		throw new Error('model not found');
	};
	const res = await chatAboutFile('What does the paper study?');
	assert.equal(res.status, 500);
	assert.deepEqual(res.body, { error: 'AI generation failed.' });
});

test('a failure halfway through an answer ends the response and the server stays up', async () => {
	app.fakes.state.gemini.chatReply = () => ['Coral reefs ', new Error('stream interrupted')];
	const res = await chatAboutFile('What does the paper study?');
	assert.equal(res.status, 200); // already started streaming
	assert.equal(res.body, 'Coral reefs ');
	assert.equal((await user.get('/api/auth/check-login')).status, 200);
});

test('Gemini gets alternating turns and the question only once', async () => {
	const history = [
		{ role: 'user', text: 'First question about reefs?' },
		{ role: 'assistant', text: 'First answer.' },
		{ role: 'user', text: 'A question whose answer failed?' },
	];
	assert.equal((await chatAboutFile('What does the paper study?', history)).status, 200);

	const contents = app.fakes.state.gemini.chats.at(-1).history;
	const roles = contents.map((c) => c.role);
	for (let i = 1; i < roles.length; i++) {
		assert.notEqual(roles[i], roles[i - 1], `consecutive "${roles[i]}" turns: ${roles}`);
	}
	assert.equal(roles.at(-1), 'user');
	const sentText = JSON.stringify(contents);
	assert.equal(sentText.split('What does the paper study?').length - 1, 1);
});
