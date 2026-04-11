/**
 * Diagnostica pipeline S2 (interfaccia child, binding, rename parent, righe grafo).
 * Opt-in — non dipende da `omnia.taskSubflowMoveDebug`.
 *
 * Abilita in DevTools console:
 *   localStorage.setItem('omnia.s2WiringDiagnostic', '1'); location.reload()
 * Disabilita:
 *   localStorage.removeItem('omnia.s2WiringDiagnostic'); location.reload()
 */

const LS_KEY = 'omnia.s2WiringDiagnostic';

export function isS2WiringDiagnosticEnabled(): boolean {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(LS_KEY) === '1') {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Log strutturato: filtra la console con `[S2Diag]` o con la fase `phase`.
 */
export function logS2Diag(phase: string, message: string, payload?: Record<string, unknown>): void {
  if (!isS2WiringDiagnosticEnabled()) return;
  const tag = `[S2Diag][${phase}] ${message}`;
  if (payload !== undefined) {
    console.log(tag, payload);
  } else {
    console.log(tag);
  }
}
