import { describe, expect, it } from 'vitest';
import { columnNameToVariable } from '../kbDocumentColumnMap';
import { parseKbCsvContent, parseKbTextContent } from '../parseKbDocument';

describe('columnNameToVariable', () => {
  it('derives ids only from column headers (no semantic aliases)', () => {
    expect(columnNameToVariable('ID')).toBe('id');
    expect(columnNameToVariable('NOME')).toBe('nome');
    expect(columnNameToVariable('Prestazione')).toBe('prestazione');
    expect(columnNameToVariable('Sinonimi')).toBe('sinonimi');
    expect(columnNameToVariable('Nome Ufficiale')).toBe('nomeUfficiale');
  });
});

describe('parseKbTextContent', () => {
  it('parses tab-separated header row', () => {
    const text = 'ID\tPrestazione\tSinonimi\n1\tVisita\tvisita medica';
    const result = parseKbTextContent(text);
    expect(result.variables.map((v) => v.internalName)).toEqual(['id', 'prestazione', 'sinonimi']);
    expect(result.variables[0].placeholder).toBe('{{id}}');
    expect(result.variableDictionary.id).toBe('ID');
  });

  it('parses two-column ID + NOME like typical visit Excel export', () => {
    const text = 'ID\tNOME\n4\tVisita Specialistica';
    const result = parseKbTextContent(text);
    expect(result.variables.map((v) => v.internalName)).toEqual(['id', 'nome']);
    expect(result.variables.map((v) => v.sourceColumn)).toEqual(['ID', 'NOME']);
  });

  it('throws on empty file', () => {
    expect(() => parseKbTextContent('   \n  ')).toThrow(/vuoto/i);
  });

  it('parseKbCsvContent skips banner rows before column headers', () => {
    const text = [
      'ultimo aggiornamento dati: 02/04/2026,,,,,,,',
      'PAROS,,,,,,,',
      'COGNOME,NOME,SESSO',
      'Arcidiacono,Barbara,F',
    ].join('\n');
    const result = parseKbCsvContent(text);
    expect(result.format).toBe('csv');
    expect(result.variables.map((v) => v.internalName)).toEqual(['cognome', 'nome', 'sesso']);
  });

  it('parses comma-separated header row (CSV)', () => {
    const text = 'ID,NOME,EMAIL\n1,Mario,mario@example.com';
    const result = parseKbTextContent(text, { format: 'csv' });
    expect(result.format).toBe('csv');
    expect(result.variables.map((v) => v.internalName)).toEqual(['id', 'nome', 'email']);
    expect(result.variables.map((v) => v.sourceColumn)).toEqual(['ID', 'NOME', 'EMAIL']);
  });
});
