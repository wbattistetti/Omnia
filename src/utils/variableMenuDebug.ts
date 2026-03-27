/**
 * Opt-in diagnostics for the variable picker (subflow interface outputs, cache, skips).
 * Enable in DevTools (dev only):
 *   localStorage.setItem('omnia.variableMenuDebug', '1')
 * Disable:
 *   localStorage.removeItem('omnia.variableMenuDebug')
 *
 * Events:
 * - `[VariableMenuDebug] variableMenu:build` — one log per menu build (flow id, instances, per-child
 *   output source/count, taskOk, totals, skip counters).
 * - `[VariableMenuDebug] variableMenu:buildFailed` — unexpected rejection from build (rare).
 */

const LS_KEY = 'omnia.variableMenuDebug';

export function isVariableMenuDebugEnabled(): boolean {
  try {
    if (import.meta.env?.DEV && typeof localStorage !== 'undefined' && localStorage.getItem(LS_KEY) === '1') {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function logVariableMenuDebug(message: string, payload?: Record<string, unknown>): void {
  if (!isVariableMenuDebugEnabled()) return;
  if (payload !== undefined) {
    console.log(`[VariableMenuDebug] ${message}`, payload);
  } else {
    console.log(`[VariableMenuDebug] ${message}`);
  }
}
