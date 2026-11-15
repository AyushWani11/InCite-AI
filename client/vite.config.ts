import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
	// Reads client/.env, .env.local, etc. Only used here, never sent to the
	// browser (that would need the VITE_ prefix).
	const env = loadEnv(mode, process.cwd(), '');

	return {
		plugins: [react(), tailwindcss()],
		// base: process.env.VITE_BASE_PATH || '/InCite-AI',
		server: {
			proxy: {
				// In `npm run dev`, the app calls /api on its own origin and Vite
				// forwards it to the local server (see src/config.ts).
				'/api': {
					target: env.API_PROXY_TARGET || 'http://localhost:5000',
					changeOrigin: true,
				},
			},
		},
	};
});
