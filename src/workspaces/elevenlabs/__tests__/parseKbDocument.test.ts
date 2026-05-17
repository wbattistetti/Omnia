import { describe, expect, it } from 'vitest';
import { columnNameToVariable } from '../kbDocumentColumnMap';
import { parseKbTextContent } from '../parseKbDocument';

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
});
