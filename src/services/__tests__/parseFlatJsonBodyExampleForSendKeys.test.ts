/**
 * Parser fallback SEND da esempio JSON (senza OpenAPI).
 */
import { describe, expect, it } from 'vitest';
import { parseFlatJsonBodyExampleForSendKeys } from '../runBackendCallReadApiForTask';

describe('parseFlatJsonBodyExampleForSendKeys', () => {
  it('rifiuta stringa vuota', () => {
    const r = parseFlatJsonBodyExampleForSendKeys('   ');
    expect(r.keys).toEqual([]);
    expect(r.error).toBeDefined();
  });

  it('rifiuta JSON sintatticamente invalido', () => {
    const r = parseFlatJsonBodyExampleForSendKeys('{');
    expect(r.keys).toEqual([]);
    expect(r.error).toMatch(/non valido/i);
  });

  it('rifiuta array radice e valore primitivo', () => {
    expect(parseFlatJsonBodyExampleForSendKeys('[1]').error).toBeDefined();
    expect(parseFlatJsonBodyExampleForSendKeys('"x"').error).toBeDefined();
  });

  it('ignora oggetti e array di primo livello; mantiene ordine chiavi', () => {
    const r = parseFlatJsonBodyExampleForSendKeys(
      JSON.stringify({
        z: 1,
        nest: { a: 1 },
        arr: [1, 2],
        a: 2,
      })
    );
    expect(r.error).toBeUndefined();
    expect(r.keys).toEqual(['z', 'a']);
    expect(r.optionalApiParams).toEqual([]);
  });

  it('marca opzionali solo null e stringa vuota', () => {
    const r = parseFlatJsonBodyExampleForSendKeys(
      JSON.stringify({
        req: 'x',
        empty: '',
        nul: null,
        zero: 0,
        no: false,
      })
    );
    expect(r.error).toBeUndefined();
    expect(r.keys).toEqual(['req', 'empty', 'nul', 'zero', 'no']);
    expect(new Set(r.optionalApiParams)).toEqual(new Set(['empty', 'nul']));
  });

  it('errore se nessun campo primitivo utile', () => {
    const r = parseFlatJsonBodyExampleForSendKeys(JSON.stringify({ only: { x: 1 } }));
    expect(r.keys).toEqual([]);
    expect(r.error).toBeDefined();
  });
});
