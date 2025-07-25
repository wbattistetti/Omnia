import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/step1': 'http://localhost:8000',
      '/step2': 'http://localhost:8000',
      '/step3': 'http://localhost:8000',
      '/step3b': 'http://localhost:8000',
      '/step4': 'http://localhost:8000',
      '/api': 'http://localhost:8000',
    }
  }
});
