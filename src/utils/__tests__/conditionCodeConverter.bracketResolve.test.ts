import { describe, expect, it, vi } from 'vitest';
import {
  convertDSLLabelsToGUIDs,
  resolveBracketLabelTokenToGuid,
} from '../conditionCodeConverter';

describe('convertDSLLabelsToGUIDs / resolveBracketLabelTokenToGuid', () => {
  const g1 = '11111111-1111-4111-8111-111111111111';
  const g2 = '22222222-2222-4222-8222-222222222222';

  it('matches case-insensitively: Colore vs [colore]', () => {
    const m = new Map<string, string>([
      [g1, 'Colore'],
    ]);
    const out = convertDSLLabelsToGUIDs('[colore] == 1', m);
    expect(out).toContain(g1);
    expect(out).toBe(`[${g1}] == 1`);
  });

  it('matches last segment: dati.colore vs [colore]', () => {
    const m = new Map<string, string>([
      [g2, 'dati.colore'],
    ]);
    const out = convertDSLLabelsToGUIDs('[colore] > 0', m);
    expect(out).toContain(g2);
  });

  it('resolveBracketLabelTokenToGuid returns guid for normalized match', () => {
    const m = new Map<string, string>([[g1, 'My Var']]);
    expect(resolveBracketLabelTokenToGuid('my   var', m)).toBe(g1);
  });

  it('warns when token cannot resolve', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const m = new Map<string, string>();
    expect(convertDSLLabelsToGUIDs('[missing]', m)).toBe('[missing]');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
