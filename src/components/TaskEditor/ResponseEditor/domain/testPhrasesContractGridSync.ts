/**
 * Single place for rules that keep TesterGrid rows and DataContract.testPhrases aligned.
 * Contract updates (GrammarFlow, template reload) must apply to the grid in the same
 * React update as setLocalContract to avoid racing ExamplesPersistence with stale rows.
 */

import type { DataContract } from '@components/DialogueDataEngine/contracts/contractLoader';

/**
 * True when the contract patch intentionally carries testPhrases (including explicit clear).
 * Partial engine-only updates typically omit the key.
 */
export function contractPatchIncludesTestPhrases(
  contract: DataContract | null | undefined
): boolean {
  if (!contract || typeof contract !== 'object') return false;
  return Object.prototype.hasOwnProperty.call(contract, 'testPhrases');
}

/**
 * Normalized list for the grid from contract.testPhrases (undefined or missing → []).
 */
export function testPhrasesArrayFromContract(
  contract: DataContract | null | undefined
): string[] {
  if (!contract) return [];
  const tp = contract.testPhrases;
  return Array.isArray(tp) ? [...tp] : [];
}

/**
 * Derives what to persist on template/node when grid state may lag contract by one frame.
 * Priority: non-empty grid → explicit contract field → resolver snapshot.
 */
export function derivePersistableTestPhrases(input: {
  examplesList: string[];
  contractTestPhrases: string[] | undefined;
  resolvedTestPhrases: string[] | undefined;
}): string[] | undefined {
  const { examplesList, contractTestPhrases, resolvedTestPhrases } = input;

  if (examplesList.length > 0) {
    return [...examplesList];
  }
  if (contractTestPhrases && contractTestPhrases.length > 0) {
    return [...contractTestPhrases];
  }
  if (resolvedTestPhrases && resolvedTestPhrases.length > 0) {
    return [...resolvedTestPhrases];
  }
  return undefined;
}
