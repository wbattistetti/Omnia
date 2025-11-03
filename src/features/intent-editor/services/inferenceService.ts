import { TestResult, Intent } from '../types/types';
import { getModelStatus } from './trainingService';

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

/**
 * Classificazione con embeddings (chiama backend)
 */
async function classifyWithEmbeddings(text: string, intentIds: string[]): Promise<{ intentId: string; score: number }[]> {
  try {
    const response = await fetch('/api/intents/classify-embedding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, intentIds })
    });

    if (!response.ok) {
      throw new Error(`Embeddings classification failed: ${response.status}`);
    }

    const data = await response.json();
    return data.top || [];
  } catch (err) {
    console.error('[Classifier][Embeddings] Error:', err);
    return [];
  }
}

/**
 * Hybrid classifier: usa fast path se score alto/basso, embeddings se medio
 */
export async function classify(text: string, intents: Intent[]): Promise<TestResult> {
  const startTime = Date.now();

  // Step 1: Fast path (sempre eseguito)
  const baselineScores = intents.map(it => ({ it, fused: scoreIntent(text, it) }));
  baselineScores.sort((a, b) => b.fused - a.fused);
  const bestBaseline = baselineScores[0];
  const baselineScore = bestBaseline?.fused ?? 0;

  const fastPathTime = Date.now() - startTime;

  // Step 2: Decisione su quale path usare
  let method: 'fast-path' | 'embeddings' | 'hybrid' = 'fast-path';
  let finalScore = baselineScore;
  let embeddingResults: { intentId: string; score: number }[] = [];
  let embeddingScore = 0;

  // Se score alto (>0.7) o basso (<0.25) → usa solo fast path
  if (baselineScore >= 0.7 || baselineScore < 0.25) {
    method = 'fast-path';
  } else {
    // Score medio (0.25-0.7) → verifica se ci sono modelli pronti e usa embeddings
    const enabledIntents = intents.filter(it => it.enabled !== false);
    const intentIds = enabledIntents.map(it => it.id);

    // Verifica quali intent hanno model ready
    const modelChecks = await Promise.all(
      intentIds.map(id =>
        getModelStatus(id).catch(() => ({ intentId: id, modelReady: false, hasEmbeddings: false }))
      )
    );

    const readyIntentIds = modelChecks
      .filter(status => status.modelReady)
      .map(status => status.intentId);

    if (readyIntentIds.length > 0) {
      // Usa embeddings per intent con model ready
      embeddingResults = await classifyWithEmbeddings(text, readyIntentIds);

      if (embeddingResults.length > 0) {
        const bestEmbedding = embeddingResults[0];
        embeddingScore = bestEmbedding.score;

        // Fusion: 30% baseline + 70% embedding
        finalScore = 0.3 * baselineScore + 0.7 * embeddingScore;
        method = 'hybrid';

        // Se embedding trova un match migliore, usa quello
        if (embeddingScore > baselineScore) {
          // Trova l'intent corrispondente
          const embeddingIntentId = bestEmbedding.intentId;
          const embeddingIntent = intents.find(it => it.id === embeddingIntentId);

          if (embeddingIntent) {
            // Sostituisci best con embedding intent
            baselineScores[0] = { it: embeddingIntent, fused: finalScore };
          }
        }
      } else {
        method = 'fast-path';
      }
    }
    // Se nessun model ready → usa solo fast path
  }

  const totalTime = Date.now() - startTime;

  // Costruisci top 5 (merge baseline e embeddings)
  const top: { intentId: string; name: string; fused: number }[] = [];
  const seen = new Set<string>();

  // Aggiungi risultati embeddings (se hybrid)
  if (method === 'hybrid' && embeddingResults.length > 0) {
    for (const emb of embeddingResults.slice(0, 3)) {
      const intent = intents.find(it => it.id === emb.intentId);
      if (intent && !seen.has(emb.intentId)) {
        top.push({ intentId: emb.intentId, name: intent.name, fused: emb.score });
        seen.add(emb.intentId);
      }
    }
  }

  // Aggiungi risultati baseline
  for (const s of baselineScores.slice(0, 5)) {
    if (!seen.has(s.it.id)) {
      top.push({ intentId: s.it.id, name: s.it.name, fused: s.fused });
      seen.add(s.it.id);
    }
  }

  // Ordina per score decrescente
  top.sort((a, b) => b.fused - a.fused);

  const best = top[0];
  const decision = best && finalScore >= 0.25 ? 'MATCH' : 'NO_MATCH';

  const res: TestResult = {
    decision,
    intentId: best?.intentId,
    score: finalScore,
    top: top.slice(0, 5),
    explain: {
      keywords: [],
      nearestExample: ''
    },
    latency: { a: fastPathTime, b: totalTime - fastPathTime, total: totalTime },
    method, // ✅ Metodo usato
    baselineScore: baselineScore, // ✅ Score fast path
    embeddingScore: embeddingScore || undefined, // ✅ Score embeddings (se usato)
  };

  try {
    if (localStorage.getItem('debug.intent') === '1') {
      console.log('[Classifier][hybrid]', {
        text,
        method,
        baselineScore,
        embeddingScore: embeddingScore || null,
        finalScore,
        top: top.slice(0, 3)
      });
    }
  } catch {}

  return res;
}


