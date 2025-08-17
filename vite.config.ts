import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import monacoEditorPlugin from 'vite-plugin-monaco-editor';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), monacoEditorPlugin],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      // FastAPI endpoints
      '/step1': { target: 'http://localhost:8000', changeOrigin: true },
      '/step2': { target: 'http://localhost:8000', changeOrigin: true },
      '/step3': { target: 'http://localhost:8000', changeOrigin: true },
      '/step3b': { target: 'http://localhost:8000', changeOrigin: true },
      '/step4': { target: 'http://localhost:8000', changeOrigin: true },

      // FastAPI namespaced endpoints
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
      '/projects': { target: 'http://localhost:8000', changeOrigin: true },
    }
  }
});
