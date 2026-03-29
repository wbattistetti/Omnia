/**
 * Opt-in diagnostics for StepsStrip: taskTree.steps lookup key vs node.steps, computeUiStepKeys.
 *
 * Enable in the browser console, then reload:
 *   localStorage.setItem('debug.stepsStrip', '1')
 * Disable:
 *   localStorage.removeItem('debug.stepsStrip')
 */

const STORAGE_KEY = 'debug.stepsStrip';

export function isStepsStripDebug(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Logs only when debug.stepsStrip is enabled (non-production). */
export function logStepsStrip(phase: string, payload: Record<string, unknown>): void {
  if (!isStepsStripDebug()) return;
  if (import.meta.env.PROD) return;
  console.log(`[stepsStrip] ${phase}`, payload);
}
