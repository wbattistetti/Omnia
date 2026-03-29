/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Vitest config: keep resolve.alias in sync with vite.config.ts so tests resolve
 * the same modules as the dev/build pipeline (@responseEditor/core/domain, etc.).
 */
export default defineConfig({
  plugins: [react()],
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
      '@domain': path.resolve(__dirname, 'src/domain'),
      '@flows': path.resolve(__dirname, 'src/flows'),
      '@taskEditor': path.resolve(__dirname, 'src/components/TaskEditor'),
      '@responseEditor': path.resolve(__dirname, 'src/components/TaskEditor/ResponseEditor'),
      '@TaskBuilderAIWizard': path.resolve(__dirname, 'TaskBuilderAIWizard'),
      '@wizard': path.resolve(__dirname, 'src/wizard'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    css: true,
  },
});
