import { describe, expect, it } from 'vitest';
import {
  agentMessageToPlainPreview,
  normalizePlainPhraseKey,
} from '../stylePhrasePlainText';

describe('agentMessageToPlainPreview', () => {
  it('strips semantic and style delimiters', () => {
    expect(
      agentMessageToPlainPreview('Visita [cardiologica], «essere sicuri» ok.')
    ).toBe('Visita cardiologica, essere sicuri ok.');
  });
});

describe('normalizePlainPhraseKey', () => {
  it('ignores punctuation and extra spaces for dedupe', () => {
    const a = normalizePlainPhraseKey(
      'Grazie per la precisazione: RX ginocchio bilaterale, giusto?'
    );
    const b = normalizePlainPhraseKey(
      'Grazie per la precisazione RX ginocchio bilaterale giusto'
    );
    expect(a).toBe(b);
  });
});
