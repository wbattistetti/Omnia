/**
 * Opt-in verbose tracing for "empty flow on reopen" diagnostics.
 *
 * Enable in DevTools (no rebuild):
 *   localStorage.setItem('omnia.flowHydrationTrace', '1')
 * Disable:
 *   localStorage.removeItem('omnia.flowHydrationTrace')
 *
 * Or set VITE_FLOW_HYDRATION_TRACE=true in .env.local
 */

const LS_KEY = 'omnia.flowHydrationTrace';

export function isFlowHydrationTraceEnabled(): boolean {
  try {
    if (import.meta.env?.VITE_FLOW_HYDRATION_TRACE === 'true') return true;
  } catch {
    /* ignore */
  }
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(LS_KEY) === '1') return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** FIX-MAIN-EMPTY — structured console output for expert debugging */
export function logFlowHydrationTrace(message: string, payload?: Record<string, unknown>): void {
  if (!isFlowHydrationTraceEnabled()) return;
  const prefix = '[FlowHydrationTrace]';
  if (payload !== undefined) {
    console.info(prefix, message, payload);
  } else {
    console.info(prefix, message);
  }
}
