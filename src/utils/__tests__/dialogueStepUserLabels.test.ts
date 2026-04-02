import { describe, expect, it } from 'vitest';
import { getDialogueStepUserLabel, ordinalItalianEscalation } from '../dialogueStepUserLabels';

describe('dialogueStepUserLabels', () => {
  it('maps known step keys to Italian labels', () => {
    expect(getDialogueStepUserLabel('noMatch')).toBe('Non capisco');
    expect(getDialogueStepUserLabel('noInput')).toBe('Non sento');
  });

  it('falls back for unknown or empty step keys', () => {
    expect(getDialogueStepUserLabel(undefined)).toBe('questo passo');
    expect(getDialogueStepUserLabel('')).toBe('questo passo');
    expect(getDialogueStepUserLabel('customStep')).toBe('customStep');
  });

  it('ordinalItalianEscalation covers 0-based indices', () => {
    expect(ordinalItalianEscalation(0)).toBe('primo');
    expect(ordinalItalianEscalation(1)).toBe('secondo');
    expect(ordinalItalianEscalation(9)).toBe('decimo');
    expect(ordinalItalianEscalation(10)).toBe('11°');
  });

  it('ordinalItalianEscalation treats invalid as primo', () => {
    expect(ordinalItalianEscalation(undefined)).toBe('primo');
    expect(ordinalItalianEscalation(-1)).toBe('primo');
  });
});
