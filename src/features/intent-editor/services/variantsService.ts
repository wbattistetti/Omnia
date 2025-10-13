import { generateVariants } from './generationService';

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

  // Try backend endpoint first
  try {
    const instructions = buildAutoInstruction(intentName, lang);
    const resp = await fetch('/ai/intents/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intentName, kind, num: n, lang, exclude, instructions, includeDebug: true })
    });
    if (resp.ok) {
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
  } catch {
    // fall back to mock
  }

  // Fallback: mock local generator
  const base = await generateVariants(intentName, 'it', n, []);
  const out: string[] = [];
  for (const v of base) {
    const t = (kind === 'keywords') ? norm(v.text).split(' ').slice(0,2).join(' ') : v.text;
    if (t && !existing.includes(norm(t)) && !out.find(x => norm(x) === norm(t))) out.push(t);
    if (out.length >= n) break;
  }
  return out;
}

function buildAutoInstruction(intentName: string, lang: 'it'|'en'|'pt'){
  const map: Record<string, string> = {
    it: `Genera frasi brevi e naturali in italiano in cui un cliente chiede "${intentName}". Tono colloquiale, 4–10 parole, una per riga, senza virgolette o numerazioni.`,
    en: `Generate short, natural English user phrases asking for "${intentName}". Colloquial tone, 4–10 words, one per line, no quotes or numbering.`,
    pt: `Gere frases curtas e naturais em português pedindo "${intentName}". Tom coloquial, 4–10 palavras, uma por linha, sem aspas ou numeração.`
  };
  return map[lang] || map.it;
}


