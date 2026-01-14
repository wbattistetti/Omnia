// Service per gestire il training degli embeddings

export interface TrainingPhrase {
  id: string;
  text: string;
  type: 'matching' | 'not-matching';
}

export interface TrainRequest {
  intentId: string;
  phrases: TrainingPhrase[];
}

export interface TrainResponse {
  intentId: string;
  modelReady: boolean;
  method: 'Local';
  stats: {
    matching: number;
    notMatching: number;
    total: number;
    processed: number;
    failed: number;
  };
}

export interface ModelStatus {
  intentId: string;
  modelReady: boolean;
  hasEmbeddings: boolean;
}

/**
 * Avvia il training per un intent: calcola embeddings per tutte le frasi
 */
export async function trainIntent(request: TrainRequest): Promise<TrainResponse> {
  // ✅ FIX: Aggiungi timeout per evitare che il training resti bloccato
  const TIMEOUT_MS = 300000; // 5 minuti (il training può richiedere tempo per molte frasi)
  const startTime = Date.now();

  console.log('[TrainingService][TRAIN][INIT] Initializing training request', {
    timestamp: new Date().toISOString(),
    intentId: request.intentId,
    phrasesCount: request.phrases.length,
    timeoutMs: TIMEOUT_MS,
    url: `/api/intents/${request.intentId}/train`
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.error('[TrainingService][TRAIN][TIMEOUT] Timeout triggered', {
      timestamp: new Date().toISOString(),
      elapsedMs: Date.now() - startTime,
      timeoutMs: TIMEOUT_MS
    });
    controller.abort();
  }, TIMEOUT_MS);

  try {
    console.log('[TrainingService][TRAIN][START] Starting fetch request', {
      timestamp: new Date().toISOString(),
      intentId: request.intentId,
      phrasesCount: request.phrases.length,
      matchingCount: request.phrases.filter(p => p.type === 'matching').length,
      notMatchingCount: request.phrases.filter(p => p.type === 'not-matching').length,
      samplePhrases: request.phrases.slice(0, 3).map(p => ({ id: p.id, type: p.type, text: p.text?.substring(0, 30) }))
    });

    const requestBody = {
      intentId: request.intentId,
      phrases: request.phrases
    };

    console.log('[TrainingService][TRAIN][FETCH] Sending POST request', {
      url: `/api/intents/${request.intentId}/train`,
      method: 'POST',
      bodySize: JSON.stringify(requestBody).length,
      phrasesCount: request.phrases.length
    });

    const fetchStartTime = Date.now();
    const response = await fetch(`/api/intents/${request.intentId}/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    const fetchElapsed = Date.now() - fetchStartTime;
    clearTimeout(timeoutId);

    console.log('[TrainingService][TRAIN][RESPONSE] Received response', {
      timestamp: new Date().toISOString(),
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      fetchTimeMs: fetchElapsed,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      console.error('[TrainingService][TRAIN][ERROR] Response not OK', {
        status: response.status,
        statusText: response.statusText,
        url: response.url
      });

      const errorText = await response.text();
      console.error('[TrainingService][TRAIN][ERROR] Error response body', {
        status: response.status,
        errorText: errorText,
        errorTextLength: errorText.length
      });

      let errorMsg = `HTTP ${response.status}: ${errorText}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMsg = errorJson.detail || errorMsg;
        console.error('[TrainingService][TRAIN][ERROR] Parsed error JSON', errorJson);
      } catch (parseErr) {
        console.warn('[TrainingService][TRAIN][ERROR] Could not parse error as JSON', parseErr);
      }

      console.error('[TrainingService][TRAIN][ERROR] Throwing error', {
        status: response.status,
        errorMsg
      });
      throw new Error(errorMsg);
    }

    console.log('[TrainingService][TRAIN][PARSE] Parsing response JSON...');
    const result = await response.json();
    const totalElapsed = Date.now() - startTime;

    console.log('[TrainingService][TRAIN][SUCCESS] Training completed successfully', {
      timestamp: new Date().toISOString(),
      totalTimeMs: totalElapsed,
      fetchTimeMs: fetchElapsed,
      intentId: result.intentId,
      modelReady: result.modelReady,
      stats: result.stats,
      result: result
    });

    return result;
  } catch (err) {
    clearTimeout(timeoutId);
    const totalElapsed = Date.now() - startTime;

    if (err instanceof Error && err.name === 'AbortError') {
      console.error('[TrainingService][TRAIN][TIMEOUT] Request aborted due to timeout', {
        timestamp: new Date().toISOString(),
        intentId: request.intentId,
        timeoutMs: TIMEOUT_MS,
        elapsedMs: totalElapsed,
        errorName: err.name,
        errorMessage: err.message
      });
      throw new Error(`Training timeout after ${TIMEOUT_MS / 1000} seconds. The backend may be slow or the model may not be installed.`);
    }

    console.error('[TrainingService][TRAIN][ERROR] Training failed with error', {
      timestamp: new Date().toISOString(),
      elapsedMs: totalElapsed,
      error: err,
      errorName: err instanceof Error ? err.name : 'Unknown',
      errorMessage: err instanceof Error ? err.message : String(err),
      errorStack: err instanceof Error ? err.stack : undefined,
      intentId: request.intentId,
      phrasesCount: request.phrases.length
    });

    if (err instanceof TypeError && err.message.includes('fetch')) {
      console.error('[TrainingService][TRAIN][ERROR] Network error detected', {
        message: err.message,
        possibleCauses: [
          'Backend server not running',
          'CORS issue',
          'Network connectivity problem',
          'Wrong URL or endpoint'
        ]
      });
    }

    throw err;
  }
}

/**
 * Verifica se il modello è pronto per un intent
 */
export async function getModelStatus(intentId: string): Promise<ModelStatus> {
  const startTime = Date.now();
  console.log('[TrainingService][STATUS][INIT] Checking model status', {
    timestamp: new Date().toISOString(),
    intentId,
    url: `/api/intents/${intentId}/model-status`
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn('[TrainingService][STATUS][TIMEOUT] Status check timeout', {
      timestamp: new Date().toISOString(),
      elapsedMs: Date.now() - startTime,
      intentId
    });
    controller.abort();
  }, 10000); // 10 secondi per status check

  try {
    console.log('[TrainingService][STATUS][FETCH] Sending GET request...');
    const response = await fetch(`/api/intents/${intentId}/model-status`, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const elapsed = Date.now() - startTime;

    console.log('[TrainingService][STATUS][RESPONSE] Received response', {
      timestamp: new Date().toISOString(),
      status: response.status,
      ok: response.ok,
      elapsedMs: elapsed
    });

    if (!response.ok) {
      console.error('[TrainingService][STATUS][ERROR] Response not OK', {
        status: response.status,
        statusText: response.statusText
      });
      throw new Error(`Failed to get model status: ${response.status}`);
    }

    const result = await response.json();
    console.log('[TrainingService][STATUS][SUCCESS] Model status retrieved', {
      timestamp: new Date().toISOString(),
      elapsedMs: elapsed,
      result
    });

    return result;
  } catch (err) {
    clearTimeout(timeoutId);
    const elapsed = Date.now() - startTime;

    if (err instanceof Error && err.name === 'AbortError') {
      console.warn('[TrainingService][STATUS][TIMEOUT] Request aborted', {
        timestamp: new Date().toISOString(),
        elapsedMs: elapsed,
        intentId
      });
      // Ritorna stato di default invece di lanciare errore
      return {
        intentId,
        modelReady: false,
        hasEmbeddings: false
      };
    }

    console.error('[TrainingService][STATUS][ERROR] Failed to get model status', {
      timestamp: new Date().toISOString(),
      elapsedMs: elapsed,
      error: err,
      errorName: err instanceof Error ? err.name : 'Unknown',
      errorMessage: err instanceof Error ? err.message : String(err)
    });

    throw err;
  }
}
