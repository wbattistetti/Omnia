import { describe, expect, it } from 'vitest';
import { detectExcelHeaderRow, scoreExcelHeaderCandidate } from '../detectExcelHeaderRow';

describe('detectExcelHeaderRow', () => {
  it('skips title row and picks multi-column header (Medici-style sheet)', () => {
    const matrix = [
      ['ultimo aggiornamento dati: 02/04/2026'],
      ['PAROS'],
      [
        'COGNOME',
        'NOME',
        'SESSO',
        'ID Dottore',
        'Divisione (Name)',
        '',
        'prestazione default (service)',
        'codice prest default (serviceId)',
      ],
      ['Arcidiacono', 'Barbara', 'F', '56', 'OCULISTICA', '', 'oculistica', '206'],
    ];
    const headers = detectExcelHeaderRow(matrix);
    expect(headers).toContain('COGNOME');
    expect(headers).toContain('NOME');
    expect(headers.length).toBeGreaterThanOrEqual(6);
    expect(headers.some((h) => h.includes('ultimo aggiornamento'))).toBe(false);
  });

  it('picks first row when it is already the header (visite-style)', () => {
    const matrix = [
      ['ID', 'NOME'],
      ['4', 'Visita Specialistica'],
    ];
    expect(detectExcelHeaderRow(matrix)).toEqual(['ID', 'NOME']);
  });

  it('rejects sheet with no multi-column header', () => {
    const matrix = [['solo titolo'], ['ancora uno']];
    expect(() => detectExcelHeaderRow(matrix)).toThrow(/almeno due colonne/i);
  });
});

describe('scoreExcelHeaderCandidate', () => {
  it('prefers multi-column short labels over single-cell banner', () => {
    const banner = scoreExcelHeaderCandidate(['ultimo aggiornamento dati: 02/04/2026'], null);
    const header = scoreExcelHeaderCandidate(['ID', 'NOME', 'SESSO'], ['a', 'b', 'c']);
    expect(header).toBeGreaterThan(banner);
  });
});
