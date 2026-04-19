/**
 * Feature flags for the transactional flow workspace migration (canonical store + viewer UI).
 * Defaults keep legacy merge/derive behavior until explicitly enabled for a build or session.
 */

function readEnvFlag(name: string): boolean {
  try {
    const v = (import.meta as any)?.env?.[name];
    return v === 'true' || v === '1';
  } catch {
    return false;
  }
}

/** Upsert uses server row text as-is (no optimistic local row text preservation). */
export function isStrictStoreUpsertMergeEnabled(): boolean {
  return readEnvFlag('VITE_FLOW_MACHINE_STRICT_UPSERT');
}

/** Node rows always mirror the FlowStore slice — no legacy derive / parent `onUpdate` path. */
export function isViewerOnlyStoreAlignedRowsEnabled(): boolean {
  return true;
}
