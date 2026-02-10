// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback, useRef } from 'react';

type RetryState = {
  attempt: number;
  status: 'idle' | 'retrying' | 'succeeded' | 'failed';
};

/**
 * Hook che gestisce retry robusto per la pipeline del wizard.
 * Fornisce retry con backoff esponenziale e limite massimo tentativi.
 * Stato isolato per nodo e fase.
 */
export function useWizardRetry() {
  const retryStateRef = useRef<Map<string, RetryState>>(new Map());

  /**
   * Esegue retry di una fase per un nodo specifico.
   * @param nodeId ID del nodo
   * @param phase Fase da ritentare ('constraints' | 'parser' | 'messages')
   * @param apiCall Funzione che esegue la chiamata API
   * @param onProgress Callback opzionale per aggiornare il progresso
   * @returns Risultato della chiamata API
   * @throws Errore se tutti i tentativi falliscono
   */
  const retryNodePhase = useCallback(async (
    nodeId: string,
    phase: 'constraints' | 'parser' | 'messages',
    apiCall: () => Promise<any>,
    onProgress?: (progress: number) => void
  ): Promise<any> => {
    const key = `${nodeId}:${phase}`;
    const maxAttempts = 3;
    const baseDelay = 1000; // 1s

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // ✅ Aggiorna stato retry
        retryStateRef.current.set(key, { attempt, status: 'retrying' });

        // ✅ Backoff esponenziale: delay = baseDelay * 2^(attempt-1)
        const delay = baseDelay * Math.pow(2, attempt - 1);
        if (attempt > 1) {
          console.log(`[useWizardRetry] 🔄 Retry attempt ${attempt}/${maxAttempts} for ${nodeId}:${phase} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // ✅ Chiama API
        const result = await apiCall();

        // ✅ Successo
        retryStateRef.current.set(key, { attempt, status: 'succeeded' });
        console.log(`[useWizardRetry] ✅ Success on attempt ${attempt}/${maxAttempts} for ${nodeId}:${phase}`);
        return result;
      } catch (error) {
        console.error(`[useWizardRetry] ❌ Attempt ${attempt}/${maxAttempts} failed for ${nodeId}:${phase}`, error);

        if (attempt === maxAttempts) {
          // ✅ Fallito dopo tutti i tentativi
          retryStateRef.current.set(key, { attempt, status: 'failed' });
          console.error(`[useWizardRetry] ❌ All ${maxAttempts} attempts failed for ${nodeId}:${phase}`);
          throw error;
        }
        // ✅ Continua al prossimo tentativo
      }
    }
  }, []);

  /**
   * Ottiene lo stato di retry per un nodo e fase specifici.
   */
  const getRetryState = useCallback((nodeId: string, phase: string): RetryState => {
    const key = `${nodeId}:${phase}`;
    return retryStateRef.current.get(key) || { attempt: 0, status: 'idle' };
  }, []);

  /**
   * Resetta lo stato di retry per un nodo e fase specifici.
   */
  const resetRetryState = useCallback((nodeId: string, phase: string): void => {
    const key = `${nodeId}:${phase}`;
    retryStateRef.current.delete(key);
  }, []);

  return {
    retryNodePhase,
    getRetryState,
    resetRetryState,
  };
}
