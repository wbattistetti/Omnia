// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { getAllFunctionNames, getBuiltinFunction } from '../compiler/builtinFunctions';
import { dslFlatVariableDisplayKey, dslTreeNodeDisplayLabel } from '@utils/dslVariableUiLabel';

export type DSLIntellisenseSources = {
  getVariables: () => Record<string, unknown>;
  getVariablesTree: () => any[] | undefined;
  getTranslations: () => Record<string, string>;
};

let intellisenseDisposable: { dispose: () => void } | null = null;

/**
 * Registers DSL completion; variable lists are read via getters on each completion request
 * so labels stay in sync with project translations without re-initializing Monaco.
 */
export function registerDSLIntellisense(monaco: any, sources: DSLIntellisenseSources): void {
  const langId = 'dsl-condition';

  if (intellisenseDisposable) {
    try {
      intellisenseDisposable.dispose();
    } catch (e) {
      console.warn('[DSLIntellisense] Error disposing previous provider', e);
    }
    intellisenseDisposable = null;
  }

  intellisenseDisposable = monaco.languages.registerCompletionItemProvider(langId, {
    provideCompletionItems: () => {
      const variables = sources.getVariables() || {};
      const variablesTree = sources.getVariablesTree();
      const translations = sources.getTranslations() || {};

      const suggestions: any[] = [];

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

      if (variablesTree && Array.isArray(variablesTree) && variablesTree.length > 0) {
        variablesTree.forEach((act: any) => {
          if (act.mains && Array.isArray(act.mains)) {
            const actDisp = dslTreeNodeDisplayLabel(act, translations);
            act.mains.forEach((main: any) => {
              const mainDisp = dslTreeNodeDisplayLabel(main, translations);
              const fullMainLabel = actDisp ? `${actDisp}.${mainDisp}` : mainDisp;

              suggestions.push({
                label: `[${fullMainLabel}]`,
                kind: monaco.languages.CompletionItemKind.Variable,
                insertText: `[${fullMainLabel}]`,
                documentation: `Variable: ${fullMainLabel}`,
              });

              if (main.subs && Array.isArray(main.subs)) {
                main.subs.forEach((sub: any) => {
                  const subDisp = dslTreeNodeDisplayLabel(sub, translations);
                  const fullSubLabel = `${fullMainLabel}.${subDisp}`;
                  suggestions.push({
                    label: `[${fullSubLabel}]`,
                    kind: monaco.languages.CompletionItemKind.Variable,
                    insertText: `[${fullSubLabel}]`,
                    documentation: `Variable: ${fullSubLabel}`,
                  });
                });
              }
            });
          }
        });
      } else {
        Object.keys(variables).forEach((key) => {
          const display = dslFlatVariableDisplayKey(key, translations);
          suggestions.push({
            label: `[${display}]`,
            kind: monaco.languages.CompletionItemKind.Variable,
            insertText: `[${display}]`,
            documentation: `Variable: ${display}`,
          });
        });
      }

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
}
