/**
 * Decides whether a new initialGrammar prop should replace the in-memory grammar store.
 * When the parent contract lags behind user edits, the prop can be "smaller" — skip reload.
 */

import type { Grammar } from './types/grammarTypes';

/** Total semantic values across all sets (not just number of sets). */
export function semanticValueCount(g: Grammar | null | undefined): number {
  return g?.semanticSets?.reduce((acc, s) => acc + (s.values?.length ?? 0), 0) ?? 0;
}

export function semanticSetsSerializedEqual(
  a: Grammar | null | undefined,
  b: Grammar | null | undefined
): boolean {
  return JSON.stringify(a?.semanticSets ?? []) === JSON.stringify(b?.semanticSets ?? []);
}

export function storeLooksAheadOfInitialProp(initial: Grammar, store: Grammar): boolean {
  return (
    (initial.nodes?.length ?? 0) < (store.nodes?.length ?? 0) ||
    (initial.edges?.length ?? 0) < (store.edges?.length ?? 0) ||
    (initial.slots?.length ?? 0) < (store.slots?.length ?? 0) ||
    (initial.semanticSets?.length ?? 0) < (store.semanticSets?.length ?? 0) ||
    semanticValueCount(initial) < semanticValueCount(store)
  );
}

export function isGrammarEditorDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem('debug.grammarEditor') === '1';
  } catch {
    return false;
  }
}
