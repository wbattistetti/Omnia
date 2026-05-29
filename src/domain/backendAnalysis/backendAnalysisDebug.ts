/**
 * Log diagnostici analisi backend (catalogo / tab Analisi).
 * DEV: sempre attivi. Produzione: `localStorage.setItem('omnia.debug.backendAnalysis', '1')`.
 * Console: `window.__omniaDebugBackendAnalysis = true` (reload).
 */

const LS_KEY = 'omnia.debug.backendAnalysis';

declare global {
  interface Window {
    __omniaDebugBackendAnalysis?: boolean;
  }
}

export function isBackendAnalysisDebugEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === 'undefined') return false;
  try {
    if (window.__omniaDebugBackendAnalysis === true) return true;
    if (localStorage.getItem(LS_KEY) === '1') return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function logBackendAnalysis(
  scope: string,
  payload: Record<string, unknown>
): void {
  if (!isBackendAnalysisDebugEnabled()) return;
  const stamp = new Date().toISOString().slice(11, 23);
  console.log(`[Omnia BackendAnalysis ${stamp}] ${scope}`, payload);
}

/** Anteprima testo lungo per log (markdown IA / corpus). */
export function debugTextPreview(text: string, max = 480): string {
  const t = String(text ?? '').trim();
  if (!t) return '(vuoto)';
  if (t.length <= max) return t;
  return `${t.slice(0, max)}… [${t.length} char]`;
}
