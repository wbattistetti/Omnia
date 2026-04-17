/**
 * Opt-in debug logging for flow canvas row label editing (commit on change + exit persistence).
 * Enable in dev: localStorage.setItem('omnia.debug.nodeRowEdit', '1') then reload.
 * Disable: localStorage.removeItem('omnia.debug.nodeRowEdit')
 */

export function isNodeRowEditDebugEnabled(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('omnia.debug.nodeRowEdit') === '1';
  } catch {
    return false;
  }
}

/** Single prefix `[NodeRowEdit]` so the console filter stays readable. */
export function logNodeRowEdit(event: string, data?: Record<string, unknown>): void {
  if (!isNodeRowEditDebugEnabled()) return;
  if (data && Object.keys(data).length > 0) {
    console.info(`[NodeRowEdit] ${event}`, data);
  } else {
    console.info(`[NodeRowEdit] ${event}`);
  }
}
