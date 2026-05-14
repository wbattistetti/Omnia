/**
 * Notifica la UI quando il backend applica il burst guard sulle rotte di progettazione IA
 * (429 + {@link DESIGN_AI_LLM_BURST_CODE} o legacy {@link AI_AGENT_GENERATE_BURST_CODE}).
 */

export const DESIGN_AI_LLM_BURST_CODE = 'DESIGN_AI_LLM_BURST' as const;

/** @deprecated Mantenuto per compatibilità con risposte cached. */
export const AI_AGENT_GENERATE_BURST_CODE = 'AI_AGENT_GENERATE_BURST' as const;

export const AI_AGENT_HIGH_FREQUENCY_EVENT = 'omnia:ai-agent-high-frequency' as const;

export type AiAgentHighFrequencyEventDetail = {
  /** Messaggio opzionale restituito dal server (es. retry stimato). */
  serverMessage?: string;
};

function isDesignAiBurstCode(code: unknown): boolean {
  return code === DESIGN_AI_LLM_BURST_CODE || code === AI_AGENT_GENERATE_BURST_CODE;
}

/**
 * Se la risposta indica rate limit burst sulle rotte design LLM, emette un CustomEvent.
 */
export function emitDesignAiLlmBurstFromErrorResponse(res: Response, body: unknown): void {
  if (typeof window === 'undefined') return;
  if (res.status !== 429 || !body || typeof body !== 'object') return;
  const code = (body as { code?: unknown }).code;
  if (!isDesignAiBurstCode(code)) return;
  const raw = (body as { error?: unknown }).error;
  const serverMessage = typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
  window.dispatchEvent(
    new CustomEvent<AiAgentHighFrequencyEventDetail>(AI_AGENT_HIGH_FREQUENCY_EVENT, {
      detail: { serverMessage },
    })
  );
}

/** @deprecated Usare {@link emitDesignAiLlmBurstFromErrorResponse}. */
export const emitAiAgentGenerateBurstFromErrorResponse = emitDesignAiLlmBurstFromErrorResponse;
