import { describe, expect, it } from 'vitest';
import {
  extractTokenNames,
  splitTokenizedText,
  validateTokenizedText,
} from '../tokenizedText';

describe('validateTokenizedText', () => {
  it('accepts plain text without brackets', () => {
    expect(validateTokenizedText('Ciao come va?')).toEqual({ ok: true });
  });

  it('accepts balanced single token', () => {
    expect(validateTokenizedText('Ti propongo [data].')).toEqual({ ok: true });
  });

  it('accepts multiple tokens including numeric indices', () => {
    expect(validateTokenizedText('Ho [data1] o [data2] alle [ora].')).toEqual({ ok: true });
  });

  it('rejects unclosed bracket', () => {
    const r = validateTokenizedText('Manca chiusura [data');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/unclosed bracket/);
  });

  it('rejects unmatched close bracket', () => {
    const r = validateTokenizedText('Solo chiusura ] qui');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/unmatched close bracket/);
  });

  it('rejects nested brackets', () => {
    const r = validateTokenizedText('Annidamento [outer [inner] ]');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/nested or unclosed bracket/);
  });

  it('rejects bracket content without letters or digits', () => {
    const r = validateTokenizedText('Token [@#$] simboli');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/invalid bracket content/);
  });

  it('rejects empty bracket content', () => {
    const r = validateTokenizedText('Token vuoto [] qui');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/invalid bracket content ""/);
  });

  it('accepts readable surface with spaces (design-time)', () => {
    expect(validateTokenizedText('Il [8 giugno 2026] alle [09:30].')).toEqual({ ok: true });
  });

  it('accepts readable surface starting with digit (e.g. time)', () => {
    expect(validateTokenizedText('Token [09:30] cifra')).toEqual({ ok: true });
  });

  it('rejects non-string input', () => {
    const r = validateTokenizedText(undefined as unknown as string);
    expect(r.ok).toBe(false);
  });
});

describe('splitTokenizedText', () => {
  it('returns empty array for empty string', () => {
    expect(splitTokenizedText('')).toEqual([]);
  });

  it('returns single text segment when no tokens', () => {
    expect(splitTokenizedText('Ciao!')).toEqual([{ kind: 'text', text: 'Ciao!' }]);
  });

  it('splits text and tokens preserving order', () => {
    expect(splitTokenizedText('Ti propongo [data] alle [ora].')).toEqual([
      { kind: 'text', text: 'Ti propongo ' },
      { kind: 'token', name: 'data' },
      { kind: 'text', text: ' alle ' },
      { kind: 'token', name: 'ora' },
      { kind: 'text', text: '.' },
    ]);
  });

  it('splits readable surface tokens for highlight', () => {
    expect(splitTokenizedText('Ciao [8 giugno] di battesimo')).toEqual([
      { kind: 'text', text: 'Ciao ' },
      { kind: 'token', name: '8 giugno' },
      { kind: 'text', text: ' di battesimo' },
    ]);
  });

  it('keeps unclosed bracket as trailing text', () => {
    expect(splitTokenizedText('Boh [data')).toEqual([{ kind: 'text', text: 'Boh [data' }]);
  });

  it('round-trips token-only string', () => {
    expect(splitTokenizedText('[nome]')).toEqual([{ kind: 'token', name: 'nome' }]);
  });
});

describe('extractTokenNames', () => {
  it('returns names in order of appearance, including duplicates', () => {
    expect(extractTokenNames('Ho [data] e [data] e [ora]')).toEqual(['data', 'data', 'ora']);
  });

  it('extracts readable surfaces and runtime token ids', () => {
    expect(extractTokenNames('Ciao [8 giugno] e [nome]')).toEqual(['8 giugno', 'nome']);
  });

  it('returns empty array when no tokens', () => {
    expect(extractTokenNames('Nessun token qui')).toEqual([]);
  });
});
