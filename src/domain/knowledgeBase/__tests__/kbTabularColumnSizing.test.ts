import { describe, expect, it } from 'vitest';
import {
  kbTabularColumnWidthCh,
  kbTabularEditableFieldWidthCh,
} from '../kbTabularColumnSizing';

describe('kbTabularColumnSizing', () => {
  it('sizes narrow columns for short values', () => {
    expect(kbTabularColumnWidthCh('code', ['12', '14', '60'])).toBeLessThanOrEqual(6);
  });

  it('caps wide columns', () => {
    const long = 'Visita Specialistica Pneumologica con testo lungo extra';
    expect(kbTabularColumnWidthCh('label', [long])).toBeLessThanOrEqual(42);
  });

  it('editable field grows with typed text up to max', () => {
    expect(kbTabularEditableFieldWidthCh(5, 'hello')).toBe(6);
    expect(kbTabularEditableFieldWidthCh(5, 'x'.repeat(80))).toBe(42);
  });
});
