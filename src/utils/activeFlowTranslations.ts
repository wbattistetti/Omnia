/**
 * Flattened `meta.translations` for one flow canvas (UI label source for that document).
 * Variable labels resolve via `var:<guid>` keys; values may be per-locale objects in storage.
 */

import { FlowWorkspaceSnapshot } from '../flows/FlowWorkspaceSnapshot';
import type { TranslationEntryValue } from './resolveTranslationEntry';
import { resolveTranslationEntryValue } from './resolveTranslationEntry';

/**
 * Flatten `flow.meta.translations` to string values (current locale).
 * Use when you have a flow document but not necessarily {@link FlowWorkspaceSnapshot} (domain mapper, tests).
 */
export function flattenFlowMetaTranslations(
  flow: { meta?: { translations?: Record<string, unknown> } } | null | undefined
): Record<string, string> {
  const tr = flow?.meta?.translations;
  if (!tr || typeof tr !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tr)) {
    if (!k || v === undefined) continue;
    out[k] = resolveTranslationEntryValue(v as TranslationEntryValue);
  }
  return out;
}

/**
 * Merge flattened `meta.translations` from every flow (project-scoped variable labels when no single canvas applies).
 */
export function mergeFlowMetaTranslationsFromFlows(
  flows: Record<string, { meta?: { translations?: Record<string, unknown> } }> | null | undefined
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const flow of Object.values(flows || {})) {
    const flat = flattenFlowMetaTranslations(flow);
    for (const [k, v] of Object.entries(flat)) {
      if (v !== '') out[k] = v;
    }
  }
  return out;
}

function flattenMetaTranslationsForFlowId(flowId: string): Record<string, string> {
  const flow = FlowWorkspaceSnapshot.getFlowById(flowId);
  return flattenFlowMetaTranslations(flow);
}

/**
 * Returns a flat string table for the given flow's `meta.translations` (current locale for `var:` entries).
 */
export function getFlowMetaTranslationsFlattened(flowId: string): Record<string, string> {
  const fid = String(flowId || '').trim();
  if (!fid) return {};
  return flattenMetaTranslationsForFlowId(fid);
}

/**
 * Active canvas id (same as {@link FlowWorkspaceSnapshot.getActiveFlowId}).
 */
export function getActiveFlowMetaTranslationsFlattened(): Record<string, string> {
  return flattenMetaTranslationsForFlowId(FlowWorkspaceSnapshot.getActiveFlowId());
}
