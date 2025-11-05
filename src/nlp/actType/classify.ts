import { HeuristicType, Inference, InferOptions, Lang } from './types';
import { getLanguageOrder, getRuleSet } from './registry';
import { isCacheLoaded, getPatternCache, waitForCache } from './patternLoader';

// Cache locale per evitare chiamate multiple a waitForCache
let cacheReadyChecked = false;

export function classify(label: string, opts?: InferOptions): Inference {
  const txt = (label || '').trim();
  if (!txt) return { type: 'MESSAGE', reason: 'empty' };

  // Verifica che la cache sia caricata
  if (!isCacheLoaded()) {
    // Se non è ancora caricata, avvia il caricamento in background (non bloccante)
    if (!cacheReadyChecked) {
      cacheReadyChecked = true;
      waitForCache().catch(() => {
        console.warn('[ACT_TYPE_CLASSIFY] ⚠️ Cache loading failed');
      });
    }
    console.warn('[ACT_TYPE_CLASSIFY] ⚠️ Cache not loaded yet! Patterns may not be available. Returning MESSAGE as fallback.');
    return { type: 'MESSAGE', reason: 'cache_not_loaded' };
  }

  const langs = getLanguageOrder(opts?.languageOrder);

  console.log('[ACT_TYPE_CLASSIFY] 🔍 Classifying text:', { text: txt, languages: langs, cacheSize: getPatternCache().size });

  // Test in ordine di priorità (primo match vince)
  for (const L of langs) {
    const RS = getRuleSet(L as Lang);
    if (!RS) {
      console.log(`[ACT_TYPE_CLASSIFY] ⚠️ No RuleSet found for language: ${L}`);
      continue;
    }

    console.log(`[ACT_TYPE_CLASSIFY] 📋 Testing language: ${L}`, {
      hasNEGOTIATION: RS.NEGOTIATION?.length || 0,
      hasPROBLEM_SPEC_DIRECT: RS.PROBLEM_SPEC_DIRECT?.length || 0,
      hasPROBLEM_REASON: RS.PROBLEM_REASON?.length || 0,
      hasBACKEND_CALL: RS.BACKEND_CALL?.length || 0,
      hasREQUEST_DATA: RS.REQUEST_DATA?.length || 0,
      hasSUMMARY: RS.SUMMARY?.length || 0,
      hasMESSAGE: RS.MESSAGE?.length || 0,
      hasPROBLEM: !!RS.PROBLEM
    });

    // 1. NEGOTIATION (priorità massima)
    if (RS.NEGOTIATION?.some(r => {
      const match = r.test(txt);
      if (match) console.log(`[ACT_TYPE_CLASSIFY] ✅ NEGOTIATION match! Pattern: ${r.source}, Text: "${txt}"`);
      return match;
    })) {
      console.log(`[ACT_TYPE_CLASSIFY] 🎯 RESULT: NEGOTIATION (lang: ${L})`);
      return { type: 'NEGOTIATION', lang: L, reason: 'NEGOTIATION' };
    }

    // 2. PROBLEM_SPEC_DIRECT
    if (RS.PROBLEM_SPEC_DIRECT?.some(r => {
      const match = r.test(txt);
      if (match) console.log(`[ACT_TYPE_CLASSIFY] ✅ PROBLEM_SPEC_DIRECT match! Pattern: ${r.source}`);
      return match;
    })) {
      console.log(`[ACT_TYPE_CLASSIFY] 🎯 RESULT: PROBLEM_SPEC (lang: ${L}, reason: PROBLEM_SPEC_DIRECT)`);
      return { type: 'PROBLEM_SPEC', lang: L, reason: 'PROBLEM_SPEC_DIRECT' };
    }

    // 3. PROBLEM_REASON
    if (RS.PROBLEM_REASON?.some(r => {
      const match = r.test(txt);
      if (match) console.log(`[ACT_TYPE_CLASSIFY] ✅ PROBLEM_REASON match! Pattern: ${r.source}`);
      return match;
    })) {
      console.log(`[ACT_TYPE_CLASSIFY] 🎯 RESULT: PROBLEM_SPEC (lang: ${L}, reason: PROBLEM_REASON)`);
      return { type: 'PROBLEM_SPEC', lang: L, reason: 'PROBLEM_REASON' };
    }

    // 4. BACKEND_CALL
    if (RS.BACKEND_CALL?.some(r => {
      const match = r.test(txt);
      if (match) console.log(`[ACT_TYPE_CLASSIFY] ✅ BACKEND_CALL match! Pattern: ${r.source}`);
      return match;
    })) {
      console.log(`[ACT_TYPE_CLASSIFY] 🎯 RESULT: BACKEND_CALL (lang: ${L})`);
      return { type: 'BACKEND_CALL', lang: L, reason: 'BACKEND_CALL' };
    }

    // 5. REQUEST_DATA
    if (RS.REQUEST_DATA?.some(r => {
      const match = r.test(txt);
      if (match) console.log(`[ACT_TYPE_CLASSIFY] ✅ REQUEST_DATA match! Pattern: ${r.source}`);
      return match;
    })) {
      console.log(`[ACT_TYPE_CLASSIFY] 🎯 RESULT: REQUEST_DATA (lang: ${L})`);
      return { type: 'REQUEST_DATA', lang: L, reason: 'REQUEST_DATA' };
    }

    // 6. SUMMARY
    if (RS.SUMMARY?.some(r => {
      const match = r.test(txt);
      if (match) console.log(`[ACT_TYPE_CLASSIFY] ✅ SUMMARY match! Pattern: ${r.source}`);
      return match;
    })) {
      console.log(`[ACT_TYPE_CLASSIFY] 🎯 RESULT: SUMMARY (lang: ${L})`);
      return { type: 'SUMMARY', lang: L, reason: 'SUMMARY' };
    }

    // 7. MESSAGE
    if (RS.MESSAGE?.some(r => {
      const match = r.test(txt);
      if (match) console.log(`[ACT_TYPE_CLASSIFY] ✅ MESSAGE match! Pattern: ${r.source}`);
      return match;
    })) {
      console.log(`[ACT_TYPE_CLASSIFY] 🎯 RESULT: MESSAGE (lang: ${L})`);
      return { type: 'MESSAGE', lang: L, reason: 'MESSAGE' };
    }

    // 8. PROBLEM (generico)
    if (RS.PROBLEM?.test(txt)) {
      console.log(`[ACT_TYPE_CLASSIFY] ✅ PROBLEM match! Pattern: ${RS.PROBLEM.source}`);
      console.log(`[ACT_TYPE_CLASSIFY] 🎯 RESULT: PROBLEM_SPEC (lang: ${L}, reason: PROBLEM)`);
      return { type: 'PROBLEM_SPEC', lang: L, reason: 'PROBLEM' };
    }

    console.log(`[ACT_TYPE_CLASSIFY] ❌ No match found for language: ${L}`);
  }

  // Fallback: se nessun match, ritorna MESSAGE
  console.log(`[ACT_TYPE_CLASSIFY] ⚠️ FALLBACK: No match found, returning MESSAGE`);
  return { type: 'MESSAGE', reason: 'fallback' };
}


