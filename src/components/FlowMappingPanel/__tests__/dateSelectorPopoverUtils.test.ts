import { describe, expect, it } from 'vitest';
import {
  commitTextInputToValue,
  formatIsoToItalianDisplay,
  isSymbolicDateConstant,
  parseItalianDateString,
  parseIsoDateLocal,
  symbolicToDisplayLabel,
  toIsoDateLocal,
  valueToInputDisplay,
} from '../dateSelectorPopoverUtils';

describe('dateSelectorPopoverUtils', () => {
  it('toIsoDateLocal uses local midnight', () => {
    const d = new Date(2026, 4, 2);
    expect(toIsoDateLocal(d)).toBe('2026-05-02');
  });

  it('parseIsoDateLocal round-trips', () => {
    const d = parseIsoDateLocal('2026-12-31');
    expect(d).toBeDefined();
    expect(toIsoDateLocal(d!)).toBe('2026-12-31');
  });

  it('parseItalianDateString parses gg/mm/aaaa', () => {
    expect(parseItalianDateString('02/05/2026')).toBe('2026-05-02');
    expect(parseItalianDateString('2/5/2026')).toBe('2026-05-02');
    expect(parseItalianDateString('32/01/2026')).toBeNull();
  });

  it('formatIsoToItalianDisplay', () => {
    expect(formatIsoToItalianDisplay('2026-05-02')).toBe('02/05/2026');
  });

  it('isSymbolicDateConstant', () => {
    expect(isSymbolicDateConstant('Now')).toBe(true);
    expect(isSymbolicDateConstant('tomorrow')).toBe(true);
    expect(isSymbolicDateConstant('Yesterday')).toBe(false);
    expect(isSymbolicDateConstant('2026-01-01')).toBe(false);
  });

  it('symbolicToDisplayLabel', () => {
    expect(symbolicToDisplayLabel('Now')).toBe('Oggi');
    expect(symbolicToDisplayLabel('Tomorrow')).toBe('Domani');
    expect(symbolicToDisplayLabel('Yesterday')).toBe('Yesterday');
  });

  it('valueToInputDisplay', () => {
    expect(valueToInputDisplay('')).toBe('');
    expect(valueToInputDisplay('2026-03-15')).toBe('15/03/2026');
    expect(valueToInputDisplay('Now')).toBe('Oggi');
    expect(valueToInputDisplay('Tomorrow')).toBe('Domani');
    expect(valueToInputDisplay('Yesterday')).toBe('Yesterday');
  });

  it('commitTextInputToValue', () => {
    expect(commitTextInputToValue('')).toBe('');
    expect(commitTextInputToValue('02/05/2026')).toBe('2026-05-02');
    expect(commitTextInputToValue('2026-05-02')).toBe('2026-05-02');
    expect(commitTextInputToValue('oggi')).toBe('Now');
    expect(commitTextInputToValue('domani')).toBe('Tomorrow');
    expect(commitTextInputToValue('ieri')).toBeNull();
    expect(commitTextInputToValue('Now')).toBe('Now');
    expect(commitTextInputToValue('2026-13-40')).toBeNull();
    expect(commitTextInputToValue('invalid')).toBeNull();
  });
});
