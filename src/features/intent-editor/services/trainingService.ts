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
  const response = await fetch(`/api/intents/${request.intentId}/train`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intentId: request.intentId,
      phrases: request.phrases
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMsg = `HTTP ${response.status}: ${errorText}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMsg = errorJson.detail || errorMsg;
    } catch {}
    throw new Error(errorMsg);
  }

  return await response.json();
}

/**
 * Verifica se il modello è pronto per un intent
 */
export async function getModelStatus(intentId: string): Promise<ModelStatus> {
  const response = await fetch(`/api/intents/${intentId}/model-status`);

  if (!response.ok) {
    throw new Error(`Failed to get model status: ${response.status}`);
  }

  return await response.json();
}
