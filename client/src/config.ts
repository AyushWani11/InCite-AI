// Where the API lives. Import this instead of hardcoding a URL.
//
// - Local dev (`npm run dev`): '/api'. Vite forwards it to the local server
//   (see vite.config.ts), so the browser sees a single origin and the login
//   cookie works over plain http://localhost.
// - Production build: the deployed API, unless VITE_API_BASE_URL is set at
//   build time (for example in Vercel's environment variables).
export const API_BASE_URL: string =
	import.meta.env.VITE_API_BASE_URL ||
	(import.meta.env.DEV ? '/api' : 'https://incite-ai-4vrv.onrender.com/api');
