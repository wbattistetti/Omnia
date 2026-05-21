import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const root = path.resolve(__dirname, '..');

/**
 * Proxy verso Express Omnia (:3100). Solo route review — niente FastAPI :8000.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const expressTarget =
    env.VITE_REVIEW_API_TARGET?.trim() ||
    env.VITE_BACKEND_URL?.trim() ||
    'http://127.0.0.1:3100';

  const proxyCommon = {
    target: expressTarget.replace(/\/$/, ''),
    changeOrigin: true,
    secure: false,
  };

  const rootNodeModules = path.resolve(root, 'node_modules');

  return {
    plugins: [react()],
    // In production the portal is served by Express under /review-portal/
    base: mode === 'production' ? '/review-portal/' : '/',
    resolve: {
      dedupe: ['react', 'react-dom', 'zustand'],
      // Root Omnia deps first (Render: senza npm install alla root fallisce su src/*)
      modules: [rootNodeModules, path.resolve(__dirname, 'node_modules')],
      alias: {
        '@services': path.resolve(root, 'src/services'),
        '@utils': path.resolve(root, 'src/utils'),
        '@types': path.resolve(root, 'src/types'),
        '@context': path.resolve(root, 'src/context'),
        '@hooks': path.resolve(root, 'src/hooks'),
        '@dock': path.resolve(root, 'src/dock'),
        '@components': path.resolve(root, 'src/components'),
        '@ui': path.resolve(root, 'src/ui'),
        '@features': path.resolve(root, 'src/features'),
        '@config': path.resolve(root, 'config'),
        '@domain': path.resolve(root, 'src/domain'),
        '@diagnostics': path.resolve(root, 'src/diagnostics'),
        '@flows': path.resolve(root, 'src/flows'),
        '@taskEditor': path.resolve(root, 'src/components/TaskEditor'),
        '@responseEditor': path.resolve(root, 'src/components/TaskEditor/ResponseEditor'),
        '@TaskBuilderAIWizard': path.resolve(root, 'TaskBuilderAIWizard'),
        '@wizard': path.resolve(root, 'src/wizard'),
        '@workspaces': path.resolve(root, 'src/workspaces'),
      },
    },
    server: {
      port: 5174,
      strictPort: true,
      proxy: {
        '/api/agent-review-channels': proxyCommon,
        '/api/projects': proxyCommon,
      },
    },
  };
});
