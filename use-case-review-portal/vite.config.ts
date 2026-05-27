import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {
  resolveReviewChannelToken,
  reviewChannelProxyOnProxyReq,
} from '../config/resolveReviewChannelToken.mjs';

const root = path.resolve(__dirname, '..');

/**
 * Proxy verso Express Omnia (:3100) e FastAPI (:8000) per Read API backend.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const expressTarget =
    env.VITE_REVIEW_API_TARGET?.trim() ||
    env.VITE_BACKEND_URL?.trim() ||
    'http://127.0.0.1:3100';
  const fastApiTarget =
    env.VITE_REVIEW_FASTAPI_TARGET?.trim() ||
    env.VITE_FASTAPI_URL?.trim() ||
    'http://127.0.0.1:8000';

  const reviewToken = resolveReviewChannelToken(root, env);
  const proxyOnProxyReq = reviewChannelProxyOnProxyReq(reviewToken);

  const proxyCommon = {
    target: expressTarget.replace(/\/$/, ''),
    changeOrigin: true,
    secure: false,
    ...(proxyOnProxyReq ? { configure: (proxy) => proxy.on('proxyReq', proxyOnProxyReq) } : {}),
  };

  const fastApiProxy = {
    target: fastApiTarget.replace(/\/$/, ''),
    changeOrigin: true,
    secure: false,
  };

  /** Local/PoC: token from backend/.env at build time (also for static serve on :3100). */
  const defineReviewAuth: Record<string, string> = {};
  if (reviewToken) {
    defineReviewAuth['import.meta.env.VITE_AGENT_REVIEW_CHANNEL_TOKEN'] =
      JSON.stringify(reviewToken);
    if (mode === 'development') {
      defineReviewAuth['import.meta.env.VITE_REVIEW_DEV_AUTO_TOKEN'] = JSON.stringify(reviewToken);
    }
  }

  const rootNodeModules = path.resolve(root, 'node_modules');

  return {
    plugins: [react()],
    define: defineReviewAuth,
    // In production the portal is served by Express under /review-portal/
    base: mode === 'production' ? '/review-portal/' : '/',
    resolve: {
      dedupe: ['react', 'react-dom', 'zustand'],
      // Root Omnia deps first (npm install dalla root del monorepo)
      modules: [rootNodeModules, path.resolve(__dirname, 'node_modules')],
      alias: {
        '@services': path.resolve(root, 'src/services'),
        '@utils': path.resolve(root, 'src/utils'),
        '@types': path.resolve(root, 'src/types'),
        '@context': path.resolve(root, 'src/context'),
        '@hooks': path.resolve(root, 'src/hooks'),
        '@dock': path.resolve(root, 'src/dock'),
        '@config': path.resolve(root, 'config'),
        '@components': path.resolve(root, 'src/components'),
        '@ui': path.resolve(root, 'src/ui'),
        '@features': path.resolve(root, 'src/features'),
        '@lib': path.resolve(root, 'src/lib'),
        '@taskEditor': path.resolve(root, 'src/components/TaskEditor'),
        '@responseEditor': path.resolve(root, 'src/components/TaskEditor/ResponseEditor'),
        '@TaskBuilderAIWizard': path.resolve(root, 'TaskBuilderAIWizard'),
        '@diagnostics': path.resolve(root, 'src/diagnostics'),
        '@flows': path.resolve(root, 'src/flows'),
        '@workspaces': path.resolve(root, 'src/workspaces'),
        '@reviewPortal': path.resolve(root, 'src/reviewPortal'),
        '@omnia/domain-core': path.resolve(root, 'packages/omnia-domain-core/src'),
        '@domain/useCaseBundle/': `${path.resolve(root, 'packages/omnia-domain-core/src/usecase/bundle')}/`,
        '@domain/aiAgentUseCase/': `${path.resolve(root, 'packages/omnia-domain-core/src/usecase/logic')}/`,
        '@domain/useCaseGeneratorWizard': path.resolve(root, 'src/domain/useCaseGeneratorWizard'),
        '@domain/agentReviewChannel/reviewDocument': path.resolve(
          root,
          'packages/omnia-domain-core/src/review/reviewDocument.ts'
        ),
        '@domain/agentReviewChannel/reviewAudience': path.resolve(
          root,
          'packages/omnia-domain-core/src/review/reviewAudience.ts'
        ),
        '@domain/agentReviewChannel/reviewSnapshots': path.resolve(
          root,
          'packages/omnia-domain-core/src/review/reviewSnapshots.ts'
        ),
        '@domain': path.resolve(root, 'src/domain'),
        '@omnia/domain-components': path.resolve(
          root,
          'packages/omnia-domain-components/src/index.ts'
        ),
      },
    },
    server: {
      port: 5174,
      strictPort: true,
      proxy: {
        '/api/agent-review-channels': proxyCommon,
        '/api/projects': proxyCommon,
        /** Stesse rotte LLM dell'app Omnia (polish, bundle use case, …). */
        '/design': proxyCommon,
        '/api/ai-calls': proxyCommon,
        '/api/ia-catalog': proxyCommon,
        /** Read API OpenAPI (Recupera specifiche backend) — FastAPI */
        '/api/openapi-proxy': fastApiProxy,
        /** OAuth verso portali protetti — FastAPI */
        '/api/auth/portal': fastApiProxy,
      },
    },
  };
});
