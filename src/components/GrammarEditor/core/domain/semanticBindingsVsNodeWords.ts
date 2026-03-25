// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { GrammarNode } from '../../types/grammarTypes';

/**
 * Mutual exclusion between semantic-set / semantic-value bindings and node-level
 * linguistic alternatives used as generic regex branches (synonyms; label when
 * a semantic-set binding is present — the runtime uses label as a word when
 * there are no node synonyms).
 */

export function hasSemanticSetOrValueBinding(node: GrammarNode): boolean {
  return node.bindings.some(
    b => b.type === 'semantic-set' || b.type === 'semantic-value'
  );
}

/**
 * Validates that semantic-set / semantic-value bindings do not coexist with
 * conflicting node words, and that the reverse cannot be constructed.
 */
export function validateSemanticBindingsVsNodeWords(node: GrammarNode): {
  isValid: boolean;
  error?: string;
} {
  const hasSet = node.bindings.some(b => b.type === 'semantic-set');
  const hasValue = node.bindings.some(b => b.type === 'semantic-value');
  if (!hasSet && !hasValue) {
    return { isValid: true };
  }

  if (node.synonyms.length > 0) {
    return {
      isValid: false,
      error:
        'Remove node synonyms before using a semantic set or semantic value on this node (matching must come from semantics only).',
    };
  }

  if (hasSet && node.label.trim().length > 0) {
    return {
      isValid: false,
      error:
        'Clear the node caption when a semantic set is bound (matching uses the set; free text would conflict).',
    };
  }

  return { isValid: true };
}
