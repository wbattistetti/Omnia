import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import monacoEditorPlugin from 'vite-plugin-monaco-editor';

// https://vitejs.dev/config/
// Support both function and object exports from vite-plugin-monaco-editor
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const monacoAny: any = monacoEditorPlugin as any;
const monacoPlugin = (typeof monacoAny === 'function' ? monacoAny({}) : monacoAny);

export default defineConfig({
  plugins: [react(), monacoPlugin],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/ai': { target: 'http://localhost:8000', changeOrigin: true },
      // FastAPI endpoints
      '/step1': { target: 'http://localhost:8000', changeOrigin: true },
      '/step2': { target: 'http://localhost:3100', changeOrigin: true },
      '/api/analyze-field': { target: 'http://localhost:3100', changeOrigin: true },
      '/step3': { target: 'http://localhost:8000', changeOrigin: true },
      '/step3b': { target: 'http://localhost:8000', changeOrigin: true },
      '/step4': { target: 'http://localhost:8000', changeOrigin: true },

      // Node.js backend endpoints (MongoDB)
      '/api/factory': { target: 'http://localhost:3100', changeOrigin: true },
      '/api/projects': { target: 'http://localhost:3100', changeOrigin: true },
      '/projects': { target: 'http://localhost:3100', changeOrigin: true },

      // FastAPI namespaced endpoints (other /api routes)
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    }
  }
});