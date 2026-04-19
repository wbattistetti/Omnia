/**
 * Re-entrant counter: while structural commands run synchronously, Dock inbound upserts must not
 * overwrite FlowStore slices with stale React snapshots (see AppContent `setSubflowSyncUpsertFlowSlice`).
 */

let structuralDepth = 0;

export function runWithStructuralOperationLock<T>(fn: () => T): T {
  structuralDepth += 1;
  try {
    return fn();
  } finally {
    structuralDepth -= 1;
  }
}

/** True during moveTaskRow / moveTaskRowToCanvas / moveTaskRowIntoSubflow synchronous execution. */
export function isStructuralOperationInProgress(): boolean {
  return structuralDepth > 0;
}
