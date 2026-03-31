// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { GrammarNode } from '../../types/grammarTypes';

/**
 * Constraints between semantic-set / semantic-value bindings and node-level
 * linguistic alternatives (node synonyms). Label/caption may coexist with
 * semantic-set bindings for display; matching is driven by the bound sets.
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

  return { isValid: true };
}
