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
