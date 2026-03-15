// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { createGrammarNode } from '../core/domain/node';
import type { GrammarNode } from '../types/grammarTypes';

/**
 * Factory for creating grammar nodes with common configurations
 */
export const nodeFactory = {
  /**
   * Creates a simple text node
   */
  createTextNode: (label: string, position: { x: number; y: number }): GrammarNode => {
    return createGrammarNode(label, position);
  },

  /**
   * Creates a node with synonyms
   */
  createNodeWithSynonyms: (
    label: string,
    synonyms: string[],
    position: { x: number; y: number }
  ): GrammarNode => {
    const node = createGrammarNode(label, position);
    return {
      ...node,
      synonyms,
    };
  },

  /**
   * Creates an optional node
   */
  createOptionalNode: (label: string, position: { x: number; y: number }): GrammarNode => {
    const node = createGrammarNode(label, position);
    return {
      ...node,
      optional: true,
    };
  },

  /**
   * Creates a repeatable node
   */
  createRepeatableNode: (label: string, position: { x: number; y: number }): GrammarNode => {
    const node = createGrammarNode(label, position);
    return {
      ...node,
      repeatable: true,
    };
  },
};
