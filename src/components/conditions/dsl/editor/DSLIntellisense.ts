// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { getAllFunctionNames, getBuiltinFunction } from '../compiler/builtinFunctions';

// Global flag to track if intellisense is already registered
let isIntellisenseRegistered = false;
let intellisenseDisposable: any = null;

/**
 * Provides intellisense for DSL editor.
 */
export function registerDSLIntellisense(monaco: any, variables: Record<string, any>, variablesTree?: any[]): void {
  const langId = 'dsl-condition';

  // Dispose previous provider if exists
  if (intellisenseDisposable) {
    try {
      intellisenseDisposable.dispose();
    } catch (e) {
      console.warn('[DSLIntellisense] Error disposing previous provider', e);
    }
    intellisenseDisposable = null;
  }

  // Register completion item provider
  intellisenseDisposable = monaco.languages.registerCompletionItemProvider(langId, {
    provideCompletionItems: (model: any, position: any) => {
      const textUntilPosition = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      const suggestions: any[] = [];

      // Function completions
      const functionNames = getAllFunctionNames();
      functionNames.forEach((fnName) => {
        const fnDef = getBuiltinFunction(fnName);
        if (fnDef) {
          suggestions.push({
            label: fnName,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: `${fnName}($0)`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: fnDef.description,
            detail: `Function: ${fnName}(${fnDef.minArgs}-${fnDef.maxArgs} args)`,
          });
        }
      });

      // Variable completions
      if (variablesTree && Array.isArray(variablesTree)) {
        variablesTree.forEach((act: any) => {
          if (act.mains && Array.isArray(act.mains)) {
            act.mains.forEach((main: any) => {
              // Main variable
              suggestions.push({
                label: `[${main.label}]`,
                kind: monaco.languages.CompletionItemKind.Variable,
                insertText: `[${main.label}]`,
                documentation: `Variable: ${main.label}`,
              });

              // Sub variables
              if (main.subs && Array.isArray(main.subs)) {
                main.subs.forEach((sub: any) => {
                  suggestions.push({
                    label: `[${main.label}.${sub.label}]`,
                    kind: monaco.languages.CompletionItemKind.Variable,
                    insertText: `[${main.label}.${sub.label}]`,
                    documentation: `Variable: ${main.label}.${sub.label}`,
                  });
                });
              }
            });
          }
        });
      } else {
        // Fallback: use flat variables map
        Object.keys(variables).forEach((varName) => {
          suggestions.push({
            label: `[${varName}]`,
            kind: monaco.languages.CompletionItemKind.Variable,
            insertText: `[${varName}]`,
            documentation: `Variable: ${varName}`,
          });
        });
      }

      // Keyword completions
      suggestions.push(
        {
          label: 'AND',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'AND',
          documentation: 'Logical AND operator',
        },
        {
          label: 'OR',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'OR',
          documentation: 'Logical OR operator',
        },
        {
          label: 'NOT',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'NOT',
          documentation: 'Logical NOT operator',
        },
        {
          label: 'TRUE',
          kind: monaco.languages.CompletionItemKind.Value,
          insertText: 'TRUE',
          documentation: 'Boolean true',
        },
        {
          label: 'FALSE',
          kind: monaco.languages.CompletionItemKind.Value,
          insertText: 'FALSE',
          documentation: 'Boolean false',
        }
      );

      return { suggestions };
    },
  });

  isIntellisenseRegistered = true;
  console.log('[DSLIntellisense] ✅ Intellisense registered', { langId });
}

/**
 * Dispose intellisense provider (cleanup).
 */
export function disposeDSLIntellisense(): void {
  if (intellisenseDisposable) {
    try {
      intellisenseDisposable.dispose();
    } catch (e) {
      console.warn('[DSLIntellisense] Error disposing provider', e);
    }
    intellisenseDisposable = null;
  }
  isIntellisenseRegistered = false;
}
