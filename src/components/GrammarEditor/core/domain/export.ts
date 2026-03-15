// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { Grammar } from '../../types/grammarTypes';

/**
 * Exports grammar as-is, without transformations.
 * Pure function: no side effects, deterministic
 * No regex, no NLPEngine, no mapping
 *
 * The VB.NET runtime reads the graph directly:
 * - Traverses nodes
 * - Applies semantic sets
 * - Resolves ambiguities
 * - Extracts slots
 * - Produces output
 */
export function exportGrammar(grammar: Grammar): Grammar {
  return {
    id: grammar.id,
    name: grammar.name,
    nodes: grammar.nodes,
    edges: grammar.edges,
    slots: grammar.slots,
    semanticSets: grammar.semanticSets,
    metadata: grammar.metadata,
  };
}
