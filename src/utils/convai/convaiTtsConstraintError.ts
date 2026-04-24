import type { OrchestratorSseErrorPayload } from '@components/DialogueEngine/orchestratorAdapter';

const NEEDLE = /non-english agents must use turbo or flash v2_5/i;

/** Errore ElevenLabs ConvAI su `tts.model_id` per agenti non inglesi (non è l’LLM «turbo» GPT). */
export function isConvaiNonEnglishTtsConstraintError(payload: OrchestratorSseErrorPayload): boolean {
  const hay = [payload.error ?? '', payload.apiServerBody ?? '', payload.elevenlabsRawBody ?? ''].join('\n');
  return NEEDLE.test(hay);
}

/** Modello TTS applicato dal fix rapido dalla card runtime. */
export const CONVAI_TTS_FIX_MODEL_ID = 'eleven_flash_v2_5';
