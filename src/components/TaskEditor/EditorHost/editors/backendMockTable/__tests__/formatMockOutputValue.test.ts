import { describe, it, expect } from 'vitest';
import {
  formatMockOutputValue,
  singleLinePreview,
  tryFormatArrayOfIsoIntervalRowsHuman,
} from '../formatMockOutputValue';

describe('formatMockOutputValue', () => {
  it('pretty indents objects', () => {
    const s = formatMockOutputValue({ a: 1, b: 2 }, 'pretty');
    expect(s).toContain('\n');
    expect(s).toContain('"a"');
  });

  it('js stays compact for objects', () => {
    const s = formatMockOutputValue({ a: 1 }, 'js');
    expect(s).not.toMatch(/\n\s+"a"/);
  });

  it('singleLinePreview collapses whitespace', () => {
    expect(singleLinePreview('a\n  b\tc', 20)).toBe('a b c');
  });

  it('pretty uses human lines for start/end slot arrays', () => {
    const slots = [
      { start: '2026-05-02T12:18:00.000Z', end: '2026-05-02T12:48:00.000Z' },
      { start: '2026-05-02T11:59:00.000Z', end: '2026-05-02T12:29:00.000Z' },
    ];
    const s = formatMockOutputValue(slots, 'pretty');
    expect(s).toContain('\n');
    expect(s).not.toContain('"start"');
    expect(tryFormatArrayOfIsoIntervalRowsHuman(slots)).toBe(s);
  });

  it('pretty falls back to JSON for non-interval arrays', () => {
    const s = formatMockOutputValue([{ a: 1 }, { a: 2 }], 'pretty');
    expect(s).toContain('"a"');
  });
});
