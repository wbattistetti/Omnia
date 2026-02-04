// DDT Engine Adapter - Bridge tra nuova logica e interfaccia esistente
// Permette test side-by-side senza rompere codice esistente

import type { AssembledTaskTree } from '../../TaskTreeBuilder/DDTAssembler/currentDDT.types';
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

// ⭐ Backend DDT sempre attivo - Ruby è l'unica fonte di verità
// Rimossa funzione getUseBackendDDTEngine() - backend sempre attivo

/**
 * ✅ NEW: Usa backend DDT Engine tramite SSE (Server-Sent Events) - NO POLLING!
 */
async function executeGetDataHierarchicalBackend(
  ddt: AssembledTaskTree,
  state: DDTState,
  callbacks: DDTNavigatorCallbacks
): Promise<RetrieveResult> {
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('🚀 [DDT ENGINE] Frontend calling BACKEND DDT Engine via SSE');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('[DDT ENGINE] DDT Instance:', {
    dataCount: ddt.data?.length || 0,
    hasTranslations: !!callbacks.translations,
    translationsCount: callbacks.translations ? Object.keys(callbacks.translations).length : 0,
    timestamp: new Date().toISOString()
  });

  let sessionId: string | null = null;
  let eventSource: EventSource | null = null;

  try {
    // ⭐ SEMPRE RUBY (porta 3101) - Unica fonte di verità per interpretare dialoghi
    const baseUrl = 'http://localhost:3101';

    // 1. Crea sessione backend
    console.log('[DDT ENGINE] Creating backend session...');
    const startResponse = await fetch(`${baseUrl}/api/runtime/ddt/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ddtInstance: ddt,
        translations: callbacks.translations || {},
        limits: {
          noMatchMax: 3,
          noInputMax: 3,
          notConfirmedMax: 2
        }
      })
    });

    if (!startResponse.ok) {
      const errorText = await startResponse.text();
      throw new Error(`Failed to create session: ${startResponse.statusText} - ${errorText}`);
    }

    const { sessionId: newSessionId } = await startResponse.json();
    sessionId = newSessionId;
    console.log('✅ [DDT ENGINE] Backend session created:', { sessionId });

    // 2. Apri connessione SSE (Server-Sent Events) - NO POLLING!
    return new Promise<RetrieveResult>(async (resolve, reject) => {
      let finalResult: RetrieveResult | null = null;
      let waitingForInput = false;
      let currentInputNodeId: string | null = null;
      let isResolved = false;

      const cleanup = async () => {
        if (eventSource) {
          eventSource.close();
          console.log('[DDT ENGINE] ✅ SSE connection closed');
        }
        if (sessionId) {
          try {
            // ⭐ SEMPRE RUBY (porta 3101) - Unica fonte di verità
            const baseUrl = 'http://localhost:3101';
            await fetch(`${baseUrl}/api/runtime/ddt/session/${sessionId}`, {
              method: 'DELETE'
            });
            console.log('[DDT ENGINE] ✅ Session deleted', { sessionId });
          } catch (e) {
            console.warn('[DDT ENGINE] ⚠️ Error deleting session', { sessionId, error: e });
          }
        }
      };

      // ⭐ SEMPRE RUBY (porta 3101) - Unica fonte di verità
      const baseUrl = 'http://localhost:3101';

      console.log('[DDT ENGINE] Opening SSE stream...');
      eventSource = new EventSource(`${baseUrl}/api/runtime/ddt/session/${sessionId}/stream`);

      // Event: nuovo messaggio
      eventSource.addEventListener('message', (e: MessageEvent) => {
        try {
          const msg = JSON.parse(e.data);
          console.log('[DDT ENGINE] SSE Event: message', {
            text: msg.text?.substring(0, 50),
            stepType: msg.stepType,
            escalationNumber: msg.escalationNumber
          });
          callbacks.onMessage?.(msg.text, msg.stepType, msg.escalationNumber);
        } catch (error) {
          console.error('[DDT ENGINE] ❌ Error parsing message event', error);
        }
      });

      // Event: backend sta aspettando input utente
      eventSource.addEventListener('waitingForInput', async (e: MessageEvent) => {
        try {
          const { nodeId } = JSON.parse(e.data);
          console.log('═══════════════════════════════════════════════════════════════════════════');
          console.log('⏳ [DDT ENGINE] SSE Event: waitingForInput', { nodeId });
          console.log('═══════════════════════════════════════════════════════════════════════════');

          if (waitingForInput) {
            console.warn('[DDT ENGINE] ⚠️ Already waiting for input, ignoring duplicate event');
            return;
          }

          waitingForInput = true;
          currentInputNodeId = nodeId;

          // ✅ IMPORTANTE: NON chiamare onGetRetrieveEvent qui!
          // Il backend ha già chiamato onGetRetrieveEvent e sta aspettando input tramite provideInput()
          // Qui dobbiamo solo chiamare onGetRetrieveEvent per impostare pendingInputResolveRef nel frontend
          // e poi aspettare che l'utente inserisca input, che verrà inviato al backend tramite provideInput()
          if (callbacks.onGetRetrieveEvent) {
            try {
              console.log('[DDT ENGINE] ⏳ Setting up frontend input handler via onGetRetrieveEvent...');
              // Chiama onGetRetrieveEvent per impostare pendingInputResolveRef nel frontend
              // Questo Promise si risolve quando l'utente inserisce input
              const event = await callbacks.onGetRetrieveEvent(nodeId, ddt);
              console.log('[DDT ENGINE] ✅ Frontend provided input event:', { type: event.type, hasValue: !!event.value });

              // Invia input alla sessione backend tramite provideInput()
              let inputValue = '';
              if (event.type === 'match' && event.value) {
                inputValue = String(event.value);
              } else if (event.type === 'noInput') {
                inputValue = ''; // Empty = noInput
              } else if (event.type === 'noMatch') {
                inputValue = ''; // Empty = noMatch (gestito dal backend)
              }

              console.log('[DDT ENGINE] 📤 Sending input to backend via provideInput:', {
                nodeId,
                eventType: event.type,
                hasValue: !!inputValue,
                valueLength: inputValue.length
              });

              // ⭐ SEMPRE RUBY (porta 3101) - Unica fonte di verità
              const baseUrl = 'http://localhost:3101';

              const inputResponse = await fetch(
                `${baseUrl}/api/runtime/ddt/session/${sessionId}/input`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ input: inputValue })
                }
              );

              if (!inputResponse.ok) {
                const errorText = await inputResponse.text();
                console.error('[DDT ENGINE] ❌ Failed to provide input', errorText);
                waitingForInput = false;
                currentInputNodeId = null;
              } else {
                console.log('✅ [DDT ENGINE] Input successfully provided to backend');
                waitingForInput = false;
                currentInputNodeId = null;
              }
            } catch (error) {
              console.error('[DDT ENGINE] ❌ Error handling input', error);
              waitingForInput = false;
              currentInputNodeId = null;
            }
          } else {
            console.warn('[DDT ENGINE] ⚠️ onGetRetrieveEvent callback not available');
          }
        } catch (error) {
          console.error('[DDT ENGINE] ❌ Error parsing waitingForInput event', error);
        }
      });

      // Event: sessione completata
      eventSource.addEventListener('complete', async (e: MessageEvent) => {
        if (isResolved) return;
        isResolved = true;

        try {
          const result = JSON.parse(e.data);
          console.log('═══════════════════════════════════════════════════════════════════════════');
          console.log('✅ [DDT ENGINE] SSE Event: complete', {
            success: result.success,
            hasValue: !!result.value,
            hasError: !!result.error
          });
          console.log('═══════════════════════════════════════════════════════════════════════════');

          finalResult = {
            success: result.success,
            value: result.value,
            error: result.error ? new Error(result.error) : undefined
          };

          // Converti risultato in formato vecchio
          const convertedResult = convertNewResultToOld(finalResult, state);

          // Cleanup prima di risolvere
          await cleanup();

          resolve(convertedResult);
        } catch (error) {
          console.error('[DDT ENGINE] ❌ Error parsing complete event', error);
          await cleanup();
          reject(error);
        }
      });

      // Event: errore
      eventSource.addEventListener('error', async (e: MessageEvent) => {
        if (isResolved) return;
        isResolved = true;

        try {
          const errorData = e.data ? JSON.parse(e.data) : { error: 'Unknown error' };
          console.error('═══════════════════════════════════════════════════════════════════════════');
          console.error('❌ [DDT ENGINE] SSE Event: error', errorData);
          console.error('═══════════════════════════════════════════════════════════════════════════');
          await cleanup();
          reject(new Error(errorData.error || 'SSE stream error'));
        } catch (parseError) {
          // Se non riesce a parsare, potrebbe essere un errore di connessione
          console.error('[DDT ENGINE] ❌ SSE: Connection error', e);
          await cleanup();
          reject(new Error('SSE connection error'));
        }
      });

      // Gestione errore di connessione EventSource
      eventSource.onerror = async (error) => {
        console.error('[DDT ENGINE] ❌ EventSource connection error', error);
        // EventSource.onerror viene chiamato anche per riconnessioni, quindi non reject subito
        // Solo se la connessione è chiusa (readyState === 2)
        if (eventSource && eventSource.readyState === EventSource.CLOSED) {
          if (!finalResult && !isResolved) {
            isResolved = true;
            await cleanup();
            reject(new Error('SSE connection closed unexpectedly'));
          }
        }
      };
    });
  } catch (error) {
    console.error('═══════════════════════════════════════════════════════════════════════════');
    console.error('❌ [DDT ENGINE] Backend DDT Engine error', error);
    console.error('═══════════════════════════════════════════════════════════════════════════');
    // ✅ NO FALLBACK - Lancia l'errore come richiesto
    throw error;
  }
}

/**
 * Adapter che wrappa la nuova logica runDDT() con l'interfaccia esistente
 * Mantiene compatibilità con executeGetDataHierarchical()
 * (Versione locale - senza backend)
 */
async function executeGetDataHierarchicalNewLocal(
  ddt: AssembledTaskTree,
  state: DDTState,
  callbacks: DDTNavigatorCallbacks
): Promise<RetrieveResult> {
  // Removed verbose logging

  try {
    // Converti DDTState vecchio in DDTEngineState nuovo
    const newState = convertOldStateToNew(state);

    // Chiama nuova logica locale
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
 * Adapter che wrappa la nuova logica runDDT() con l'interfaccia esistente
 * Mantiene compatibilità con executeGetDataHierarchical()
 * (Versione pubblica - sceglie tra backend e locale)
 */
export async function executeGetDataHierarchicalNew(
  ddt: AssembledTaskTree,
  state: DDTState,
  callbacks: DDTNavigatorCallbacks
): Promise<RetrieveResult> {
  // ✅ Check se usare backend
  // ⭐ Backend DDT sempre attivo - Ruby è l'unica fonte di verità
  if (true) {
    return executeGetDataHierarchicalBackend(ddt, state, callbacks);
  }

  // Altrimenti usa versione locale
  return executeGetDataHierarchicalNewLocal(ddt, state, callbacks);
}

/**
 * Wrapper che sceglie tra vecchio e nuovo engine in base a feature flag
 */
export async function executeGetDataHierarchicalWithFallback(
  ddt: AssembledTaskTree,
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
