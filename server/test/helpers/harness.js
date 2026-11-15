// Starts the real Express app against a throwaway in-memory MongoDB, with
// Gemini and Pinecone replaced by fakes. Each test file gets its own instance.
const fakes = require('./fakes'); // must load before the app
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

async function startApp() {
	// Test-only values. Real keys are never needed: the SDKs are faked.
	process.env.JWT_SECRET = 'test-only-jwt-secret';
	process.env.GEMINI_API_KEY = 'fake-gemini-key';
	process.env.PINECONE_API_KEY = 'fake-pinecone-key';
	process.env.PINECONE_INDEX_NAME = 'test-index';

	const mongo = await MongoMemoryServer.create();
	await mongoose.connect(mongo.getUri());

	const app = require('../../app');
	const server = await new Promise((resolve) => {
		const s = app.listen(0, '127.0.0.1', () => resolve(s));
	});
	const base = `http://127.0.0.1:${server.address().port}`;

	return {
		base,
		fakes,
		async stop() {
			await new Promise((resolve) => server.close(resolve));
			await mongoose.disconnect();
			await mongo.stop();
		},
	};
}

// A minimal browser-like client: remembers the login cookie between calls.
function makeClient(base) {
	let cookie = '';

	async function request(method, path, { json, form } = {}) {
		const headers = {};
		if (cookie) headers.cookie = cookie;
		let body;
		if (json !== undefined) {
			headers['content-type'] = 'application/json';
			body = JSON.stringify(json);
		} else if (form) {
			body = form;
		}

		// A route that never responds should fail the test, not hang the run.
		const res = await fetch(base + path, {
			method,
			headers,
			body,
			signal: AbortSignal.timeout(15000),
		});
		for (const c of res.headers.getSetCookie()) {
			if (c.startsWith('token=')) cookie = c.split(';')[0];
		}

		const type = res.headers.get('content-type') || '';
		let data;
		if (type.includes('application/json')) data = await res.json();
		else if (type.includes('application/pdf')) data = Buffer.from(await res.arrayBuffer());
		else data = await res.text();

		return { status: res.status, body: data, headers: res.headers };
	}

	return {
		request,
		get: (path) => request('GET', path),
		post: (path, opts) => request('POST', path, opts),
		del: (path) => request('DELETE', path),
		get cookie() {
			return cookie;
		},
	};
}

async function registerUser(base, name) {
	const client = makeClient(base);
	const res = await client.post('/api/auth/register', {
		json: {
			username: name,
			email: `${name}@example.com`,
			password: 'password123',
			confirmPassword: 'password123',
		},
	});
	if (res.status !== 200) {
		throw new Error(`register ${name} failed: ${res.status} ${JSON.stringify(res.body)}`);
	}
	const me = await client.get('/api/auth/check-login');
	client.id = me.body.user._id;
	client.name = name;
	return client;
}

async function uploadPdf(client, filename, pdfBuffer) {
	const form = new FormData();
	form.append('files', new Blob([pdfBuffer], { type: 'application/pdf' }), filename);
	return client.post('/api/paper/upload', { form });
}

module.exports = { startApp, makeClient, registerUser, uploadPdf };
