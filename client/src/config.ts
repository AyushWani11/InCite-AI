// Where the API lives. Import this instead of hardcoding a URL.
//
// Always '/api' on the site's own origin, unless VITE_API_BASE_URL is set at
// build time:
// - Local dev (`npm run dev`): Vite forwards /api to the local server (see
//   vite.config.ts).
// - Production (Vercel): vercel.json forwards /api to the API on Render.
//
// Same origin matters for logging in. When the browser called Render
// directly, the login cookie belonged to another site (a "third-party"
// cookie), which Safari on iPhone and several other browsers block, so the
// login seemed to work and the next request came back 401.
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || '/api';
