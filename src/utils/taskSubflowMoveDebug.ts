/**
 * Opt-in tracing for the full task → subflow cycle:
 * structural move/append → hydrateVariablesFromFlow → apply:taskVariableRowsInStore → (optional) variableStore:updated → apply:secondPass:* → child flowInterface.output →
 * syncProxyBindings (child GUID → parent proxy) → materialize → upsert flows.
 *
 * Enable in DevTools (dev only):
 *   localStorage.setItem('omnia.taskSubflowMoveDebug', '1')
 * Disable:
 *   localStorage.removeItem('omnia.taskSubflowMoveDebug')
 */

const LS_KEY = 'omnia.taskSubflowMoveDebug';

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

/** One log line with a fixed prefix for filtering the console. */
export function logTaskSubflowMove(message: string, payload?: Record<string, unknown>): void {
  if (!isTaskSubflowMoveDebugEnabled()) return;
  if (payload !== undefined) {
    console.log(`[TaskSubflowMove] ${message}`, payload);
  } else {
    console.log(`[TaskSubflowMove] ${message}`);
  }
}
