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
  // Removed verbose logging

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

  if (useNew) {
    try {
      const result = await executeGetDataHierarchicalNew(ddt, state, callbacks);
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

    // ✅ FIX: Se il DDT è completato con successo, includi TUTTI i valori (confirmed o meno)
    // perché il vecchio engine non aveva il concetto di "confirmed"
    // Quando il DDT completa con successo, tutti i valori estratti devono essere disponibili
    Object.entries(newResult.value).forEach(([key, mem]: [string, any]) => {
      if (mem && typeof mem === 'object' && 'value' in mem) {
        // Se il DDT è completato con successo, includi tutti i valori estratti
        // (il vecchio engine non aveva il concetto di confirmed)
        convertedValue[key] = mem.value;
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
