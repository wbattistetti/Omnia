/** Messaggio quando un'azione IA designer parte senza modello configurato. */
export const DESIGNER_LLM_MISSING_MODEL_MESSAGE =
  'Seleziona un modello IA nel selettore «Motore IA» in alto.';

export function isDesignerLlmMissingModelMessage(message: string | null | undefined): boolean {
  if (!message) return false;
  return message === DESIGNER_LLM_MISSING_MODEL_MESSAGE;
}
