import { describe, expect, it } from 'vitest';
import {
  isKbTabularPreviewName,
  parseKbTabularDocument,
  parseMarkdownPipeTable,
} from '../parseKbTabularText';

describe('parseKbTabularText', () => {
  it('parses tab-separated preview', () => {
    const text = 'cognome\tnome\nRossi\tMario\nBianchi\tLuigi';
    const parsed = parseKbTabularDocument(text);
    expect(parsed).not.toBeNull();
    expect(parsed!.grid.headers).toEqual(['cognome', 'nome']);
    expect(parsed!.grid.rows).toHaveLength(2);
    expect(parsed!.grid.rows[0]).toEqual(['Rossi', 'Mario']);
  });

  it('skips banner rows and aligns Medici-style sheet', () => {
    const text = [
      'ultimo aggiornamento dati: 02/04/2026',
      'PAROS',
      'COGNOME\tNOME\tSESSO\tID Dottore\tDivisione (Name)\t\tprestazione default (service)\tcodice prest default (serviceId)',
      'Arcidiacono\tBarbara\tF\t56\tOCULISTICA\t\toculistica\t206',
      'Arisi\tMariachiara\tF\t5\tDERMATOLOGIA\t\tdermatologica\t2',
    ].join('\n');
    const parsed = parseKbTabularDocument(text, {
      knownColumnHeaders: ['COGNOME', 'NOME', 'SESSO', 'ID Dottore'],
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.preamble).toEqual([
      'ultimo aggiornamento dati: 02/04/2026',
      'PAROS',
    ]);
    expect(parsed!.grid.headers.some((h) => h.includes('COGNOME'))).toBe(true);
    expect(parsed!.grid.rows[0]).toContain('Arcidiacono');
    expect(parsed!.grid.rows[0]).toContain('Barbara');
  });

  it('returns null for single-column text', () => {
    expect(parseKbTabularDocument('solo\nriga')).toBeNull();
  });

  it('detects tabular preview names', () => {
    expect(isKbTabularPreviewName('file.xlsx')).toBe(true);
    expect(isKbTabularPreviewName('readme.md')).toBe(true);
  });

  it('parses markdown pipe tables', () => {
    const text = [
      '# Medici',
      '',
      '| ID | Cognome | Nome |',
      '| --- | --- | --- |',
      '| 1 | Rossi | Mario |',
      '| 2 | Bianchi | Luigi |',
    ].join('\n');
    const parsed = parseMarkdownPipeTable(text);
    expect(parsed).not.toBeNull();
    expect(parsed!.preamble).toEqual(['# Medici']);
    expect(parsed!.grid.headers).toEqual(['ID', 'Cognome', 'Nome']);
    expect(parsed!.grid.rows).toHaveLength(2);
    expect(parseKbTabularDocument(text)?.grid.rows[0]).toEqual(['1', 'Rossi', 'Mario']);
  });
});
