/**
 * Opt-in tracing for the full task → subflow cycle:
 * structural move/append → hydrateVariablesFromFlow → apply:taskVariableRowsInStore → (optional) variableStore:updated → apply:secondPass:* → child flowInterface.output →
 * materialize → upsert flows (S2: no proxy sync; bindings are explicit on the Subflow task).
 *
 * Enable in DevTools (dev only):
 *   localStorage.setItem('omnia.taskSubflowMoveDebug', '1')
 * Disable:
 *   localStorage.removeItem('omnia.taskSubflowMoveDebug')
 *
 * **Correlation tracing** (wiring ids, rename skips, row sync pending sets):
 *   localStorage.setItem('omnia.taskSubflowMoveTrace', '1')
 *   localStorage.removeItem('omnia.taskSubflowMoveTrace')
 *
 * **End-to-end DnD `operationId` logs** (`[DnD:*]`, `[Subflow:*]`, `[FlowStore:upsert]`, `[RowSync]`):
 *   localStorage.setItem('omnia.dndOperationInstrument', '1')
 *   In dev, `omnia.taskSubflowMoveTrace` also enables those — see `dndOperationInstrument.ts`.
 *
 * Per log S2 ad alta segnale (interfaccia / binding / rename), vedi anche
 * {@link logS2Diag} in `s2WiringDiagnostic.ts` — chiave `omnia.s2WiringDiagnostic`.
 */

const LS_KEY = 'omnia.taskSubflowMoveDebug';
const LS_TRACE_KEY = 'omnia.taskSubflowMoveTrace';

export function isTaskSubflowMoveDebugEnabled(): boolean {
  try {
    if (import.meta.env?.DEV && typeof localStorage !== 'undefined' && localStorage.getItem(LS_KEY) === '1') {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/** Narrow correlation logs (rename policy, `wiringVarIds`, row sync). Dev + localStorage only. */
export function isTaskSubflowMoveTraceEnabled(): boolean {
  try {
    if (import.meta.env?.DEV && typeof localStorage !== 'undefined' && localStorage.getItem(LS_TRACE_KEY) === '1') {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/** One log line with a fixed prefix for filtering the console. */
export function logTaskSubflowMove(message: string, payload?: Record<string, unknown>): void {
  if (!isTaskSubflowMoveDebugEnabled()) return;
  if (payload !== undefined) {
    console.log(`[TaskSubflowMove] ${message}`, payload);
  } else {
    console.log(`[TaskSubflowMove] ${message}`);
  }
}

/** Correlation logs: filter console by `[TaskSubflowMove:trace]` and `dndTraceId`. */
export function logTaskSubflowMoveTrace(message: string, payload?: Record<string, unknown>): void {
  if (!isTaskSubflowMoveTraceEnabled()) return;
  if (payload !== undefined) {
    console.log(`[TaskSubflowMove:trace] ${message}`, payload);
  } else {
    console.log(`[TaskSubflowMove:trace] ${message}`);
  }
}
