/**
 * Decides whether a new initialGrammar prop should replace the in-memory grammar store.
 * When the parent contract lags behind user edits, the prop can be "smaller" — skip reload.
 */

import type { Grammar } from './types/grammarTypes';

export function storeLooksAheadOfInitialProp(initial: Grammar, store: Grammar): boolean {
  return (
    (initial.nodes?.length ?? 0) < (store.nodes?.length ?? 0) ||
    (initial.edges?.length ?? 0) < (store.edges?.length ?? 0) ||
    (initial.slots?.length ?? 0) < (store.slots?.length ?? 0) ||
    (initial.semanticSets?.length ?? 0) < (store.semanticSets?.length ?? 0)
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
