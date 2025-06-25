import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [react(), tailwindcss()],
	// base: process.env.VITE_BASE_PATH || '/InCite-AI',
	server: {
		proxy: {
			'/api': {
				target:
					process.env.BACKEND_URL || 'https://incite-ai-4vrv.onrender.com',
				changeOrigin: true,
				secure: false,
			},
		},
	},
});
