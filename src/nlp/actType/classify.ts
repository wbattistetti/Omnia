import { Inference, InferOptions, Lang } from './types';
import { TaskType, heuristicStringToTaskType } from '../../types/taskTypes';
import { getLanguageOrder, getRuleSet } from './registry';
import { isCacheLoaded, getPatternCache, waitForCache } from './patternLoader';

/**
 * ============================================================
 * EURISTICA 1: DETERMINAZIONE TIPO DI TASK (CATEGORIA)
 * ============================================================
 * Funzione: classify (esportata come inferActType)
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

  // Verifica e aspetta che la cache sia caricata
  if (!isCacheLoaded()) {
    try {
      await waitForCache();
    } catch (error) {
      console.error('[ACT_TYPE_CLASSIFY] Failed to load cache:', error);
      return { type: TaskType.SayMessage, reason: 'cache_load_failed' };
    }
  }

  const langs = getLanguageOrder(opts?.languageOrder);

  // Test in ordine di priorità (primo match vince)
  for (const L of langs) {
    const RS = getRuleSet(L as Lang);
    if (!RS) {
      continue;
    }

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

    // 3. PROBLEM_REASON
    if (RS.PROBLEM_REASON?.some(r => r.test(txt))) {
      return { type: TaskType.ClassifyProblem, lang: L, reason: 'PROBLEM_REASON' };
    }

    // 4. BACKEND_CALL
    if (RS.BACKEND_CALL?.some(r => r.test(txt))) {
      return { type: TaskType.BackendCall, lang: L, reason: 'BACKEND_CALL' };
    }

    // 5. REQUEST_DATA
    if (RS.REQUEST_DATA?.some(r => r.test(txt))) {
      return { type: TaskType.DataRequest, lang: L, reason: 'REQUEST_DATA' };
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

  // Fallback: se nessun match, ritorna UNDEFINED (nodo con punto interrogativo)
  // NOTA: L'euristica 2 (tryLocalPatternMatch) può inferire il tipo se trova un template DDT
  return { type: TaskType.UNDEFINED, reason: 'no_match' };
}


