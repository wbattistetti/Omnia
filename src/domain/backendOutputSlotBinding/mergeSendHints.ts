/**
 * Merge hint SEND surface → path nel blob binding persistito.
 */

import { normalizeSurface } from '@domain/useCaseBundle/projectSlotLexicon';
import type { AgentBackendOutputSlotBindings, SurfaceSendHint } from './types';
import { isSendPathAllowed } from './surfaceSendHints';
import type { BackendSendParamLeaf } from '@domain/openApi/backendSendParamCatalog';

function hintKey(surface: string): string {
  return normalizeSurface(surface);
}

/**
 * Unisce proposte; le voci `approved` non vengono sovrascritte.
 */
export function mergeSendHintsIntoBindings(
  bindings: AgentBackendOutputSlotBindings,
  proposed: readonly SurfaceSendHint[],
  leaves: readonly BackendSendParamLeaf[]
): AgentBackendOutputSlotBindings {
  const prev = bindings.sendHints ?? [];
  const bySurface = new Map<string, SurfaceSendHint>();
  for (const h of prev) {
    bySurface.set(hintKey(h.surface), h);
  }

  for (const p of proposed) {
    if (!isSendPathAllowed(p.sendPath, leaves)) continue;
    const key = hintKey(p.surface);
    const existing = bySurface.get(key);
    if (existing?.approved) continue;
    bySurface.set(key, {
      ...p,
      surface: key,
      ...(existing?.approved ? { approved: true } : {}),
    });
  }

  return {
    ...bindings,
    sendHints: [...bySurface.values()].sort((a, b) => a.surface.localeCompare(b.surface)),
  };
}

export function lookupSendHintBySurface(
  bindings: AgentBackendOutputSlotBindings,
  surface: string
): SurfaceSendHint | undefined {
  const key = hintKey(surface);
  return (bindings.sendHints ?? []).find((h) => hintKey(h.surface) === key);
}

export function updateSendHintForSurface(
  bindings: AgentBackendOutputSlotBindings,
  surface: string,
  patch: Partial<Pick<SurfaceSendHint, 'sendPath' | 'valueKind' | 'role' | 'slotId' | 'toolName'>>,
  leaves: readonly BackendSendParamLeaf[]
): AgentBackendOutputSlotBindings {
  const key = hintKey(surface);
  const prev = bindings.sendHints ?? [];
  const idx = prev.findIndex((h) => hintKey(h.surface) === key);
  const base =
    idx >= 0
      ? prev[idx]
      : {
          surface: key,
          slotId: patch.slotId ?? 'undefined',
          role: 'value' as const,
          sendPath: '',
        };

  const next: SurfaceSendHint = {
    ...base,
    ...patch,
    surface: key,
    slotId: (patch.slotId ?? base.slotId).trim().toLowerCase() || base.slotId,
  };
  if (next.sendPath.trim() && !isSendPathAllowed(next.sendPath, leaves)) {
    return bindings;
  }

  const sendHints = [...prev];
  if (idx >= 0) sendHints[idx] = next;
  else sendHints.push(next);
  sendHints.sort((a, b) => a.surface.localeCompare(b.surface));
  return { ...bindings, sendHints };
}
