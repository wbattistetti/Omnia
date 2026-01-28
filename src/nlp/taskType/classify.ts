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
 * Output: TaskType enum (es. TaskType.UtteranceInterpretation, TaskType.SayMessage, TaskType.UNDEFINED)
 * ============================================================
 */
export async function classify(label: string, opts?: InferOptions): Promise<Inference> {
  const txt = (label || '').trim();
  if (!txt) return { type: TaskType.UNDEFINED, reason: 'empty' };

  // Verifica e aspetta che la cache sia caricata
  if (!isCacheLoaded()) {
    try {
      await waitForCache();
      // Verifica che la cache sia effettivamente caricata dopo waitForCache
      if (!isCacheLoaded()) {
        console.warn('[TASK_TYPE_CLASSIFY] Cache ancora non caricata dopo waitForCache, ritorno UNDEFINED');
        return { type: TaskType.UNDEFINED, reason: 'cache_still_not_loaded' };
      }
    } catch (error) {
      console.error('[TASK_TYPE_CLASSIFY] Failed to load cache:', error);
      return { type: TaskType.UNDEFINED, reason: 'cache_load_failed' };
    }
  }

  const langs = getLanguageOrder(opts?.languageOrder);
  // Test in ordine di priorità (primo match vince)
  for (const L of langs) {
    const RS = getRuleSet(L as Lang);
    if (!RS) {
      continue;
    }

    // ❌ RIMOSSO: log verboso per ogni lingua testata
    // console.log(`🔍 [CLASSIFY] Testando lingua ${L}`, {...});

    // 0. AI_AGENT (priorità massima - riconosce "AI:" o "AI :" all'inizio)
    // ✅ Mappato a SayMessage (default per AI agent)
    if (RS.AI_AGENT?.some(r => r.test(txt))) {
      return { type: TaskType.SayMessage, lang: L, reason: 'AI_AGENT' };
    }

    // 1. NEGOTIATION (priorità massima)
    // ✅ Mappato a SayMessage (default per negotiation)
    if (RS.NEGOTIATION?.some(r => r.test(txt))) {
      return { type: TaskType.SayMessage, lang: L, reason: 'NEGOTIATION' };
    }

    // 2. PROBLEM_SPEC_DIRECT
    if (RS.PROBLEM_SPEC_DIRECT?.some(r => r.test(txt))) {
      return { type: TaskType.ClassifyProblem, lang: L, reason: 'PROBLEM_SPEC_DIRECT' };
    }

    // 3. BACKEND_CALL
    if (RS.BACKEND_CALL?.some(r => r.test(txt))) {
      return { type: TaskType.BackendCall, lang: L, reason: 'BACKEND_CALL' };
    }

    // 4. REQUEST_DATA - LOG DETTAGLIATO (priorità su PROBLEM_REASON)
    // ✅ IMPORTANTE: REQUEST_DATA viene prima di PROBLEM_REASON perché:
    // - "Chiedi il motivo della chiamata" deve essere DataRequest (non ClassifyProblem)
    // - La categoria "problem-classification" viene inferita dopo, non dal taskType
    if (RS.REQUEST_DATA && RS.REQUEST_DATA.length > 0) {
      // ❌ RIMOSSO: log verboso per ogni pattern testato
      // console.log(`🔍 [CLASSIFY] Testando ${RS.REQUEST_DATA.length} pattern REQUEST_DATA per ${L}`);
      for (let i = 0; i < RS.REQUEST_DATA.length; i++) {
        const pattern = RS.REQUEST_DATA[i];
        const matches = pattern.test(txt);
        // ❌ RIMOSSO: log per ogni pattern (troppo verboso)
        // console.log(`  Pattern ${i + 1}/${RS.REQUEST_DATA.length}: ${pattern.toString()} → ${matches ? '✅ MATCH' : '❌ NO MATCH'}`);
        if (matches) {
          return { type: TaskType.UtteranceInterpretation, lang: L, reason: 'REQUEST_DATA' };
        }
      }
      // ❌ RIMOSSO: log "Nessun pattern matchato" (troppo verboso)
      // console.log(`❌ [CLASSIFY] Nessun pattern REQUEST_DATA ha matchato per ${L}`);
    } else {
      console.warn(`⚠️ [CLASSIFY] Nessun pattern REQUEST_DATA disponibile per ${L}`);
    }

    // 5. PROBLEM_REASON (dopo REQUEST_DATA)
    // ✅ IMPORTANTE: Viene dopo REQUEST_DATA perché "chiedi il motivo" deve essere DataRequest
    // con categoria problem-classification, non ClassifyProblem
    if (RS.PROBLEM_REASON?.some(r => r.test(txt))) {
      return { type: TaskType.ClassifyProblem, lang: L, reason: 'PROBLEM_REASON' };
    }

    // 6. SUMMARY
    // ✅ Mappato a SayMessage (default per summary)
    if (RS.SUMMARY?.some(r => r.test(txt))) {
      return { type: TaskType.SayMessage, lang: L, reason: 'SUMMARY' };
    }

    // 7. MESSAGE
    if (RS.MESSAGE?.some(r => r.test(txt))) {
      return { type: TaskType.SayMessage, lang: L, reason: 'MESSAGE' };
    }

    // 8. PROBLEM (generico) - solo se esiste un pattern valido (non null)
    if (RS.PROBLEM && RS.PROBLEM.test(txt)) {
      return { type: TaskType.ClassifyProblem, lang: L, reason: 'PROBLEM' };
    }
  }

  // Se nessun match, ritorna UNDEFINED (nodo con punto interrogativo)
  // NOTA: L'euristica 2 (DDTTemplateMatcherService) può inferire il tipo se trova un template DDT
  return { type: TaskType.UNDEFINED, reason: 'no_match' };
}

