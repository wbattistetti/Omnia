import type { OrchestratorSseErrorPayload } from '@components/DialogueEngine/orchestratorAdapter';

const TTS_MODEL_NEEDLES = [/tts\.model_id/i, /invalid\s+tts\s+model/i, /tts\s+model(_id)?\s+is\s+invalid/i];

/** Detects real TTS-model validation errors only (`tts.model_id`), not LLM constraints. */
export function isConvaiNonEnglishTtsConstraintError(payload: OrchestratorSseErrorPayload): boolean {
  const hay = [payload.error ?? '', payload.apiServerBody ?? '', payload.elevenlabsRawBody ?? ''].join('\n');
  return TTS_MODEL_NEEDLES.some((needle) => needle.test(hay));
}

/** Modello TTS applicato dal fix rapido dalla card runtime. */
export const CONVAI_TTS_FIX_MODEL_ID = 'eleven_flash_v2_5';
