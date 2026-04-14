/**
 * Bridge: FlowStore `flows`, upsert handler, and translations for non-React callers (e.g. TaskRepository).
 * `setSubflowSyncFlows` is invoked from DockManagerWithFlows **on every render** so `getSubflowSyncFlows()`
 * matches the latest reducer state before TaskRepository runs sync in the same frame as a portal upsert.
 */

import type { Flow, WorkspaceState } from '@flows/FlowTypes';
import { logTaskSubflowMove } from '@utils/taskSubflowMoveDebug';

let latestFlows: WorkspaceState['flows'] = {};
let latestTranslations: Record<string, string> = {};
let upsertFlowSlice: ((flow: Flow) => void) | null = null;

export function setSubflowSyncFlows(flows: WorkspaceState['flows']): void {
  latestFlows = flows && typeof flows === 'object' ? flows : {};
}

export function getSubflowSyncFlows(): WorkspaceState['flows'] {
  return latestFlows;
}

export function setSubflowSyncTranslations(translations: Record<string, string>): void {
  latestTranslations = translations && typeof translations === 'object' ? translations : {};
}

export function getSubflowSyncTranslations(): Record<string, string> {
  return latestTranslations;
}

export function setSubflowSyncUpsertFlowSlice(handler: ((flow: Flow) => void) | null): void {
  upsertFlowSlice = handler;
}

/** Current upsert (from AppContent); null before React mounts. */
export function getSubflowSyncUpsertFlowSlice(): ((flow: Flow) => void) | null {
  return upsertFlowSlice;
}

/**
 * Pushes updated flow slices into FlowStore after subflow interface sync (parent + child).
 * @returns false if no upsert handler or any requested slice is missing from `flowsNext`.
 */
export function upsertFlowSlicesFromSubflowSync(flowsNext: WorkspaceState['flows'], flowIds: string[]): boolean {
  if (!upsertFlowSlice) {
    logTaskSubflowMove('subflowSync:upsertFlowSlices:skipped', {
      reason: 'noUpsertHandler',
      flowIds: [...flowIds],
    });
    return false;
  }
  let ok = true;
  for (const id of flowIds) {
    const slice = flowsNext[id];
    if (!slice) {
      logTaskSubflowMove('subflowSync:upsertFlowSlices:missingSlice', { flowId: id, flowIds: [...flowIds] });
      ok = false;
      continue;
    }
    upsertFlowSlice(slice as Flow);
  }
  logTaskSubflowMove('subflowSync:upsertFlowSlices:done', { flowIds: [...flowIds], ok });
  return ok;
}
