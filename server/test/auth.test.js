const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { startApp, makeClient, registerUser } = require('./helpers/harness');

let app;
before(async () => {
	app = await startApp();
});
after(async () => {
	await app.stop();
});

test('register sets an httpOnly login cookie that check-login accepts', async () => {
	const client = makeClient(app.base);
	const res = await client.post('/api/auth/register', {
		json: {
			username: 'alice',
			email: 'alice@example.com',
			password: 'password123',
			confirmPassword: 'password123',
		},
	});
	assert.equal(res.status, 200);
	const setCookie = res.headers.getSetCookie().join(';');
	assert.match(setCookie, /token=/);
	assert.match(setCookie, /HttpOnly/i);

	const me = await client.get('/api/auth/check-login');
	assert.equal(me.status, 200);
	assert.equal(me.body.user.username, 'alice');
});

// The Set-Cookie header for the login token with its value redacted, e.g.
// "token=<redacted>; Max-Age=10800; Path=/; HttpOnly; SameSite=Lax".
const tokenCookie = (res) =>
	(res.headers.getSetCookie().find((c) => c.startsWith('token=')) || '').replace(
		/^token=[^;]+/,
		'token=<redacted>'
	);

async function loginAs(email) {
	const client = makeClient(app.base);
	const res = await client.post('/api/auth/login', {
		json: { email, password: 'password123' },
	});
	return { client, res };
}

test('in local dev the login cookie works over plain http (Lax, not Secure)', async () => {
	await registerUser(app.base, 'devcookie');
	const { res } = await loginAs('devcookie@example.com');
	const cookie = tokenCookie(res);

	// Browsers reject SameSite=None without Secure, and Secure needs https,
	// so either of these would stop login from working on http://localhost.
	assert.match(cookie, /SameSite=Lax/i, cookie);
	assert.doesNotMatch(cookie, /;\s*Secure/i, cookie);
});

test('in production the login cookie is SameSite=None; Secure (cross-site)', async () => {
	await registerUser(app.base, 'prodcookie');
	const previous = process.env.NODE_ENV;
	process.env.NODE_ENV = 'production';
	try {
		const { res } = await loginAs('prodcookie@example.com');
		const cookie = tokenCookie(res);
		assert.match(cookie, /SameSite=None/i, cookie);
		assert.match(cookie, /;\s*Secure/i, cookie);
		assert.match(cookie, /HttpOnly/i, cookie);
	} finally {
		if (previous === undefined) delete process.env.NODE_ENV;
		else process.env.NODE_ENV = previous;
	}
});

test('logout clears the cookie with the same attributes it was set with', async () => {
	await registerUser(app.base, 'logoutuser');
	const { client } = await loginAs('logoutuser@example.com');
	const res = await client.post('/api/auth/logout');
	assert.equal(res.status, 200);

	const cookie = tokenCookie(res);
	assert.match(cookie, /Expires=Thu, 01 Jan 1970/i, cookie);
	assert.match(cookie, /SameSite=Lax/i, cookie);
	assert.doesNotMatch(cookie, /;\s*Secure/i, cookie);
});

test('requests without a login cookie get 401', async () => {
	const anon = makeClient(app.base);
	const res = await anon.get('/api/auth/check-login');
	assert.equal(res.status, 401);
});

test('the JWT secret and login tokens never appear in the logs', async () => {
	const lines = [];
	const original = { ...console };
	for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
		console[level] = (...args) => lines.push(args.map(String).join(' '));
	}
	try {
		const client = await registerUser(app.base, 'logcheck');
		await client.post('/api/auth/login', {
			json: { email: 'logcheck@example.com', password: 'password123' },
		});
		await client.get('/api/auth/check-login');
	} finally {
		Object.assign(console, original);
	}

	const output = lines.join('\n');
	assert.ok(!output.includes(process.env.JWT_SECRET), 'secret was logged');
	// Every JWT starts with "eyJ" (base64 of '{"').
	assert.ok(!/eyJ[\w-]+\.[\w-]+\.[\w-]+/.test(output), 'a token was logged');
});

test('the server refuses to start when JWT_SECRET is missing', () => {
	const secretModule = path.join(__dirname, '..', 'utils', 'jwtSecret.js');
	// Run from an empty folder so dotenv cannot pick up a real .env file.
	const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'incite-test-'));
	const env = { ...process.env };
	delete env.JWT_SECRET;

	const result = spawnSync(
		process.execPath,
		['-e', `require(${JSON.stringify(secretModule)})`],
		{ cwd: emptyDir, env, encoding: 'utf8' }
	);
	fs.rmSync(emptyDir, { recursive: true, force: true });

	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /JWT_SECRET is not set/);
});
