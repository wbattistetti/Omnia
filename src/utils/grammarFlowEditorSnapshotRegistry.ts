// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Bridges open GrammarFlow inline editors (per-template Zustand stores in React) to non-React code
 * that must flush in-memory grammar to templates (e.g. project save).
 */

import type { Grammar } from '@components/GrammarEditor/types/grammarTypes';

const REGISTRY_KEY = '__grammarFlowGrammarGetters' as const;

type GetterMap = Map<string, () => Grammar | null>;

function gettersMap(): GetterMap {
  const w = globalThis as typeof globalThis & { [REGISTRY_KEY]?: GetterMap };
  if (!w[REGISTRY_KEY]) {
    w[REGISTRY_KEY] = new Map();
  }
  return w[REGISTRY_KEY]!;
}

/**
 * Registers a snapshot reader for an open GrammarFlow editor keyed by template id.
 * Call the returned function on unmount to unregister.
 */
export function registerGrammarFlowSnapshotGetter(
  templateId: string,
  getGrammar: () => Grammar | null
): () => void {
  const map = gettersMap();
  map.set(templateId, getGrammar);
  return () => {
    map.delete(templateId);
  };
}

export function getGrammarSnapshotForOpenTemplate(templateId: string): Grammar | null {
  const fn = gettersMap().get(templateId);
  return fn ? fn() : null;
}
