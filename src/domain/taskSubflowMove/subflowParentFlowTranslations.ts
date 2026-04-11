/**
 * Writes `var:<uuid>` display labels into the parent flow slice `meta.translations` during S2
 * task→subflow moves, keeping a single authoritative copy in `flowsNext` committed by the orchestrator.
 */

import type { WorkspaceState } from '@flows/FlowTypes';
import { stripLegacyVariablesFromFlowMeta } from '../../flows/flowMetaSanitize';
import { isUuidString, makeTranslationKey } from '@utils/translationKeys';

/**
 * Merges one variable display label into `flows[parentFlowId].meta.translations` under `var:<uuid>`.
 */
export function mergeVariableDisplayLabelIntoParentFlowSlice(
  flows: WorkspaceState['flows'],
  parentFlowId: string,
  variableId: string,
  displayLabel: string
): WorkspaceState['flows'] {
  const fid = String(parentFlowId || '').trim();
  const vid = String(variableId || '').trim();
  if (!fid || !vid || !flows[fid]) return flows;
  if (!isUuidString(vid)) return flows;
  const key = makeTranslationKey('var', vid);
  const flow = flows[fid]!;
  const meta = { ...(flow.meta || {}) } as { translations?: Record<string, string> };
  const prevTr =
    meta.translations && typeof meta.translations === 'object' ? meta.translations : {};
  const tr = { ...prevTr, [key]: String(displayLabel ?? '') };
  const nextMeta = stripLegacyVariablesFromFlowMeta({
    ...meta,
    translations: tr,
  }) as typeof flow.meta;
  return {
    ...flows,
    [fid]: { ...flow, meta: nextMeta, hasLocalChanges: true },
  };
}
