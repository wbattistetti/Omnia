/**
 * Opt-in diagnostics for the variable picker (subflow interface outputs, cache, skips).
 * Enable in DevTools (dev only):
 *   localStorage.setItem('omnia.variableMenuDebug', '1')   — full menu + utterance filter dump
 *   localStorage.setItem('omnia.variableHydrationDebug', '1') — hydrateVariablesFromFlow + DockManager snapshot
 * Disable:
 *   localStorage.removeItem('omnia.variableMenuDebug')
 *
 * High-frequency paths (`variableMenu:build`, `variableMenu:utteranceFilter`) are **throttled** so React
 * re-renders do not flood the console. **Idle empty builds** (store 0, no utterance GUIDs, no items) are
 * skipped unless verbose — timers still rebuild the menu in the background.
 * For every-frame dumps set:
 *   localStorage.setItem('omnia.variableMenuDebugVerbose', '1')
 *
 * Events:
 * - `[VariableMenuDebug] variableMenu:build` — menu build (flow id, instances, per-child
 *   output source/count, taskOk, totals, skip counters).
 * - `[VariableMenuDebug] variableMenu:buildFailed` — unexpected rejection from build (rare).
 */

const LS_KEY = 'omnia.variableMenuDebug';
/** When set with variableMenuDebug, skip throttling (every log line). */
const LS_VERBOSE = 'omnia.variableMenuDebugVerbose';
/** Flow/canvas hydration of utterance vars into VariableCreationService (same opt-in as menu when unset). */
const LS_HYDRATION = 'omnia.variableHydrationDebug';

/** Throttle noisy menu logs (ms) unless verbose mode. */
const MENU_DEBUG_THROTTLE_MS = 1200;
const lastMenuDebugLogAt = new Map<string, number>();

/**
 * True when the payload has nothing useful to inspect (typical idle / empty project / before hydrate).
 * Still logged if {@link isVariableMenuDebugVerboseEnabled}.
 */
function isVariableMenuDebugNoOpPayload(message: string, payload: Record<string, unknown>): boolean {
  if (message === 'variableMenu:build') {
    const store = Number(payload.storeVarCount ?? 0);
    const utter = Number(payload.utteranceGuidSetSize ?? 0);
    const vis = Number(payload.visibilityPassCount ?? 0);
    if (store !== 0 || utter !== 0 || vis !== 0) return false;
    const total = payload.totalItems;
    if (total !== undefined && Number(total) > 0) return false;
    return true;
  }
  if (message === 'variableMenu:utteranceFilter') {
    const store = Number(payload.storeVarCount ?? 0);
    const localAfter = Number(payload.localVarsAfterFilter ?? 0);
    return store === 0 && localAfter === 0;
  }
  return false;
}

function isVariableMenuDebugVerboseEnabled(): boolean {
  try {
    if (import.meta.env?.DEV && typeof localStorage !== 'undefined' && localStorage.getItem(LS_VERBOSE) === '1') {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

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

  const verbose = isVariableMenuDebugVerboseEnabled();
  if (payload && !verbose && isVariableMenuDebugNoOpPayload(message, payload)) {
    return;
  }

  const isThrottledMenuMsg =
    message.startsWith('variableMenu:') && !message.includes('Failed') && !message.includes('failed');
  if (!verbose && isThrottledMenuMsg) {
    const now = Date.now();
    const prev = lastMenuDebugLogAt.get(message) ?? 0;
    if (now - prev < MENU_DEBUG_THROTTLE_MS) return;
    lastMenuDebugLogAt.set(message, now);
  }

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
