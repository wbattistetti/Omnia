/**
 * Proposte deterministiche surface → SEND (sendPath, valueKind, role) validate su allowlist OpenAPI.
 */

import { normalizeSurface } from '@domain/useCaseBundle/projectSlotLexicon';
import type { BackendSendParamLeaf, BackendSendSemanticRole } from '@domain/openApi/backendSendParamCatalog';
import {
  buildSendPathAllowlist,
  pickSendLeafByRole,
  pickSendLeafForBound,
} from '@domain/openApi/backendSendParamCatalog';
import type { SurfaceSendHint, TokenSendRole } from './types';
import {
  buildParameterDestinationCatalog,
  proposeSendHintFromDestinationCatalog,
} from './parameterDestinationTree';
import type { BackendSendLeavesGroup } from './collectBackendSendLeavesByTask';

export type { SurfaceSendRule } from './surfaceSendRules';
export { SURFACE_SEND_RULES } from './surfaceSendRules';

function resolveSendPath(
  leaves: readonly BackendSendParamLeaf[],
  allowlist: ReadonlySet<string>,
  preferRole: BackendSendSemanticRole,
  slotId: string
): string | null {
  if (preferRole === 'horizon_end') {
    const leaf = pickSendLeafForBound(leaves, 'end');
    if (leaf && allowlist.has(leaf.path)) return leaf.path;
  }
  if (preferRole === 'horizon_start') {
    const leaf = pickSendLeafForBound(leaves, 'start');
    if (leaf && allowlist.has(leaf.path)) return leaf.path;
  }

  const byRole = pickSendLeafByRole(leaves, preferRole);
  if (byRole && allowlist.has(byRole.path)) return byRole.path;

  const candidates = leaves.filter((l) => {
    if (!allowlist.has(l.path)) return false;
    if (slotId === 'orario') return /(time|orario|interval|hour)/i.test(l.path);
    return l.semanticRole === preferRole || l.semanticRole === 'value';
  });
  return candidates[0]?.path ?? null;
}

/**
 * Propone un hint SEND per una surface se una regola o lo slot_id combaciano e il path esiste in allowlist.
 */
export function proposeSurfaceSendHint(
  surface: string,
  slotId: string,
  leaves: readonly BackendSendParamLeaf[],
  options?: { toolName?: string; backendTaskId?: string }
): SurfaceSendHint | null {
  if (leaves.length === 0) return null;
  const groups: BackendSendLeavesGroup[] = [
    {
      backendTaskId: options?.backendTaskId?.trim() ?? '',
      toolName: options?.toolName?.trim() ?? '',
      leaves: [...leaves],
    },
  ];
  const catalog = buildParameterDestinationCatalog(groups);
  return proposeSendHintFromDestinationCatalog(surface, slotId, catalog);
}

/**
 * Proposte per più surface (dedupe per surface key).
 */
export function proposeSendHintsForSurfaces(
  items: ReadonlyArray<{ surface: string; slotId: string }>,
  leaves: readonly BackendSendParamLeaf[],
  options?: { toolName?: string; backendTaskId?: string }
): SurfaceSendHint[] {
  const out: SurfaceSendHint[] = [];
  const seen = new Set<string>();
  for (const { surface, slotId } of items) {
    const key = normalizeSurface(surface);
    if (seen.has(key)) continue;
    seen.add(key);
    const hint = proposeSurfaceSendHint(surface, slotId, leaves, options);
    if (hint) out.push(hint);
  }
  return out;
}

export function isSendPathAllowed(sendPath: string, leaves: readonly BackendSendParamLeaf[]): boolean {
  return buildSendPathAllowlist(leaves).has(sendPath.trim());
}
