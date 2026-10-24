// Downloaded-copy configuration only. The original Replit config is preserved.
import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const apiPort = Number(process.env.FORGEFLOW_API_PORT || 3001);
const webPort = Number(process.env.FORGEFLOW_WEB_PORT || 5173);
const proxy = {
  '/api': {
    target: `http://127.0.0.1:${apiPort}`,
    changeOrigin: false,
  },
};

export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
  root: import.meta.dirname,
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(import.meta.dirname, '../../attached_assets'),
    },
    dedupe: ['react', 'react-dom'],
  },
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: { host: '127.0.0.1', port: webPort, strictPort: true, proxy },
  preview: { host: '127.0.0.1', port: webPort, strictPort: true, proxy },
});
