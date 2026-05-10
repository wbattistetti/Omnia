/**
 * Riassegna id ai use case di un batch «aggiungi altri» per evitare collisioni con la lista esistente.
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `uc-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function remapExtendUseCaseIds(incoming: readonly AIAgentUseCase[]): AIAgentUseCase[] {
  const idMap = new Map<string, string>();
  for (const u of incoming) {
    idMap.set(u.id, newId());
  }
  return incoming.map((u) => ({
    ...u,
    id: idMap.get(u.id) ?? newId(),
    parent_id:
      u.parent_id != null && idMap.has(u.parent_id) ? idMap.get(u.parent_id)! : null,
  }));
}
