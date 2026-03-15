// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import {
  createSemanticSlot,
  createSemanticValue,
  createSemanticSet,
} from '../core/domain/semantic';
import type { SemanticSlot, SemanticValue, SemanticSet } from '../types/grammarTypes';

/**
 * Factory for creating semantic entities with common configurations
 */
export const semanticFactory = {
  /**
   * Creates a string slot
   */
  createStringSlot: (name: string): SemanticSlot => {
    return createSemanticSlot(name, 'string');
  },

  /**
   * Creates a number slot
   */
  createNumberSlot: (name: string): SemanticSlot => {
    return createSemanticSlot(name, 'number');
  },

  /**
   * Creates a date slot
   */
  createDateSlot: (name: string): SemanticSlot => {
    return createSemanticSlot(name, 'date');
  },

  /**
   * Creates a boolean slot
   */
  createBooleanSlot: (name: string): SemanticSlot => {
    return createSemanticSlot(name, 'boolean');
  },

  /**
   * Creates a semantic value with synonyms
   */
  createValueWithSynonyms: (value: string, synonyms: string[]): SemanticValue => {
    return createSemanticValue(value, synonyms);
  },

  /**
   * Creates an empty semantic set
   */
  createEmptySet: (name: string): SemanticSet => {
    return createSemanticSet(name, []);
  },
};
