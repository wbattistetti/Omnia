import { describe, expect, it } from 'vitest';
import {
  convaiKbDocNamesMatch,
  convaiKbSearchPrefixes,
} from '../convaiKbDocNameMatch';

describe('convaiKbDocNamesMatch', () => {
  it('matches exact names', () => {
    expect(convaiKbDocNamesMatch('PAROS medici.xlsx', 'PAROS medici.xlsx')).toBe(true);
  });

  it('matches when ElevenLabs truncates with ellipsis', () => {
    const full =
      'PAROS - visite prenotabili - prima e seconda tranche - dettaglio completo.xlsx';
    const truncated = 'PAROS - visite prenotabili - prima e seconda tranche -...';
    expect(convaiKbDocNamesMatch(full, truncated)).toBe(true);
  });

  it('does not match unrelated names', () => {
    expect(convaiKbDocNamesMatch('PAROS medici.xlsx', 'Altro documento.xlsx')).toBe(false);
  });
});

describe('convaiKbSearchPrefixes', () => {
  it('returns short prefix suitable for ElevenLabs search API', () => {
    const prefixes = convaiKbSearchPrefixes(
      'PAROS - visite prenotabili - prima e seconda tranche - file.xlsx'
    );
    expect(prefixes.some((p) => p.length <= 48)).toBe(true);
    expect(prefixes.some((p) => p.startsWith('PAROS - visite'))).toBe(true);
  });
});
