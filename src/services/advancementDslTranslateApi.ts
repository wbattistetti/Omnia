/**
 * Client for POST /design/advancement-dsl-translate (Node design-time).
 */

export interface AdvancementDslTranslateRequest {
  naturalLanguage: string;
  targetParam: string;
  targetType: string;
  signature?: {
    parameters: Record<string, { type: string; description?: string }>;
  };
  provider?: 'groq' | 'openai';
  model?: string;
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
  const res = await fetch('/design/advancement-dsl-translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as AdvancementDslTranslateResponse;
  if (!res.ok) {
    return {
      success: false,
      error: data.error || res.statusText || 'advancement-dsl-translate failed',
    };
  }
  return data;
}
