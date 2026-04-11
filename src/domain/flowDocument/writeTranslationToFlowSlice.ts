/**
 * Persists a single label string into FlowStore `meta.translations` for one flow (PUT flow-document on save).
 * FLOW.SAVE-BULK REFACTOR — flow-local strings are the persistence path for task:/var:/… keys; not global API.
 */

import type { Flow } from '@flows/FlowTypes';
import { stripLegacyVariablesFromFlowMeta } from '@flows/flowMetaSanitize';
import { getSubflowSyncFlows, getSubflowSyncUpsertFlowSlice } from '@domain/taskSubflowMove/subflowSyncFlowsRef';
import { getProjectLocale } from '@utils/resolveTranslationEntry';
import { parseTranslationKey } from '@utils/translationKeys';

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
  const parsed = parseTranslationKey(lk);
  let nextEntry: string | Record<string, string>;
  if (parsed?.kind === 'var') {
    const locale = getProjectLocale();
    const prevRaw = prevTr[lk] as string | Record<string, string> | undefined;
    const prevObj =
      prevRaw && typeof prevRaw === 'object' && !Array.isArray(prevRaw)
        ? { ...(prevRaw as Record<string, string>) }
        : typeof prevRaw === 'string'
          ? { [locale]: prevRaw }
          : {};
    nextEntry = { ...prevObj, [locale]: String(text ?? '') };
  } else {
    nextEntry = String(text ?? '');
  }
  const tr = { ...prevTr, [lk]: nextEntry };
  const nextMeta = stripLegacyVariablesFromFlowMeta({
    ...prevMeta,
    translations: tr,
  }) as Flow['meta'];

  upsert({ ...slice, meta: nextMeta, hasLocalChanges: true } as Flow);
}
