/**
 * Opt-in correlation for a single row drag/drop gesture (`operationId`) across DnD, orchestrator,
 * applyTaskMoveToSubflow, FlowStore upsert, and row sync.
 *
 * Enable explicitly:
 *   localStorage.setItem('omnia.dndOperationInstrument', '1')
 *
 * When enabled, mirrors `omnia.taskSubflowMoveTrace === '1'` in dev so one toggle can correlate logs.
 */

const LS_INSTRUMENT = 'omnia.dndOperationInstrument';
const LS_TRACE = 'omnia.taskSubflowMoveTrace';

/** Active drag-end operation id — survives short async hops (e.g. createNodeFromRow timeout). Cleared on next drag start. */
let activeOperationId: string | null = null;

export function isDndOperationInstrumentEnabled(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    if (localStorage.getItem(LS_INSTRUMENT) === '1') return true;
    if (import.meta.env?.DEV && localStorage.getItem(LS_TRACE) === '1') return true;
  } catch {
    /* noop */
  }
  return false;
}

export function setActiveDndOperationId(id: string | null): void {
  activeOperationId = id ? String(id).trim() || null : null;
}

export function getActiveDndOperationId(): string | undefined {
  return activeOperationId ?? undefined;
}

export function clearActiveDndOperationId(): void {
  activeOperationId = null;
}

/** Prefer explicit `payload.operationId`, then the active gesture id (for async apply/upsert). */
export function resolveOperationIdForLog(payload?: { operationId?: string }): string | undefined {
  const explicit = String(payload?.operationId || '').trim();
  if (explicit) return explicit;
  return getActiveDndOperationId();
}
