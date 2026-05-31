/**
 * Costruisce `tokenBindings` per il JSON conversazionale da snapshot compilato + tabella binding.
 */

import type { PhraseCompiledSnapshot } from '@domain/useCaseBundle/schema';
import { isUnclassifiedSlotId } from '@domain/useCaseBundle/projectSlotLexicon';
import type { AgentBackendOutputSlotBindings, UseCaseTokenBindingJson } from './types';
import { resolveCanonicalSlotIdFromToken } from './resolveCanonicalSlotId';
import { lookupSendHintBySurface } from './mergeSendHints';
import { surfaceForCompiledToken } from './tokenSurfaceResolver';

function resolveSlotBinding(
  token: string,
  canonicalSlotId: string,
  bindings: AgentBackendOutputSlotBindings
): { fillFrom: string; toolName?: string; sendParams?: string[]; format?: string; slotId: string } | null {
  const contract = (bindings.slotContracts ?? []).find((c) => c.slotId === canonicalSlotId);
  if (contract?.receive.trim()) {
    return {
      fillFrom: contract.receive,
      slotId: canonicalSlotId,
      ...(contract.toolName ? { toolName: contract.toolName } : {}),
      ...(contract.send?.length ? { sendParams: [...contract.send] } : {}),
      ...(contract.format ? { format: contract.format } : {}),
    };
  }

  const tokenKey = token.trim().toLowerCase();
  for (const row of bindings.rows) {
    if (row.tokenInPhrase.trim().toLowerCase() === tokenKey && row.apiPath.trim()) {
      return {
        fillFrom: row.apiPath,
        slotId: row.slotId,
        ...(row.format ? { format: row.format } : {}),
      };
    }
  }

  for (const row of bindings.rows) {
    if (row.slotId === canonicalSlotId && row.apiPath.trim()) {
      return {
        fillFrom: row.apiPath,
        slotId: canonicalSlotId,
        ...(row.format ? { format: row.format } : {}),
      };
    }
  }

  return null;
}

export function buildVariantTokenBindings(
  snap: PhraseCompiledSnapshot,
  bindings: AgentBackendOutputSlotBindings
): UseCaseTokenBindingJson[] {
  const out: UseCaseTokenBindingJson[] = [];

  for (const token of snap.tokens) {
    const canonicalSlotId = resolveCanonicalSlotIdFromToken(token);
    if (!canonicalSlotId || isUnclassifiedSlotId(canonicalSlotId)) continue;

    const hit = resolveSlotBinding(token, canonicalSlotId, bindings);
    if (!hit?.fillFrom.trim()) continue;

    const surface = surfaceForCompiledToken(snap, token);
    const sendHint = surface ? lookupSendHintBySurface(bindings, surface) : undefined;

    out.push({
      token,
      slotId: hit.slotId,
      fillFrom: hit.fillFrom,
      ...(hit.toolName ? { toolName: hit.toolName } : {}),
      ...(hit.sendParams?.length ? { sendParams: hit.sendParams } : {}),
      ...(hit.format ? { format: hit.format } : {}),
      ...(sendHint?.role ? { role: sendHint.role } : {}),
      ...(sendHint?.sendPath ? { sendPath: sendHint.sendPath } : {}),
      ...(sendHint?.valueKind ? { valueKind: sendHint.valueKind } : {}),
    });
  }

  return out;
}
