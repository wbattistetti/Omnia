/**
 * Bridge: FlowStore `flows`, upsert handler, and translations for non-React callers (e.g. TaskRepository).
 * `setSubflowSyncFlows` is invoked from DockManagerWithFlows **on every render** so `getSubflowSyncFlows()`
 * matches the latest reducer state before TaskRepository runs sync in the same frame as a portal upsert.
 */

import type { Flow, WorkspaceState } from '@flows/FlowTypes';

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

/**
 * Pushes updated flow slices into FlowStore after subflow interface sync (parent + child).
 */
export function upsertFlowSlicesFromSubflowSync(flowsNext: WorkspaceState['flows'], flowIds: string[]): void {
  if (!upsertFlowSlice) return;
  for (const id of flowIds) {
    const slice = flowsNext[id];
    if (slice) upsertFlowSlice(slice as Flow);
  }
}
