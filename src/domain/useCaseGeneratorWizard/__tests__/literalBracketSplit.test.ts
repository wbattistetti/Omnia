import { describe, expect, it } from 'vitest';
import { splitLiteralBracketed } from '../literalBracketSplit';

describe('splitLiteralBracketed', () => {
  it('returns an empty array for empty / non-string input', () => {
    expect(splitLiteralBracketed('')).toEqual([]);
    // @ts-expect-error - covering runtime safety on non-string
    expect(splitLiteralBracketed(null)).toEqual([]);
    // @ts-expect-error - covering runtime safety on non-string
    expect(splitLiteralBracketed(undefined)).toEqual([]);
  });

  it('returns a single text segment when the input has no brackets', () => {
    expect(splitLiteralBracketed('Buongiorno, come stai?')).toEqual([
      { kind: 'text', text: 'Buongiorno, come stai?' },
    ]);
  });

  it('splits a single bracketed literal in the middle of text', () => {
    expect(
      splitLiteralBracketed('La prima data disponibile è il [15 giugno 2026 alle 09:30]. Confermi?')
    ).toEqual([
      { kind: 'text', text: 'La prima data disponibile è il ' },
      { kind: 'literal', text: '15 giugno 2026 alle 09:30' },
      { kind: 'text', text: '. Confermi?' },
    ]);
  });

  it('splits multiple bracketed literals separated by text', () => {
    expect(
      splitLiteralBracketed('La prima data disponibile è il [15 giugno 2026] alle [09:30].')
    ).toEqual([
      { kind: 'text', text: 'La prima data disponibile è il ' },
      { kind: 'literal', text: '15 giugno 2026' },
      { kind: 'text', text: ' alle ' },
      { kind: 'literal', text: '09:30' },
      { kind: 'text', text: '.' },
    ]);
  });

  it('treats an unclosed bracket as plain text (fail-loud upstream via warnings)', () => {
    expect(splitLiteralBracketed('Manca chiusura [15 giugno')).toEqual([
      { kind: 'text', text: 'Manca chiusura [15 giugno' },
    ]);
  });

  it('keeps adjacent literals separable (no merging)', () => {
    expect(splitLiteralBracketed('[a][b]')).toEqual([
      { kind: 'literal', text: 'a' },
      { kind: 'literal', text: 'b' },
    ]);
  });

  it('emits an empty literal segment for "[]"', () => {
    expect(splitLiteralBracketed('vuoto: []')).toEqual([
      { kind: 'text', text: 'vuoto: ' },
      { kind: 'literal', text: '' },
    ]);
  });

  it('reconstructs the original input by concatenating segments', () => {
    const inputs = [
      'no bracket',
      'open [a] then [b]',
      'tail [trailing]',
      'leading [first] head',
      '[whole]',
      '',
      'unbalanced [open',
    ];
    for (const input of inputs) {
      const segments = splitLiteralBracketed(input);
      const rebuilt = segments
        .map((s) => (s.kind === 'literal' ? `[${s.text}]` : s.text))
        .join('');
      expect(rebuilt).toBe(input);
    }
  });
});
