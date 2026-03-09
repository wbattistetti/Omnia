// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { getAllFunctionNames } from '../compiler/builtinFunctions';

/**
 * Registers DSL custom language in Monaco Editor.
 */
export function registerDslLanguage(monaco: any): void {
  const langId = 'dsl-condition';

  // Check if already registered
  const existingLanguages = monaco.languages.getLanguages();
  if (existingLanguages.some((l: any) => l.id === langId)) {
    return; // Already registered
  }

  // Register language
  monaco.languages.register({ id: langId });

  // Get function names for highlighting
  const functionNames = getAllFunctionNames();

  // Define tokenizer (Monarch)
  monaco.languages.setMonarchTokensProvider(langId, {
    keywords: ['AND', 'OR', 'NOT'],
    functions: functionNames,
    operators: ['=', '<>', '>', '<', '>=', '<='],
    booleans: ['TRUE', 'FALSE'],

    tokenizer: {
      root: [
        // Variables: [Name] or [Object.Field]
        [/\[[^\]]+\]/, 'variable'],

        // Strings: "text"
        [/"[^"]*"/, 'string'],

        // Numbers: 123 or 123.45
        [/\d+\.?\d*/, 'number'],

        // Keywords: AND, OR, NOT
        [/AND|OR|NOT/i, {
          cases: {
            '@keywords': 'keyword',
            '@default': 'identifier'
          }
        }],

        // Booleans: TRUE, FALSE
        [/TRUE|FALSE/i, {
          cases: {
            '@booleans': 'boolean',
            '@default': 'identifier'
          }
        }],

        // Functions: LCase, UCase, etc.
        [/[A-Za-z_][A-Za-z0-9_]*/, {
          cases: {
            '@functions': 'function',
            '@keywords': 'keyword',
            '@booleans': 'boolean',
            '@default': 'identifier'
          }
        }],

        // Operators
        [/[=<>]/, {
          cases: {
            '@operators': 'operator',
            '@default': 'delimiter'
          }
        }],

        // Delimiters
        [/[()\[\].,]/, 'delimiter'],

        // Whitespace
        { include: '@whitespace' },
      ],

      whitespace: [
        [/[ \t\r\n]+/, 'white'],
      ],
    },
  });

  // Define theme
  const themeName = 'dsl-condition-theme';
  monaco.editor.defineTheme(themeName, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'C586C0', fontStyle: 'bold' },
      { token: 'function', foreground: 'DCDCAA' },
      { token: 'variable', foreground: '9CDCFE' },
      { token: 'operator', foreground: 'D4D4D4', fontStyle: 'bold' },
      { token: 'string', foreground: 'CE9178' },
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'boolean', foreground: '569CD6' },
      { token: 'delimiter', foreground: 'D4D4D4' },
      { token: 'identifier', foreground: '9CDCFE' },
      { token: 'white', foreground: '808080' },
    ],
    colors: {
      'editor.foreground': '#D4D4D4',
      'editor.background': '#1e1e1e',
      'editorCursor.foreground': '#FFFFFF', // White cursor for dark theme
      'editorCursor.background': '#1e1e1e', // Background behind cursor
    },
  });

  console.log('[registerDslLanguage] ✅ DSL language registered', { langId, themeName });
}
