import { RuleSet, Lang } from './types';

let patternCache: Map<Lang, RuleSet> = new Map();
let cacheLoaded = false;
let cacheLoadingPromise: Promise<Map<Lang, RuleSet>> | null = null;
let cacheReadyPromise: Promise<void> | null = null;

/**
 * Carica i pattern dal database e li salva in cache
 * IMPORTANTE: I pattern hardcoded sono stati completamente rimossi
 * Il sistema usa SOLO i pattern caricati dal database
 */
export async function loadPatternsFromDatabase(): Promise<Map<Lang, RuleSet>> {
  if (cacheLoaded) {
    return patternCache;
  }

  // Se c'è già un caricamento in corso, aspetta che finisca
  if (cacheLoadingPromise) {
    return cacheLoadingPromise;
  }

  cacheLoadingPromise = (async () => {
    try {
      const res = await fetch('/api/factory/task-heuristics');

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const rulesByLang = await res.json();

      // Verifica che ci siano pattern nel database
      if (!rulesByLang || Object.keys(rulesByLang).length === 0) {
        throw new Error('No patterns found in database');
      }

      // Converti stringhe regex in RegExp per ogni lingua
      Object.keys(rulesByLang).forEach(lang => {
        const rules = rulesByLang[lang];
        const ruleSet: RuleSet = {
          AI_AGENT: rules.AI_AGENT?.map((s: string) => new RegExp(s, 'i')) || [],
          MESSAGE: rules.MESSAGE?.map((s: string) => new RegExp(s, 'i')) || [],
          REQUEST_DATA: rules.REQUEST_DATA?.map((s: string) => new RegExp(s, 'i')) || [],
          PROBLEM: rules.PROBLEM ? new RegExp(rules.PROBLEM, 'i') : /\b()\b/i,
          PROBLEM_SPEC_DIRECT: rules.PROBLEM_SPEC_DIRECT?.map((s: string) => new RegExp(s, 'i')) || [],
          PROBLEM_REASON: rules.PROBLEM_REASON?.map((s: string) => new RegExp(s, 'i')) || [],
          SUMMARY: rules.SUMMARY?.map((s: string) => new RegExp(s, 'i')) || [],
          BACKEND_CALL: rules.BACKEND_CALL?.map((s: string) => new RegExp(s, 'i')) || [],
          NEGOTIATION: rules.NEGOTIATION?.map((s: string) => new RegExp(s, 'i')) || [],
        };

        patternCache.set(lang as Lang, ruleSet);
      });

      cacheLoaded = true;

      // Risolvi la promise di readiness se esiste
      if (cacheReadyPromise) {
        const resolve = (cacheReadyPromise as any).__resolve;
        if (resolve) resolve();
      }

      return patternCache;
    } catch (error) {
      console.error('[TASK_HEURISTICS] ERROR: Failed to load patterns from database:', error);
      console.error('[TASK_HEURISTICS] The system requires patterns to be loaded from the database. Please ensure the database is populated.');
      cacheLoadingPromise = null; // Reset per permettere retry
      throw error; // Lancia errore invece di fallback - forziamo l'uso del database
    }
  })();

  return cacheLoadingPromise;
}

/**
 * Restituisce la cache dei pattern
 */
export function getPatternCache(): Map<Lang, RuleSet> {
  return patternCache;
}

/**
 * Verifica se la cache è stata caricata
 */
export function isCacheLoaded(): boolean {
  return cacheLoaded;
}

/**
 * Attende che la cache sia caricata
 * Se è già caricata, ritorna immediatamente
 */
export async function waitForCache(): Promise<void> {
  if (cacheLoaded) {
    return Promise.resolve();
  }

  // Se c'è già una promise di readiness, riutilizzala
  if (cacheReadyPromise) {
    return cacheReadyPromise;
  }

  // Crea una nuova promise che si risolve quando la cache è pronta
  cacheReadyPromise = new Promise<void>((resolve) => {
    // Salva la funzione resolve per poterla chiamare quando la cache è pronta
    (cacheReadyPromise as any).__resolve = resolve;

    // Se la cache si carica prima che questa promise venga creata, risolvila subito
    if (cacheLoaded) {
      resolve();
    } else {
      // Altrimenti, avvia il caricamento se non è già in corso
      if (!cacheLoadingPromise) {
        loadPatternsFromDatabase().catch(() => {
          // In caso di errore, risolvi comunque per non bloccare
          resolve();
        });
      } else {
        // Se è già in corso, aspetta che finisca
        cacheLoadingPromise.then(() => resolve()).catch(() => resolve());
      }
    }
  });

  return cacheReadyPromise;
}

/**
 * Resetta la cache (utile per ricaricare)
 */
export function clearPatternCache() {
  patternCache.clear();
  cacheLoaded = false;
}

