/**
 * FLOW.SAVE-BULK REFACTOR — Deterministic routing of translation keys: flow `meta.translations`
 * (per FlowDocument) vs global translations API. Flow-scoped keys use the active canvas for
 * `task:` / `var:` / `interface:` / `slot:` / bare GUID; `flow:<guid>` targets that flow id.
 */

import { getActiveFlowCanvasId } from '@flows/activeFlowCanvas';
import { isUuidString, parseTranslationKey } from '@utils/translationKeys';

const FLOW_SCOPED_KINDS = new Set(['task', 'var', 'interface', 'slot']);

/**
 * Returns the flow canvas id to write `key` into via `writeTranslationToFlowSlice`, or null when
 * the key must persist only via the global translations API (e.g. `runtime.*`).
 */
export function getFlowIdForFlowScopedWrite(key: string): string | null {
  const k = String(key || '').trim();
  if (!k || k.startsWith('runtime.')) return null;

  const parsed = parseTranslationKey(k);
  if (parsed?.kind === 'flow') {
    return parsed.guid;
  }
  if (parsed && FLOW_SCOPED_KINDS.has(parsed.kind)) {
    return getActiveFlowCanvasId();
  }
  if (isUuidString(k)) {
    return getActiveFlowCanvasId();
  }
  return null;
}

/**
 * True when the key should be included in bulk save to the global translations table (not flow-document).
 */
export function shouldPersistTranslationToGlobalApi(key: string): boolean {
  const k = String(key || '').trim();
  if (!k) return false;
  if (k.startsWith('runtime.')) return true;
  const parsed = parseTranslationKey(k);
  if (parsed?.kind === 'flow') return false;
  if (parsed && FLOW_SCOPED_KINDS.has(parsed.kind)) return false;
  if (isUuidString(k)) return false;
  return true;
}
