/**
 * Suppresses duplicate NODE_POSITION_COMMITTED applies (StrictMode twin hosts / double subscribers).
 */

import type { NodePositionUpdate } from './flowCanvasSemanticEvents';

const lastByFlow = new Map<string, { fp: string; at: number }>();

const DEDUPE_MS = 48;

function fingerprintUpdates(updates: readonly NodePositionUpdate[]): string {
  return updates
    .map((u) => `${u.nodeId}:${u.position.x.toFixed(2)},${u.position.y.toFixed(2)}`)
    .sort()
    .join('|');
}

/** Returns true when an identical commit was applied moments ago for this flow. */
export function shouldSkipDuplicatePositionCommit(
  flowId: string,
  updates: readonly NodePositionUpdate[]
): boolean {
  if (updates.length === 0) return true;
  const key = String(flowId || 'main').trim();
  const fp = fingerprintUpdates(updates);
  const now = Date.now();
  const prev = lastByFlow.get(key);
  if (prev && prev.fp === fp && now - prev.at < DEDUPE_MS) {
    return true;
  }
  lastByFlow.set(key, { fp, at: now });
  return false;
}

export function clearPositionCommitDedupe(flowId?: string): void {
  if (flowId) lastByFlow.delete(String(flowId).trim());
  else lastByFlow.clear();
}
