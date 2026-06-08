import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Backend port - single source of truth
const BACKEND_PORT = 3002;
const FRONTEND_PORT = 5174;

export default defineConfig({
  plugins: [react()],
  server: {
    port: FRONTEND_PORT,
    strictPort: true, // Fail if port is in use instead of auto-incrementing
    proxy: {
      '/api': {
        target: `http://localhost:${BACKEND_PORT}`,
        changeOrigin: true,
      },
      '/ws': {
        target: `ws://localhost:${BACKEND_PORT}`,
        ws: true,
      },
    },
  },
});
