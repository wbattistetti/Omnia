import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Architecture rules: prevent cross-feature imports
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@responseEditor/features/*/hooks/*'],
              message: 'Features cannot import hooks from other features. Use core/domain or core/state instead.',
            },
            {
              group: ['@responseEditor/features/*/components/*'],
              message: 'Features cannot import components from other features. Use core/domain or core/state instead.',
            },
          ],
        },
      ],
    },
  },
  // Override for core/domain: prevent React, Zustand, hooks imports
  {
    files: ['src/components/TaskEditor/ResponseEditor/core/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              message: 'Domain layer cannot import React. Domain must remain pure.',
            },
            {
              name: 'zustand',
              message: 'Domain layer cannot import Zustand. Domain must remain pure.',
            },
          ],
          patterns: [
            {
              group: ['@responseEditor/core/state/*'],
              message: 'Domain layer cannot import from state. Domain must remain pure.',
            },
            {
              group: ['@responseEditor/hooks/*'],
              message: 'Domain layer cannot import from hooks. Domain must remain pure.',
            },
          ],
        },
      ],
    },
  }
);
