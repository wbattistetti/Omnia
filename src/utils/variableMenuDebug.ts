/**
 * Opt-in diagnostics for the variable picker (subflow interface outputs, cache, skips).
 * Enable in DevTools (dev only):
 *   localStorage.setItem('omnia.variableMenuDebug', '1')   — full menu + utterance filter dump
 *   localStorage.setItem('omnia.variableHydrationDebug', '1') — hydrateVariablesFromFlow + DockManager snapshot
 * Disable:
 *   localStorage.removeItem('omnia.variableMenuDebug')
 *
 * Events:
 * - `[VariableMenuDebug] variableMenu:build` — one log per menu build (flow id, instances, per-child
 *   output source/count, taskOk, totals, skip counters).
 * - `[VariableMenuDebug] variableMenu:buildFailed` — unexpected rejection from build (rare).
 */

const LS_KEY = 'omnia.variableMenuDebug';
/** Flow/canvas hydration of utterance vars into VariableCreationService (same opt-in as menu when unset). */
const LS_HYDRATION = 'omnia.variableHydrationDebug';

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

export function isVariableHydrationDebugEnabled(): boolean {
  try {
    if (!import.meta.env?.DEV || typeof localStorage === 'undefined') return false;
    if (localStorage.getItem(LS_HYDRATION) === '1') return true;
    return localStorage.getItem(LS_KEY) === '1';
  } catch {
    return false;
  }
}

export function logVariableHydration(message: string, payload?: Record<string, unknown>): void {
  if (!isVariableHydrationDebugEnabled()) return;
  if (payload !== undefined) {
    console.log(`[VariableHydration] ${message}`, payload);
  } else {
    console.log(`[VariableHydration] ${message}`);
  }
}
