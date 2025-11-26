// DDT Engine Adapter - Bridge tra nuova logica e interfaccia esistente
// Permette test side-by-side senza rompere codice esistente

import type { AssembledDDT } from '../../DialogueDataTemplateBuilder/DDTAssembler/currentDDT.types';
import type {
  DDTState,
  RetrieveResult,
  DDTNavigatorCallbacks
} from './ddtTypes';
import { runDDT } from './ddtEngine';

// Feature flag per switch graduale
// Legge da localStorage per permettere toggle in runtime
function getUseNewEngine(): boolean {
  try {
    // Prima controlla localStorage (per toggle UI)
    const fromStorage = localStorage.getItem('ddt.useNewEngine');
    if (fromStorage !== null) {
      return fromStorage === 'true';
    }
    // Fallback a env variable (Vite usa import.meta.env)
    return (import.meta.env.VITE_USE_NEW_DDT_ENGINE === 'true') || false;
  } catch {
    // Fallback a env variable se localStorage non disponibile
    return (import.meta.env.VITE_USE_NEW_DDT_ENGINE === 'true') || false;
  }
}

/**
 * Adapter che wrappa la nuova logica runDDT() con l'interfaccia esistente
 * Mantiene compatibilità con executeGetDataHierarchical()
 */
export async function executeGetDataHierarchicalNew(
  ddt: AssembledDDT,
  state: DDTState,
  callbacks: DDTNavigatorCallbacks
): Promise<RetrieveResult> {
  const useNew = getUseNewEngine();
  console.log('[DDTEngineAdapter] ═══════════════════════════════════════════════════════');
  console.log('[DDTEngineAdapter] 🆕 ADAPTER: Calling NEW engine (runDDT)');
  console.log('[DDTEngineAdapter] ═══════════════════════════════════════════════════════');
  console.log('[DDTEngineAdapter] Using NEW engine', {
    ddtId: ddt.id,
    ddtLabel: ddt.label,
    useNewEngine: useNew,
    timestamp: new Date().toISOString()
  });

  try {
    // Converti DDTState vecchio in DDTEngineState nuovo
    const newState = convertOldStateToNew(state);

    // Chiama nuova logica
    const result = await runDDT(ddt, callbacks);

    // Converti risultato nuovo in formato vecchio
    return convertNewResultToOld(result, state);
  } catch (error) {
    console.error('[DDTEngineAdapter] Error in new engine', error);
    return {
      success: false,
      error: error as Error
    };
  }
}

/**
 * Wrapper che sceglie tra vecchio e nuovo engine in base a feature flag
 */
export async function executeGetDataHierarchicalWithFallback(
  ddt: AssembledDDT,
  state: DDTState,
  callbacks: DDTNavigatorCallbacks,
  useOldEngine: () => Promise<RetrieveResult>
): Promise<RetrieveResult> {
  const useNew = getUseNewEngine();
  console.log('[DDTEngineAdapter] ═══════════════════════════════════════════════════════');
  console.log('[DDTEngineAdapter] 🔍 Checking which engine to use', {
    useNewEngine: useNew,
    fromStorage: (() => {
      try {
        return localStorage.getItem('ddt.useNewEngine');
      } catch {
        return 'N/A';
      }
    })(),
    fromEnv: import.meta.env.VITE_USE_NEW_DDT_ENGINE,
    timestamp: new Date().toISOString()
  });
  console.log('[DDTEngineAdapter] ═══════════════════════════════════════════════════════');

  if (useNew) {
    console.log('[DDTEngineAdapter] ✅ Decision: Using NEW engine');
    try {
      const result = await executeGetDataHierarchicalNew(ddt, state, callbacks);
      console.log('[DDTEngineAdapter] ✅ NEW engine completed successfully');
      return result;
    } catch (error) {
      console.error('[DDTEngineAdapter] ❌ New engine failed, falling back to old', error);
      console.warn(
        '[DDTEngineAdapter] ⚠️ FALLBACK: Switching to OLD engine due to error',
        error
      );
      return await useOldEngine();
    }
  } else {
    console.log('[DDTEngineAdapter] ✅ Decision: Using OLD engine (fallback)');
    return await useOldEngine();
  }
}

// ============================================================================
// CONVERSION HELPERS
// ============================================================================

function convertOldStateToNew(oldState: DDTState): any {
  // Converti DDTState vecchio in formato nuovo
  // Il nuovo engine gestisce lo stato internamente, quindi questa è solo
  // per compatibilità iniziale
  return {
    memory: oldState.memory || {},
    counters: {
      // Converti counters vecchi in formato nuovo
      ...Object.keys(oldState.noMatchCounters || {}).reduce((acc, nodeId) => {
        acc[nodeId] = {
          noMatch: oldState.noMatchCounters[nodeId] || 0,
          noInput: oldState.noInputCounters[nodeId] || 0,
          notConfirmed: oldState.notConfirmedCounters[nodeId] || 0,
          confirmation: 0
        };
        return acc;
      }, {} as Record<string, any>)
    }
  };
}

function convertNewResultToOld(
  newResult: RetrieveResult,
  oldState: DDTState
): RetrieveResult {
  // Il nuovo engine ritorna state.memory con struttura { value: any, confirmed: boolean }
  // Il vecchio engine ritornava direttamente i valori
  // Converti la memoria in formato compatibile
  if (newResult.success && newResult.value && typeof newResult.value === 'object') {
    const convertedValue: Record<string, any> = {};

    // Estrai i valori dalla memoria (solo quelli confirmed)
    Object.entries(newResult.value).forEach(([key, mem]: [string, any]) => {
      if (mem && typeof mem === 'object' && 'value' in mem) {
        // Se confirmed è true o non specificato, estrai il valore
        if (mem.confirmed !== false) {
          convertedValue[key] = mem.value;
        }
      } else {
        // Fallback: se non è un oggetto {value, confirmed}, usa direttamente
        convertedValue[key] = mem;
      }
    });

    return {
      ...newResult,
      value: convertedValue
    };
  }

  return newResult;
}
