import { TestResult, Intent } from '../types/types';

const norm = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9àèéìòóùçãõäöüß\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function tokens(s: string): Set<string> {
  return new Set(norm(s).split(' ').filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

function scoreExample(textTok: Set<string>, example: string): number {
  const exTok = tokens(example);
  return jaccard(textTok, exTok);
}

function scoreIntent(text: string, intent: Intent): number {
  const tTok = tokens(text);
  const textNorm = norm(text);
  // best similarity vs curated examples
  const curated = intent.variants.curated || [];
  let best = 0;
  for (const v of curated) best = Math.max(best, scoreExample(tTok, v.text));

  // keyword bonus (small)
  const kws = (intent.signals?.keywords || []).map((k: any) => String(k?.t || k || ''));
  let bonus = 0;
  for (const kw of kws) {
    const k = norm(kw);
    if (!k) continue;
    if (textNorm.includes(k)) bonus += 0.05;
  }

  // name/phrase boost: if the normalized intent name appears in the text, or its tokens are a subset
  const nameNorm = norm(intent.name || '');
  let phraseBoost = 0;
  if (nameNorm && textNorm.includes(nameNorm)) {
    phraseBoost = 0.4;
  } else if (nameNorm) {
    const nameTok = new Set(nameNorm.split(' ').filter(Boolean));
    let subset = true;
    for (const t of nameTok) if (!tTok.has(t)) { subset = false; break; }
    if (subset) phraseBoost = 0.25;
  }

  const total = Math.min(1, best + Math.min(0.15, bonus) + phraseBoost);
  return total;
}

export async function classify(text: string, intents: Intent[]): Promise<TestResult> {
  const scores = intents.map(it => ({ it, fused: scoreIntent(text, it) }));
  scores.sort((a, b) => b.fused - a.fused);
  const top = scores.slice(0, 5).map(s => ({ intentId: s.it.id, name: s.it.name, fused: s.fused }));
  const best = scores[0];
  const decision = best && best.fused >= 0.25 ? 'MATCH' : 'NO_MATCH';
  const res: TestResult = {
    decision,
    intentId: best?.it.id,
    score: best?.fused ?? 0,
    top,
    explain: { keywords: [], nearestExample: '' },
    latency: { a: 0, b: 0, total: 0 },
  };
  try { if (localStorage.getItem('debug.intent') === '1') console.log('[Classifier][baseline]', { text, top }); } catch {}
  return res;
}


