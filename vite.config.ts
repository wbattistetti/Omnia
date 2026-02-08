import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import monacoEditorPlugin from 'vite-plugin-monaco-editor';
import path from 'path';

// https://vitejs.dev/config/
// Support both function and object exports from vite-plugin-monaco-editor
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const monacoAny: any = monacoEditorPlugin as any;
const monacoPlugin = (typeof monacoAny === 'function' ? monacoAny({}) : monacoAny);

export default defineConfig({
  plugins: [react(), monacoPlugin],
  resolve: {
    alias: {
      '@services': path.resolve(__dirname, 'src/services'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@types': path.resolve(__dirname, 'src/types'),
      '@context': path.resolve(__dirname, 'src/context'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
      '@dock': path.resolve(__dirname, 'src/dock'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@ui': path.resolve(__dirname, 'src/ui'),
      '@features': path.resolve(__dirname, 'src/features'),
      '@config': path.resolve(__dirname, 'config'),
      '@taskEditor': path.resolve(__dirname, 'src/components/TaskEditor'),
      '@responseEditor': path.resolve(__dirname, 'src/components/TaskEditor/ResponseEditor'),
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    resolve: {
      alias: {
        '@services': path.resolve(__dirname, 'src/services'),
        '@utils': path.resolve(__dirname, 'src/utils'),
        '@types': path.resolve(__dirname, 'src/types'),
        '@context': path.resolve(__dirname, 'src/context'),
        '@hooks': path.resolve(__dirname, 'src/hooks'),
        '@dock': path.resolve(__dirname, 'src/dock'),
        '@components': path.resolve(__dirname, 'src/components'),
        '@ui': path.resolve(__dirname, 'src/ui'),
        '@features': path.resolve(__dirname, 'src/features'),
        '@config': path.resolve(__dirname, 'config'),
        '@taskEditor': path.resolve(__dirname, 'src/components/TaskEditor'),
        '@responseEditor': path.resolve(__dirname, 'src/components/TaskEditor/ResponseEditor'),
      }
    }
  },
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

      // Node.js backend endpoints (MongoDB) - MUST come BEFORE generic /api
      '/api/factory': { target: 'http://localhost:3100', changeOrigin: true },
      '/api/projects': { target: 'http://localhost:3100', changeOrigin: true },
      '/api/constants': { target: 'http://localhost:3100', changeOrigin: true },
      '/api/runtime': { target: 'http://localhost:3100', changeOrigin: true },
      '/projects': { target: 'http://localhost:3100', changeOrigin: true },

      // FastAPI namespaced endpoints (other /api routes) - MUST come LAST
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    }
  }
});