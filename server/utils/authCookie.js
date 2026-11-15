// Settings for the httpOnly login cookie. Register, login and logout all use
// them: a browser only clears a cookie when the clearing header matches.
//
// Production: the frontend (Vercel) and the API (Render) are different
// sites, so the cookie must be SameSite=None to travel with cross-site
// requests, and browsers only accept SameSite=None together with Secure.
// Local dev: the Vite proxy serves the app and the API from one origin over
// plain http, where Secure cookies are not stored and SameSite=None without
// Secure is rejected, so SameSite=Lax without Secure is what works.
function authCookieOptions() {
	const production = process.env.NODE_ENV === 'production';
	return {
		httpOnly: true,
		secure: production,
		sameSite: production ? 'none' : 'lax',
	};
}

const TOKEN_MAX_AGE_MS = 3 * 60 * 60 * 1000; // matches the JWT's 3h expiry

module.exports = { authCookieOptions, TOKEN_MAX_AGE_MS };
