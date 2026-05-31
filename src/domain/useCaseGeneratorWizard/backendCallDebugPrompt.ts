/**
 * Istruzioni prompt e formattazione conversazionale per debug chiamate backend (tool ConvAI).
 */

import type { FlowBackendCallInvocation } from '@features/debugger/types/flowBackendCallDiagnostic';

/** Istruzione nel system prompt (indipendente da «Mostra Usecases» / includeLog). */
export const PROMPT_BACKEND_DEBUG_INSTRUCTION_IT = `Debug chiamate backend (solo se hai invocato un tool webhook)
Dopo ogni invocazione di un tool backend catalogato, aggiungi una riga di debug SEPARATA dalla risposta all'utente (nuova riga, non sostituire il messaggio conversazionale):
- Formato obbligatorio: \`DEBUG: chiamata backend \`<path>\` eseguita, <riepilogo risultati>.\`
- \`<path>\` = path dell'endpoint (es. \`/next-window\`, \`/slots\`) senza dominio.
- \`<riepilogo risultati>\` = primi valori utili restituiti (date, ore, conteggi slot, codici errore brevi).
- Se il tool fallisce: \`DEBUG: chiamata backend \`<path>\` fallita: <motivo breve>.\`
- Se non hai invocato tool in quel turno, NON aggiungere righe DEBUG.
- Le righe DEBUG non sostituiscono il testo per l'utente: vanno dopo la frase conversazionale (e dopo eventuale marker USECASE se attivo).`;

/**
 * Sezione prompt da anteporre al catalogo use case quando il toggle è attivo.
 */
export function buildBackendCallDebugPromptSection(includeBackendLog: boolean): string {
  if (!includeBackendLog) return '';
  return PROMPT_BACKEND_DEBUG_INSTRUCTION_IT;
}

function pathFromEndpoint(endpoint: string): string {
  const raw = String(endpoint ?? '').trim();
  if (!raw) return '/';
  try {
    const u = raw.startsWith('http') ? new URL(raw) : new URL(raw, 'https://local');
    const p = u.pathname || '/';
    return p.startsWith('/') ? p : `/${p}`;
  } catch {
    const slash = raw.indexOf('/');
    if (slash >= 0) {
      const tail = raw.slice(slash).split('?')[0].split('#')[0];
      return tail.startsWith('/') ? tail : `/${tail}`;
    }
    return raw.startsWith('/') ? raw : `/${raw}`;
  }
}

function summarizeInvocationResults(inv: FlowBackendCallInvocation): string {
  if (inv.errorMessage?.trim()) {
    return `errore: ${inv.errorMessage.trim().slice(0, 120)}`;
  }
  if (inv.outcome === 'http_error' || inv.outcome === 'no_match' || inv.outcome === 'ambiguous') {
    const status = inv.httpStatus != null ? ` HTTP ${inv.httpStatus}` : '';
    return `${inv.outcome}${status}`.trim();
  }
  const parts: string[] = [];
  for (const row of inv.outputParameters.slice(0, 8)) {
    const name = String(row.name ?? '').trim();
    const val = formatDebugValue(row.value);
    if (!val) continue;
    const shortName = name.split('.').pop() || name;
    parts.push(shortName ? `${shortName}: ${val}` : val);
  }
  if (parts.length > 0) {
    return `ricevuti ${parts.slice(0, 4).join(', ')}`;
  }
  if (inv.responsePreview?.trim()) {
    const prev = inv.responsePreview.trim().replace(/\s+/g, ' ').slice(0, 100);
    return `risposta: ${prev}${inv.responsePreview.length > 100 ? '…' : ''}`;
  }
  return 'eseguita con successo';
}

function formatDebugValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim().slice(0, 60);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const flat = value
      .slice(0, 3)
      .map((x) => formatDebugValue(x))
      .filter(Boolean);
    return flat.join(', ');
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value).slice(0, 80);
    } catch {
      return '';
    }
  }
  return String(value).slice(0, 60);
}

/** Una riga DEBUG per una singola invocazione backend (UI conversazione / debugger). */
export function formatBackendInvocationDebugLine(inv: FlowBackendCallInvocation): string {
  const path = pathFromEndpoint(inv.endpoint);
  const failed =
    inv.outcome === 'http_error' ||
    inv.outcome === 'no_match' ||
    inv.outcome === 'ambiguous' ||
    Boolean(inv.errorMessage?.trim());
  if (failed) {
    const detail = summarizeInvocationResults(inv);
    return `DEBUG: chiamata backend \`${path}\` fallita: ${detail.replace(/^errore: /, '')}.`;
  }
  const summary = summarizeInvocationResults(inv);
  return `DEBUG: chiamata backend \`${path}\` eseguita, ${summary}.`;
}

/** Blocco testuale con tutte le righe DEBUG per un turno bot. */
export function formatBackendInvocationsDebugBlock(
  invocations: readonly FlowBackendCallInvocation[]
): string {
  if (!invocations.length) return '';
  return invocations.map((inv) => formatBackendInvocationDebugLine(inv)).join('\n');
}
