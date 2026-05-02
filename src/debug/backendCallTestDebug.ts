/**
 * Traccia in console il flusso «Test API» della mock table Backend Call (solo build di sviluppo).
 * In DevTools filtra per: Omnia:BackendCallTest (usa `console.log` così compare con i livelli predefiniti).
 */

export function logBackendCallTest(message: string, detail?: unknown): void {
  if (!import.meta.env.DEV) return;
  if (detail !== undefined) {
    console.log('[Omnia:BackendCallTest]', message, detail);
  } else {
    console.log('[Omnia:BackendCallTest]', message);
  }
}
