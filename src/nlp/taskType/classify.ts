import { Inference, InferOptions, Lang } from './types';
import { TaskType, heuristicStringToTaskType } from '../../types/taskTypes';
import { getLanguageOrder, getRuleSet } from './registry';
import { isCacheLoaded, getPatternCache, waitForCache } from './patternLoader';

/**
 * ============================================================
 * EURISTICA 1: DETERMINAZIONE TIPO DI TASK (CATEGORIA)
 * ============================================================
 * Funzione: classify (esportata come inferTaskType)
 * Scopo: Determina il tipo di task dalla label della riga di nodo
 *        (Message, DataRequest/REQUEST_DATA, BackendCall, AIAgent, ecc.)
 * Pattern da: Task_Types (categorie generiche: DataRequest, Message, ecc.)
 * Usata in: NodeRow.tsx quando l'utente digita una nuova riga
 * Output: TaskType enum (es. TaskType.DataRequest, TaskType.SayMessage, TaskType.UNDEFINED)
 * ============================================================
 */
export async function classify(label: string, opts?: InferOptions): Promise<Inference> {
  const txt = (label || '').trim();
  if (!txt) return { type: TaskType.SayMessage, reason: 'empty' };

  console.log('🔍 [CLASSIFY] START', {
    label: txt,
    cacheLoaded: isCacheLoaded(),
    timestamp: new Date().toISOString()
  });

  // Verifica e aspetta che la cache sia caricata
  if (!isCacheLoaded()) {
    console.log('⏳ [CLASSIFY] Cache non caricata, attendo...');
    try {
      await waitForCache();
      console.log('✅ [CLASSIFY] Cache caricata');
    } catch (error) {
      console.error('[TASK_TYPE_CLASSIFY] Failed to load cache:', error);
      return { type: TaskType.SayMessage, reason: 'cache_load_failed' };
    }
  }

  const langs = getLanguageOrder(opts?.languageOrder);
  console.log('🌐 [CLASSIFY] Lingue da testare', { langs });

  // Test in ordine di priorità (primo match vince)
  for (const L of langs) {
    const RS = getRuleSet(L as Lang);
    if (!RS) {
      console.log(`⚠️ [CLASSIFY] Nessun RuleSet per lingua ${L}`);
      continue;
    }

    console.log(`🔍 [CLASSIFY] Testando lingua ${L}`, {
      hasREQUEST_DATA: !!RS.REQUEST_DATA,
      REQUEST_DATA_count: RS.REQUEST_DATA?.length || 0,
      REQUEST_DATA_patterns: RS.REQUEST_DATA?.map(r => r.toString()) || []
    });

    // 0. AI_AGENT (priorità massima - riconosce "AI:" o "AI :" all'inizio)
    // ✅ Mappato a SayMessage (default per AI agent)
    if (RS.AI_AGENT?.some(r => r.test(txt))) {
      console.log(`✅ [CLASSIFY] Match AI_AGENT in ${L}`);
      return { type: TaskType.SayMessage, lang: L, reason: 'AI_AGENT' };
    }

    // 1. NEGOTIATION (priorità massima)
    // ✅ Mappato a SayMessage (default per negotiation)
    if (RS.NEGOTIATION?.some(r => r.test(txt))) {
      console.log(`✅ [CLASSIFY] Match NEGOTIATION in ${L}`);
      return { type: TaskType.SayMessage, lang: L, reason: 'NEGOTIATION' };
    }

    // 2. PROBLEM_SPEC_DIRECT
    if (RS.PROBLEM_SPEC_DIRECT?.some(r => r.test(txt))) {
      console.log(`✅ [CLASSIFY] Match PROBLEM_SPEC_DIRECT in ${L}`);
      return { type: TaskType.ClassifyProblem, lang: L, reason: 'PROBLEM_SPEC_DIRECT' };
    }

    // 3. PROBLEM_REASON
    if (RS.PROBLEM_REASON?.some(r => r.test(txt))) {
      console.log(`✅ [CLASSIFY] Match PROBLEM_REASON in ${L}`);
      return { type: TaskType.ClassifyProblem, lang: L, reason: 'PROBLEM_REASON' };
    }

    // 4. BACKEND_CALL
    if (RS.BACKEND_CALL?.some(r => r.test(txt))) {
      console.log(`✅ [CLASSIFY] Match BACKEND_CALL in ${L}`);
      return { type: TaskType.BackendCall, lang: L, reason: 'BACKEND_CALL' };
    }

    // 5. REQUEST_DATA - LOG DETTAGLIATO
    if (RS.REQUEST_DATA && RS.REQUEST_DATA.length > 0) {
      console.log(`🔍 [CLASSIFY] Testando ${RS.REQUEST_DATA.length} pattern REQUEST_DATA per ${L}`);
      for (let i = 0; i < RS.REQUEST_DATA.length; i++) {
        const pattern = RS.REQUEST_DATA[i];
        const matches = pattern.test(txt);
        console.log(`  Pattern ${i + 1}/${RS.REQUEST_DATA.length}: ${pattern.toString()} → ${matches ? '✅ MATCH' : '❌ NO MATCH'}`);
        if (matches) {
          console.log(`✅ [CLASSIFY] Match REQUEST_DATA in ${L} con pattern ${i + 1}: ${pattern.toString()}`);
          return { type: TaskType.DataRequest, lang: L, reason: 'REQUEST_DATA' };
        }
      }
      console.log(`❌ [CLASSIFY] Nessun pattern REQUEST_DATA ha matchato per ${L}`);
    } else {
      console.log(`⚠️ [CLASSIFY] Nessun pattern REQUEST_DATA disponibile per ${L}`);
    }

    // 6. SUMMARY
    // ✅ Mappato a SayMessage (default per summary)
    if (RS.SUMMARY?.some(r => r.test(txt))) {
      console.log(`✅ [CLASSIFY] Match SUMMARY in ${L}`);
      return { type: TaskType.SayMessage, lang: L, reason: 'SUMMARY' };
    }

    // 7. MESSAGE
    if (RS.MESSAGE?.some(r => r.test(txt))) {
      console.log(`✅ [CLASSIFY] Match MESSAGE in ${L}`);
      return { type: TaskType.SayMessage, lang: L, reason: 'MESSAGE' };
    }

    // 8. PROBLEM (generico) - solo se esiste un pattern valido (non null)
    if (RS.PROBLEM && RS.PROBLEM.test(txt)) {
      console.log(`✅ [CLASSIFY] Match PROBLEM in ${L}`);
      return { type: TaskType.ClassifyProblem, lang: L, reason: 'PROBLEM' };
    }
  }

  // Se nessun match, ritorna UNDEFINED (nodo con punto interrogativo)
  // NOTA: L'euristica 2 (DDTTemplateMatcherService) può inferire il tipo se trova un template DDT
  console.log('❌ [CLASSIFY] Nessun match trovato, ritorno UNDEFINED');
  return { type: TaskType.UNDEFINED, reason: 'no_match' };
}

