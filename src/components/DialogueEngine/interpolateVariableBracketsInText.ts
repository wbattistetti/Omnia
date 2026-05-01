/**
 * Resolves `[token]` segments in orchestrator/chat text against the runtime VariableStore.
 * Tokens may be variable GUIDs or human-readable labels (mapped via guid→label from the flow).
 */

import { resolveBracketLabelTokenToGuid } from '@utils/conditionCodeConverter';

function runtimeValueTextForInterpolation(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((v) => runtimeValueTextForInterpolation(v)).filter(Boolean).join(', ');
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const semantic = runtimeValueTextForInterpolation(obj.semantic);
    if (semantic) return semantic;
    const linguistic = runtimeValueTextForInterpolation(obj.linguistic);
    if (linguistic) return linguistic;
    const val = runtimeValueTextForInterpolation(obj.value);
    if (val) return val;
    return '';
  }
  return '';
}

function resolveStoreValue(store: Record<string, unknown>, key: string): string | null {
  const raw = store[key];
  if (raw !== undefined && raw !== null) {
    const resolved = runtimeValueTextForInterpolation(raw).trim();
    if (resolved) return resolved;
  }
  const lowerKey = key.toLowerCase();
  for (const [k, v] of Object.entries(store)) {
    if (k.toLowerCase() === lowerKey) {
      const resolved = runtimeValueTextForInterpolation(v).trim();
      if (resolved) return resolved;
    }
  }
  return null;
}

/**
 * Replaces each `[token]` with a display value from `variableStore` when possible.
 * If `guidToDisplayLabel` is provided (Map from variable GUID to flow label), `token` may match
 * the display label and is resolved to GUID before store lookup.
 */
export function interpolateVariableBracketsInText(
  text: string,
  variableStore: Record<string, unknown> | null | undefined,
  guidToDisplayLabel?: Map<string, string> | null
): string {
  if (!text) return text;
  const store =
    variableStore != null && typeof variableStore === 'object' && !Array.isArray(variableStore)
      ? variableStore
      : {};
  if (Object.keys(store).length === 0) return text;

  return text.replace(/\[\s*([^\[\]]+?)\s*\]/g, (full, token) => {
    const key = String(token || '').trim();
    if (!key) return full;

    const direct = resolveStoreValue(store, key);
    if (direct) return direct;

    const map = guidToDisplayLabel;
    if (map && map.size > 0) {
      const guid = resolveBracketLabelTokenToGuid(key, map);
      if (guid) {
        const viaGuid = resolveStoreValue(store, guid);
        if (viaGuid) return viaGuid;
      }
    }

    return full;
  });
}
