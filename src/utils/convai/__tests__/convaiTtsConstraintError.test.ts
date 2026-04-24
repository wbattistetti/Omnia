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
  it('returns true when ElevenLabs message appears in error', () => {
    expect(
      isConvaiNonEnglishTtsConstraintError(
        payload({
          error: 'Non-English Agents must use turbo or flash v2_5',
        })
      )
    ).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(
      isConvaiNonEnglishTtsConstraintError(
        payload({
          apiServerBody: '{"detail":"non-english agents must use turbo or flash v2_5"}',
        })
      )
    ).toBe(true);
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
