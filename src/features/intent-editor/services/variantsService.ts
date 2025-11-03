// ✅ RIMOSSO: import generateVariants (non più usato - fallback rimosso)

const norm = (s: string) => (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();

export async function generateVariantsForIntent(params: {
  intentName: string;
  kind: 'matching'|'not-matching'|'keywords'|'positive'|'negative';
  exclude: string[];
  n?: number;
  lang?: 'it'|'en'|'pt';
}) {
  const { intentName, exclude, n = 20, lang = 'it' } = params;
  const kind = (params.kind === 'positive') ? 'matching' : (params.kind === 'negative' ? 'not-matching' : params.kind);
  const existing = exclude.map(norm);

  // ✅ RIMOSSO: fallback - se fallisce, lancia errore
  const resp = await fetch('/ai/intents/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intentName, kind, num: n, lang, exclude, includeDebug: true })
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    let errorMsg = `HTTP ${resp.status}: ${errorText}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMsg = errorJson.detail || errorMsg;
    } catch {
      // Se non è JSON, usa il testo originale
    }
    throw new Error(errorMsg);
  }

  const data = await resp.json();
  try { if (localStorage.getItem('debug.intent')==='1' && data?.debug) console.log('[IntentGen][debug]', data.debug); } catch {}
  let items: string[] = (Array.isArray(data?.items) ? data.items : [])
    .map((x: any) => String(x?.text || ''))
    .filter(Boolean);
  if ((!items || items.length === 0) && Array.isArray(data?.debug?.items)) {
    items = (data.debug.items as string[]).filter(Boolean);
  }
  items = items.filter(t => !existing.includes(norm(t)));
  return items.slice(0, n);
}
