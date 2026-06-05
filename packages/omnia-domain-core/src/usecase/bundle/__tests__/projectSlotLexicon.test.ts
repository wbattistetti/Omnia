import { describe, expect, it } from 'vitest';
import {
  resolveSlotIdFromDraft,
  slugifySlotIdDraft,
} from '../projectSlotLexicon';

describe('slugifySlotIdDraft', () => {
  it('converts spaced labels to snake_case', () => {
    expect(slugifySlotIdDraft('esame obbligatorio')).toBe('esame_obbligatorio');
    expect(slugifySlotIdDraft('Esame Obbligatori')).toBe('esame_obbligatori');
  });

  it('strips accents and punctuation', () => {
    expect(slugifySlotIdDraft('Tipologia visità!')).toBe('tipologia_visita');
  });
});

describe('resolveSlotIdFromDraft', () => {
  it('accepts slugified designer input', () => {
    expect(resolveSlotIdFromDraft('esame obbligatorio')).toBe('esame_obbligatorio');
  });

  it('rejects unclassified placeholders', () => {
    expect(resolveSlotIdFromDraft('undefined')).toBeNull();
    expect(resolveSlotIdFromDraft('slot')).toBeNull();
  });

  it('rejects empty input', () => {
    expect(resolveSlotIdFromDraft('   ')).toBeNull();
  });
});
