/**
 * Builds the single runtime/authoring translation map: global project locale rows merged with
 * all flow slices' `meta.translations`. Flow keys overwrite global keys on conflict (deterministic).
 */

import { FlowWorkspaceSnapshot } from '../flows/FlowWorkspaceSnapshot';

/** Flatten `meta.translations` from every flow in the workspace snapshot; flow ids sorted for stable key order. */
export function flattenFlowMetaTranslationsFromSnapshot(): Record<string, string> {
  const out: Record<string, string> = {};
  const ids = FlowWorkspaceSnapshot.getAllFlowIds().sort();
  for (const fid of ids) {
    const tr = FlowWorkspaceSnapshot.getFlowById(fid)?.meta?.translations;
    if (!tr || typeof tr !== 'object') continue;
    for (const [k, v] of Object.entries(tr)) {
      if (k && v !== undefined) out[k] = String(v);
    }
  }
  return out;
}

/**
 * `compiled = { ...globalMap, ...flowFlatten }` — flow wins on duplicate keys.
 */
export function compileWorkspaceTranslations(globalMap: Record<string, string>): Record<string, string> {
  const flowFlat = flattenFlowMetaTranslationsFromSnapshot();
  return { ...globalMap, ...flowFlat };
}

/** Stable fingerprint for useSyncExternalStore when only flow meta.translations change. */
export function flowWorkspaceMetaTranslationsFingerprint(): string {
  const ids = FlowWorkspaceSnapshot.getAllFlowIds().sort();
  const parts: string[] = [];
  for (const fid of ids) {
    const tr = FlowWorkspaceSnapshot.getFlowById(fid)?.meta?.translations;
    parts.push(`${fid}:${tr ? JSON.stringify(tr) : ''}`);
  }
  return parts.join('\x1e');
}
