/**
 * Client for POST /design/advancement-dsl-translate (Node design-time).
 */

import { designAiFetch } from './designAiRequestPipeline';
import { emitDesignAiLlmBurstFromErrorResponse } from '../utils/aiAgentHighFrequencyAlert';

/** `unifiedBackend` = script unico che restituisce un oggetto su tutti i SEND (ricalcolo backend). */
export type AdvancementTranslateMode = 'singleParam' | 'unifiedBackend';

export interface AdvancementDslTranslateRequest {
  naturalLanguage: string;
  /** Opzionale se `mode` è `unifiedBackend`. */
  targetParam?: string;
  /** Opzionale se `mode` è `unifiedBackend`. */
  targetType?: string;
  signature?: {
    parameters: Record<string, { type: string; description?: string }>;
  };
  provider?: 'groq' | 'openai';
  model?: string;
  mode?: AdvancementTranslateMode;
}

export interface AdvancementDslTranslateResponse {
  success: boolean;
  dslExpression?: string;
  /** Presente solo se l’IA ha riscritto la descrizione; omesso se il testo era già adeguato o uguale all’input. */
  refinedNaturalLanguage?: string;
  error?: string;
}

export async function translateAdvancementDsl(
  body: AdvancementDslTranslateRequest
): Promise<AdvancementDslTranslateResponse> {
  const res = await designAiFetch('/design/advancement-dsl-translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as AdvancementDslTranslateResponse & { code?: string };
  if (!res.ok) {
    emitDesignAiLlmBurstFromErrorResponse(res, data);
    return {
      success: false,
      error: data.error || res.statusText || 'advancement-dsl-translate failed',
    };
  }
  return data;
}
