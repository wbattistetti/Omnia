// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { Grammar } from '../../types/grammarTypes';

/**
 * Serializes Grammar to JSON
 * No transformations, only serialization
 * No engine, no regex, no mapping
 */
export function serializeGrammar(grammar: Grammar): string {
  return JSON.stringify(grammar, null, 2);
}

/**
 * Deserializes JSON to Grammar
 * Useful for import/loading
 */
export function deserializeGrammar(json: string): Grammar {
  return JSON.parse(json) as Grammar;
}
