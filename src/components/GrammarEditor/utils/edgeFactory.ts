// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { v4 as uuidv4 } from 'uuid';
import type { GrammarEdge } from '../types/grammarTypes';

/**
 * Factory for creating grammar edges with common configurations
 */
export const edgeFactory = {
  /**
   * Creates a sequential edge
   */
  createSequentialEdge: (source: string, target: string, label?: string): GrammarEdge => {
    return {
      id: uuidv4(),
      source,
      target,
      type: 'sequential',
      label,
    };
  },

  /**
   * Creates an alternative edge
   */
  createAlternativeEdge: (source: string, target: string, label?: string): GrammarEdge => {
    return {
      id: uuidv4(),
      source,
      target,
      type: 'alternative',
      label,
    };
  },

  /**
   * Creates an optional edge
   */
  createOptionalEdge: (source: string, target: string, label?: string): GrammarEdge => {
    return {
      id: uuidv4(),
      source,
      target,
      type: 'optional',
      label,
    };
  },
};
