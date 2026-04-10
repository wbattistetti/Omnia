/**
 * Persists a single label string into FlowStore `meta.translations` for one flow (PUT flow-document on save).
 * FLOW.SAVE-BULK REFACTOR — flow-local strings are the persistence path for task:/variable:/… keys; not global API.
 */

import type { Flow } from '@flows/FlowTypes';
import { stripLegacyVariablesFromFlowMeta } from '@flows/flowMetaSanitize';
import { getSubflowSyncFlows, getSubflowSyncUpsertFlowSlice } from '@domain/taskSubflowMove/subflowSyncFlowsRef';

function resolveUpsert(): ((flow: Flow) => void) | null {
  const g = getSubflowSyncUpsertFlowSlice as unknown;
  return typeof g === 'function' ? (g as () => ((flow: Flow) => void) | null)() ?? null : null;
}

function resolveFlows() {
  const g = getSubflowSyncFlows as unknown;
  return typeof g === 'function' ? (g as () => Record<string, Flow>)() ?? {} : {};
}

export function writeTranslationToFlowSlice(flowId: string, labelKey: string, text: string): void {
  const fid = String(flowId || '').trim();
  const lk = String(labelKey || '').trim();
  if (!fid || !lk) return;

  const upsert = resolveUpsert();
  if (!upsert) return;

  const flows = resolveFlows();
  const slice = flows[fid];
  if (!slice) return;

  const prevMeta = (slice.meta && typeof slice.meta === 'object' ? slice.meta : {}) as Flow['meta'];
  const prevTr =
    prevMeta.translations && typeof prevMeta.translations === 'object' ? prevMeta.translations : {};
  const tr = { ...prevTr, [lk]: String(text ?? '') };
  const nextMeta = stripLegacyVariablesFromFlowMeta({
    ...prevMeta,
    translations: tr,
  }) as Flow['meta'];

  upsert({ ...slice, meta: nextMeta, hasLocalChanges: true } as Flow);
}
