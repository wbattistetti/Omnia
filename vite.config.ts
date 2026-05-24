import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import monacoEditorPlugin from 'vite-plugin-monaco-editor';
import path from 'path';
import {
  resolveReviewChannelToken,
  reviewChannelProxyOnProxyReq,
} from './config/resolveReviewChannelToken.mjs';
import { expressProxyConfig } from './config/expressProxy.mjs';

const repoRoot = path.resolve(__dirname);
const domainCoreBundleDir = path.resolve(repoRoot, 'packages/omnia-domain-core/src/usecase/bundle');
const domainCoreLogicDir = path.resolve(repoRoot, 'packages/omnia-domain-core/src/usecase/logic');

// https://vitejs.dev/config/
// Support both function and object exports from vite-plugin-monaco-editor
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const monacoAny: any = monacoEditorPlugin as any;
const monacoPlugin = (typeof monacoAny === 'function' ? monacoAny({}) : monacoAny);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, '');
  const reviewToken = resolveReviewChannelToken(repoRoot, env);
  const proxyOnProxyReq = reviewChannelProxyOnProxyReq(reviewToken);
  const expressProxy = () => expressProxyConfig();
  const expressReviewProxy = () =>
    expressProxyConfig(proxyOnProxyReq ? { onProxyReq: proxyOnProxyReq } : {});
  const defineDevToken =
    mode === 'development' && reviewToken
      ? { 'import.meta.env.VITE_REVIEW_DEV_AUTO_TOKEN': JSON.stringify(reviewToken) }
      : {};

  return {
  plugins: [react(), monacoPlugin],
  define: defineDevToken,
  resolve: {
    alias: {
      '@lib': path.resolve(repoRoot, 'src/lib'),
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
      '@omnia/domain-core': path.resolve(repoRoot, 'packages/omnia-domain-core/src'),
      '@omnia/domain-components': path.resolve(
        repoRoot,
        'packages/omnia-domain-components/src/index.ts'
      ),
      '@domain/useCaseBundle/': `${domainCoreBundleDir}/`,
      '@domain/aiAgentUseCase/': `${domainCoreLogicDir}/`,
      '@domain/agentReviewChannel/reviewDocument': path.resolve(
        repoRoot,
        'packages/omnia-domain-core/src/review/reviewDocument.ts'
      ),
      '@domain/agentReviewChannel/reviewAudience': path.resolve(
        repoRoot,
        'packages/omnia-domain-core/src/review/reviewAudience.ts'
      ),
      '@domain': path.resolve(__dirname, 'src/domain'),
      '@diagnostics': path.resolve(__dirname, 'src/diagnostics'),
      /** Single resolution path for flow workspace context (avoids duplicate-module HMR bugs). */
      '@flows': path.resolve(__dirname, 'src/flows'),
      '@taskEditor': path.resolve(__dirname, 'src/components/TaskEditor'),
      '@responseEditor': path.resolve(__dirname, 'src/components/TaskEditor/ResponseEditor'),
      '@TaskBuilderAIWizard': path.resolve(__dirname, 'TaskBuilderAIWizard'),
      '@wizard': path.resolve(__dirname, 'src/wizard'),
      '@workspaces': path.resolve(__dirname, 'src/workspaces'),
      '@reviewPortal': path.resolve(__dirname, 'src/reviewPortal'),
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
        '@lib': path.resolve(repoRoot, 'src/lib'),
        '@omnia/domain-core': path.resolve(repoRoot, 'packages/omnia-domain-core/src'),
      '@omnia/domain-components': path.resolve(
        repoRoot,
        'packages/omnia-domain-components/src/index.ts'
      ),
        '@domain/useCaseBundle/': `${domainCoreBundleDir}/`,
        '@domain/aiAgentUseCase/': `${domainCoreLogicDir}/`,
        '@domain/agentReviewChannel/reviewDocument': path.resolve(
          repoRoot,
          'packages/omnia-domain-core/src/review/reviewDocument.ts'
        ),
        '@domain/agentReviewChannel/reviewAudience': path.resolve(
          repoRoot,
          'packages/omnia-domain-core/src/review/reviewAudience.ts'
        ),
        '@domain/useCaseGeneratorWizard': path.resolve(
          __dirname,
          'src/domain/useCaseGeneratorWizard'
        ),
        '@domain': path.resolve(__dirname, 'src/domain'),
        '@diagnostics': path.resolve(__dirname, 'src/diagnostics'),
        '@flows': path.resolve(__dirname, 'src/flows'),
        '@taskEditor': path.resolve(__dirname, 'src/components/TaskEditor'),
        '@responseEditor': path.resolve(__dirname, 'src/components/TaskEditor/ResponseEditor'),
        '@TaskBuilderAIWizard': path.resolve(__dirname, 'TaskBuilderAIWizard'),
        '@workspaces': path.resolve(__dirname, 'src/workspaces'),
        '@reviewPortal': path.resolve(__dirname, 'src/reviewPortal'),
      },
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/ai': { target: 'http://localhost:8000', changeOrigin: true },
      // FastAPI endpoints
      '/step1': { target: 'http://localhost:8000', changeOrigin: true },
      '/step2': expressProxy(),
      '/design': expressProxy(),
      '/api/analyze-field': expressProxy(),
      '/step3': { target: 'http://localhost:8000', changeOrigin: true },
      '/step3b': { target: 'http://localhost:8000', changeOrigin: true },
      '/step4': { target: 'http://localhost:8000', changeOrigin: true },

      // Express-only runtime routes (Node :3100) — BEFORE catch-all /api/runtime → VB
      '/api/runtime/ai-agent': expressProxy(),
      '/api/runtime/scheduling': expressProxy(),
      '/api/runtime/bookfromagenda': expressProxy(),
      // VB.NET ApiServer endpoints (porta 5000) - MUST come BEFORE Node.js and FastAPI
      '/api/grammar': { target: 'http://localhost:5000', changeOrigin: true },
      '/api/nlp': { target: 'http://localhost:5000', changeOrigin: true },
      '/api/runtime': { target: 'http://localhost:5000', changeOrigin: true },
      /** Backend Call «Test API» proxy — Express :3100 (stesso contratto VB; dev:beNew non avvia ApiServer :5000). */
      '/api/designer': expressProxy(),
      /**
       * ConvAI agents/tools (workspace, catalog) — Express :3100 con `dev:beNew` e backend/.env.
       * ApiServer :5000 espone le stesse route se avviato; per dev senza VB usare 3100.
       */
      '/elevenlabs/agents': expressProxy(),
      '/elevenlabs/tools': expressProxy(),
      '/elevenlabs/createAgent': { target: 'http://localhost:5000', changeOrigin: true },
      '/elevenlabs/startAgent': { target: 'http://localhost:5000', changeOrigin: true },
      '/elevenlabs/sendUserTurn': { target: 'http://localhost:5000', changeOrigin: true },
      '/elevenlabs/agentTurn': { target: 'http://localhost:5000', changeOrigin: true },
      '/elevenlabs/endConversation': { target: 'http://localhost:5000', changeOrigin: true },
      '/elevenlabs': expressProxy(),

      // Node.js backend endpoints (MongoDB) - MUST come BEFORE generic /api
      '/api/factory': expressProxy(),
      '/api/agent-review-channels': expressReviewProxy(),
      '/api/projects': expressReviewProxy(),
      '/api/constants': expressProxy(),
      '/api/embeddings': expressProxy(),
      '/projects': expressProxy(),

      // OpenAPI proxy (Read API) — same FastAPI as below; explicit for clarity
      '/api/openapi-proxy': { target: 'http://localhost:8000', changeOrigin: true },
      /** OAuth portal connections (Google Workspace) — FastAPI :8000 */
      '/api/auth/portal': { target: 'http://localhost:8000', changeOrigin: true },

      // Express IA catalog (Postgres + sync) — before catch-all /api
      '/api/ia-catalog': expressProxy(),

      // Express AI cost tracker — before catch-all /api → FastAPI
      '/api/ai-calls': expressProxy(),

      /** Dev tunnel ngrok (Express) — before catch-all /api → FastAPI */
      '/api/dev-tunnel': expressProxy(),

      // FastAPI namespaced endpoints (other /api routes) - MUST come LAST
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
  preview: {
    proxy: {
      '/design': expressProxy(),
      '/api/designer': expressProxy(),
      '/api/dev-tunnel': expressProxy(),
      '/api/ai-calls': expressProxy(),
      '/api/runtime/ai-agent': expressProxy(),
      '/api/runtime/scheduling': expressProxy(),
      '/api/runtime/bookfromagenda': expressProxy(),
    },
  },
};
});