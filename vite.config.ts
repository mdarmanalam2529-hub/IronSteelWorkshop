import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { backupApiMiddleware } from './server/apiMiddleware';

function backupApiPlugin(): Plugin {
  return {
    name: 'backup-api-plugin',
    configureServer(server) {
      server.middlewares.use(backupApiMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(backupApiMiddleware);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), backupApiPlugin()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
