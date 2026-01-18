import { RuleSet, Lang } from './types';

let patternCache: Map<Lang, RuleSet> = new Map();
let cacheLoaded = false;
let cacheLoadingPromise: Promise<Map<Lang, RuleSet>> | null = null;
let cacheReadyPromise: Promise<void> | null = null;
let cacheResolve: (() => void) | null = null;

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

      // ✅ Logging dettagliato per debug
      console.log('[PATTERN_LOADER] Risposta endpoint /api/factory/task-heuristics:', {
        hasData: !!rulesByLang,
        keysCount: rulesByLang ? Object.keys(rulesByLang).length : 0,
        keys: rulesByLang ? Object.keys(rulesByLang) : [],
        structure: rulesByLang ? Object.keys(rulesByLang).reduce((acc, lang) => {
          const rules = rulesByLang[lang];
          acc[lang] = {
            hasAI_AGENT: !!(rules?.AI_AGENT?.length),
            hasMESSAGE: !!(rules?.MESSAGE?.length),
            hasREQUEST_DATA: !!(rules?.REQUEST_DATA?.length),
            hasCATEGORY_PATTERNS: !!(rules?.CATEGORY_PATTERNS?.length),
            totalPatterns: Object.values(rules || {}).reduce((sum: number, val: any) => {
              if (Array.isArray(val)) return sum + val.length;
              if (val !== null && val !== undefined) return sum + 1;
              return sum;
            }, 0)
          };
          return acc;
        }, {} as any) : null
      });

      // ✅ Permetti cache vuota (pattern verranno caricati successivamente o sono opzionali)
      // Non lanciare errore, ma avvisa se non ci sono pattern
      if (!rulesByLang || Object.keys(rulesByLang).length === 0) {
        console.warn('[PATTERN_LOADER] ⚠️ Nessun pattern trovato nel database. Il sistema continuerà con pattern vuoti.');
        console.warn('[PATTERN_LOADER] Per popolare i pattern, esegui: node backend/scripts/add_category_patterns.js');
        // ✅ Inizializza cache vuota invece di lanciare errore
        // Questo permette al sistema di continuare a funzionare anche senza pattern
        return patternCache;
      }

      // Converti stringhe regex in RegExp per ogni lingua
      Object.keys(rulesByLang).forEach(lang => {
        const rules = rulesByLang[lang];

        const ruleSet: RuleSet = {
          AI_AGENT: rules.AI_AGENT?.map((s: string) => new RegExp(s, 'i')) || [],
          MESSAGE: rules.MESSAGE?.map((s: string) => new RegExp(s, 'i')) || [],
          REQUEST_DATA: rules.REQUEST_DATA?.map((s: string) => {
            try {
              return new RegExp(s, 'i');
            } catch (err) {
              console.error(`[PATTERN_LOADER] ❌ Errore compilazione pattern: ${s}`, err);
              return null;
            }
          }).filter((r: RegExp | null) => r !== null) || [],
          // PROBLEM: solo se esiste un pattern valido, altrimenti null (non usare fallback che matcha sempre)
          PROBLEM: rules.PROBLEM && rules.PROBLEM.trim() ? new RegExp(rules.PROBLEM, 'i') : null as any,
          PROBLEM_SPEC_DIRECT: rules.PROBLEM_SPEC_DIRECT?.map((s: string) => new RegExp(s, 'i')) || [],
          PROBLEM_REASON: rules.PROBLEM_REASON?.map((s: string) => new RegExp(s, 'i')) || [],
          SUMMARY: rules.SUMMARY?.map((s: string) => new RegExp(s, 'i')) || [],
          BACKEND_CALL: rules.BACKEND_CALL?.map((s: string) => new RegExp(s, 'i')) || [],
          NEGOTIATION: rules.NEGOTIATION?.map((s: string) => new RegExp(s, 'i')) || [],
          // ✅ Pattern per inferire categoria semantica (compila in RegExp durante caricamento)
          CATEGORY_PATTERNS: rules.CATEGORY_PATTERNS?.map((cp: { pattern: string; category: string }) => {
            try {
              return {
                pattern: new RegExp(cp.pattern, 'i'),
                category: cp.category,
                originalPattern: cp.pattern // Mantieni originale per logging
              };
            } catch (err) {
              console.error(`[PATTERN_LOADER] ❌ Errore compilazione CATEGORY_PATTERN: ${cp.pattern}`, err);
              return null;
            }
          }).filter((cp: any) => cp !== null) || [],
        };

        patternCache.set(lang as Lang, ruleSet);
      });

      cacheLoaded = true;

      // ✅ NOTA: NON chiamiamo cacheResolve() qui perché waitForCache() lo gestisce nel .then()
      // Questo evita doppio resolve e race conditions

      return patternCache;
    } catch (error) {
      console.error('[TASK_HEURISTICS] ERROR: Failed to load patterns from database:', error);
      console.error('[TASK_HEURISTICS] The system requires patterns to be loaded from the database. Please ensure the database is populated.');
      console.error('[TASK_HEURISTICS] Verifica che:');
      console.error('  1. Il backend sia in esecuzione (porta 3000 o quella configurata)');
      console.error('  2. MongoDB sia in esecuzione');
      console.error('  3. L\'endpoint /api/factory/task-heuristics risponda correttamente');
      cacheLoadingPromise = null; // Reset per permettere retry
      cacheLoaded = false; // ✅ Assicurati che cacheLoaded sia false
      // ✅ NON risolvere cacheResolve se c'è un errore
      if (cacheResolve) {
        cacheResolve = null; // ✅ Reset cacheResolve senza chiamarlo
      }
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

  // ✅ Se cacheLoadingPromise è già completato ma cacheLoaded è ancora false,
  // aspetta che finisca e verifica di nuovo
  if (cacheLoadingPromise) {
    try {
      await cacheLoadingPromise;
      if (cacheLoaded) {
        return Promise.resolve();
      }
    } catch (error) {
      // Se c'è un errore, continua e crea una nuova promise
    }
  }

  // Crea una nuova promise che si risolve quando la cache è pronta
  cacheReadyPromise = new Promise<void>((resolve, reject) => {
    // Salva la funzione resolve per poterla chiamare quando la cache è pronta
    cacheResolve = resolve;

    // Se la cache si carica prima che questa promise venga creata, risolvila subito
    if (cacheLoaded) {
      resolve();
      cacheResolve = null;
    } else {
      // Altrimenti, avvia il caricamento se non è già in corso
      if (!cacheLoadingPromise) {
        loadPatternsFromDatabase()
          .then(() => {
            // ✅ Verifica che la cache sia effettivamente caricata
            if (cacheLoaded) {
              if (cacheResolve) {
                cacheResolve();
                cacheResolve = null;
              }
            } else {
              // Se la cache non è caricata anche dopo il successo, c'è un problema
              console.warn('[WAIT_FOR_CACHE] Cache non caricata dopo successo loadPatternsFromDatabase');
              if (cacheResolve) {
                cacheResolve = null;
              }
              reject(new Error('Cache not loaded after successful fetch'));
            }
          })
          .catch((error) => {
            // ✅ In caso di errore, REJECT invece di resolve
            console.error('[WAIT_FOR_CACHE] Errore nel caricamento cache:', error);
            if (cacheResolve) {
              cacheResolve = null;
            }
            reject(error); // ✅ Reject invece di resolve
          });
      } else {
        // Se è già in corso, aspetta che finisca
        cacheLoadingPromise
          .then(() => {
            // ✅ Verifica che la cache sia effettivamente caricata (anche se vuota)
            // La cache può essere vuota se non ci sono pattern nel database, ma è comunque "caricata"
            if (cacheLoaded || patternCache.size > 0) {
              if (cacheResolve) {
                cacheResolve();
                cacheResolve = null;
              }
            } else {
              // Se la cache non è caricata anche dopo il successo, c'è un problema
              console.warn('[WAIT_FOR_CACHE] Cache non caricata dopo successo loadPatternsFromDatabase');
              // ✅ Non rejectare se la cache è vuota - è un caso valido
              // Reject solo se c'è stato un errore reale
              if (cacheResolve) {
                cacheResolve();
                cacheResolve = null;
              }
            }
          })
          .catch((error) => {
            // ✅ In caso di errore, REJECT invece di resolve
            console.error('[WAIT_FOR_CACHE] Errore nel caricamento cache:', error);
            if (cacheResolve) {
              cacheResolve = null;
            }
            reject(error); // ✅ Reject invece di resolve
          });
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
  cacheLoadingPromise = null;
  cacheReadyPromise = null;
  cacheResolve = null;
}

