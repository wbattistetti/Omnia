import { describe, expect, it } from 'vitest';
import type { OrchestratorSseErrorPayload } from '@components/DialogueEngine/orchestratorAdapter';
import {
  CONVAI_TTS_FIX_MODEL_ID,
  isConvaiNonEnglishTtsConstraintError,
} from '../convaiTtsConstraintError';

function payload(partial: Partial<OrchestratorSseErrorPayload>): OrchestratorSseErrorPayload {
  return { error: '', phase: 'startAgent', ...partial };
}

describe('isConvaiNonEnglishTtsConstraintError', () => {
  it('returns true when error contains tts.model_id', () => {
    expect(
      isConvaiNonEnglishTtsConstraintError(
        payload({
          error: 'Invalid conversation config: tts.model_id is invalid',
        })
      )
    ).toBe(true);
  });

  it('matches case-insensitively in API body', () => {
    expect(
      isConvaiNonEnglishTtsConstraintError(
        payload({
          apiServerBody: '{"detail":"TTS.MODEL_ID not allowed for this voice"}',
        })
      )
    ).toBe(true);
  });

  it('returns false for LLM-only constraint message', () => {
    expect(
      isConvaiNonEnglishTtsConstraintError(
        payload({
          error: 'Non-English Agents must use turbo or flash v2_5',
        })
      )
    ).toBe(false);
  });

  it('returns false for unrelated startAgent errors', () => {
    expect(
      isConvaiNonEnglishTtsConstraintError(
        payload({
          error: 'invalid_api_key',
        })
      )
    ).toBe(false);
  });
});

describe('CONVAI_TTS_FIX_MODEL_ID', () => {
  it('is eleven_flash_v2_5', () => {
    expect(CONVAI_TTS_FIX_MODEL_ID).toBe('eleven_flash_v2_5');
  });
});
