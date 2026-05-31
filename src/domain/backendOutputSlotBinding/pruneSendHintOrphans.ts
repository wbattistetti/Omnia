/**
 * Rimuove hint SEND le cui surface non compaiono più nei messaggi del catalogo.
 */

import { normalizeSurface } from '@domain/useCaseBundle/projectSlotLexicon';
import type { AgentBackendOutputSlotBindings } from './types';

export function pruneSendHintOrphans(
  bindings: AgentBackendOutputSlotBindings,
  surfacesInCatalog: ReadonlySet<string>
): { bindings: AgentBackendOutputSlotBindings; removedCount: number } {
  const prev = bindings.sendHints ?? [];
  if (prev.length === 0) return { bindings, removedCount: 0 };

  const keep = prev.filter((h) => surfacesInCatalog.has(normalizeSurface(h.surface)));
  const removedCount = prev.length - keep.length;
  if (removedCount === 0) return { bindings, removedCount: 0 };

  return {
    bindings: {
      ...bindings,
      sendHints: keep.length > 0 ? keep : undefined,
    },
    removedCount,
  };
}
