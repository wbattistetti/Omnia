// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { GrammarNode, Grammar } from '../types/grammarTypes';

/**
 * Caption on the canvas: uses `node.label` when set; otherwise falls back to the
 * bound semantic set name when the label is empty.
 */
export function getGrammarNodeDisplayCaption(node: GrammarNode, grammar: Grammar | null): string {
  const trimmed = node.label.trim();
  if (trimmed.length > 0) {
    return trimmed;
  }
  const setBinding = node.bindings.find(b => b.type === 'semantic-set');
  if (setBinding && grammar) {
    const set = grammar.semanticSets.find(s => s.id === setBinding.setId);
    if (set?.name?.trim()) {
      return set.name.trim();
    }
  }
  return '';
}
