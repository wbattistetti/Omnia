/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const repoRoot = path.resolve(__dirname);
const domainCoreBundleDir = path.resolve(repoRoot, 'packages/omnia-domain-core/src/usecase/bundle');
const domainCoreLogicDir = path.resolve(repoRoot, 'packages/omnia-domain-core/src/usecase/logic');

/**
 * Vitest config: keep resolve.alias in sync with vite.config.ts so tests resolve
 * the same modules as the dev/build pipeline (@responseEditor/core/domain, etc.).
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@domain\/useCaseBundle\/(.*)$/,
        replacement: `${domainCoreBundleDir}/$1`,
      },
      {
        find: /^@domain\/aiAgentUseCase\/(.*)$/,
        replacement: `${domainCoreLogicDir}/$1`,
      },
      {
        find: '@domain/agentReviewChannel/reviewDocument',
        replacement: path.resolve(
          repoRoot,
          'packages/omnia-domain-core/src/review/reviewDocument.ts'
        ),
      },
      {
        find: '@domain/agentReviewChannel/reviewAudience',
        replacement: path.resolve(
          repoRoot,
          'packages/omnia-domain-core/src/review/reviewAudience.ts'
        ),
      },
      { find: '@services', replacement: path.resolve(__dirname, 'src/services') },
      { find: '@utils', replacement: path.resolve(__dirname, 'src/utils') },
      { find: '@types', replacement: path.resolve(__dirname, 'src/types') },
      { find: '@context', replacement: path.resolve(__dirname, 'src/context') },
      { find: '@hooks', replacement: path.resolve(__dirname, 'src/hooks') },
      { find: '@dock', replacement: path.resolve(__dirname, 'src/dock') },
      { find: '@components', replacement: path.resolve(__dirname, 'src/components') },
      { find: '@ui', replacement: path.resolve(__dirname, 'src/ui') },
      { find: '@features', replacement: path.resolve(__dirname, 'src/features') },
      { find: '@config', replacement: path.resolve(__dirname, 'config') },
      { find: '@lib', replacement: path.resolve(repoRoot, 'src/lib') },
      {
        find: '@omnia/domain-core',
        replacement: path.resolve(repoRoot, 'packages/omnia-domain-core/src'),
      },
      {
        find: '@omnia/domain-components',
        replacement: path.resolve(
          repoRoot,
          'packages/omnia-domain-components/src/index.ts'
        ),
      },
      {
        find: '@domain/useCaseGeneratorWizard',
        replacement: path.resolve(__dirname, 'src/domain/useCaseGeneratorWizard'),
      },
      { find: '@domain', replacement: path.resolve(__dirname, 'src/domain') },
      { find: '@flows', replacement: path.resolve(__dirname, 'src/flows') },
      { find: '@taskEditor', replacement: path.resolve(__dirname, 'src/components/TaskEditor') },
      {
        find: '@responseEditor',
        replacement: path.resolve(__dirname, 'src/components/TaskEditor/ResponseEditor'),
      },
      { find: '@TaskBuilderAIWizard', replacement: path.resolve(__dirname, 'TaskBuilderAIWizard') },
      { find: '@wizard', replacement: path.resolve(__dirname, 'src/wizard') },
      { find: '@workspaces', replacement: path.resolve(__dirname, 'src/workspaces') },
      { find: '@diagnostics', replacement: path.resolve(__dirname, 'src/diagnostics') },
    ],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    css: true,
  },
});
