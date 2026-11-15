require('dotenv').config();

// The secret that signs and verifies login tokens.
//
// There is deliberately no fallback value. A default secret would be written
// in this public repo, so if the environment variable were ever missing,
// anyone could sign their own valid tokens and log in as any user.
// Refusing to start is safer than starting insecurely.
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
	throw new Error(
		'JWT_SECRET is not set. Add it to server/.env (a long random string).'
	);
}

module.exports = JWT_SECRET;
