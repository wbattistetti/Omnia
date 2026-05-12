/**
 * Test del classificatore deterministico {@link inferTokenType} e del wrapper
 * {@link autoTokenizeAnnotated}. Copre i pattern del dominio appuntamenti IT (data, orario,
 * email, telefono, CF, IVA, importi, URL, numero) + il fallback generico `slot` + la regola
 * di numerazione `data1`/`data2` sui duplicati.
 */
import { describe, expect, it } from 'vitest';
import { autoTokenizeAnnotated, inferTokenType } from '../tokenTypeInference';

describe('inferTokenType — pattern temporali', () => {
  it('classifies bare time as orario (high)', () => {
    expect(inferTokenType('09:00')).toEqual({ name: 'orario', confidence: 'high' });
    expect(inferTokenType('9:00')).toEqual({ name: 'orario', confidence: 'high' });
    expect(inferTokenType('14:30:45')).toEqual({ name: 'orario', confidence: 'high' });
    expect(inferTokenType('9.00 am')).toEqual({ name: 'orario', confidence: 'high' });
  });

  it('classifies italian date with month name as data (medium)', () => {
    expect(inferTokenType('12 giugno')).toEqual({ name: 'data', confidence: 'medium' });
    expect(inferTokenType('12 giugno 2025')).toEqual({ name: 'data', confidence: 'medium' });
    expect(inferTokenType('lunedì 12 giugno')).toEqual({ name: 'data', confidence: 'medium' });
    expect(inferTokenType('LUNEDI 12 GIUGNO 2025')).toEqual({
      name: 'data',
      confidence: 'medium',
    });
  });

  it('classifies ISO date as data (high)', () => {
    expect(inferTokenType('2025-06-12')).toEqual({ name: 'data', confidence: 'high' });
  });

  it('classifies numeric IT date as data (high)', () => {
    expect(inferTokenType('12/06/2025')).toEqual({ name: 'data', confidence: 'high' });
    expect(inferTokenType('12-06-25')).toEqual({ name: 'data', confidence: 'high' });
    expect(inferTokenType('12.06.2025')).toEqual({ name: 'data', confidence: 'high' });
  });

  it('classifies weekday alone as data (medium)', () => {
    expect(inferTokenType('lunedì')).toEqual({ name: 'data', confidence: 'medium' });
    expect(inferTokenType('domenica')).toEqual({ name: 'data', confidence: 'medium' });
  });

  it('classifies datetime combined as data (high)', () => {
    expect(inferTokenType('12 giugno alle 09:00')).toEqual({
      name: 'data',
      confidence: 'high',
    });
    expect(inferTokenType('lunedì 12 giugno alle 09:00')).toEqual({
      name: 'data',
      confidence: 'high',
    });
    expect(inferTokenType('12/06/2025 ore 09:00')).toEqual({
      name: 'data',
      confidence: 'high',
    });
  });
});

describe('inferTokenType — pattern anagrafici/contatto', () => {
  it('classifies email as email (high)', () => {
    expect(inferTokenType('mario.rossi@example.com')).toEqual({
      name: 'email',
      confidence: 'high',
    });
  });

  it('classifies phone number as telefono (high)', () => {
    expect(inferTokenType('+39 333 1234567')).toEqual({ name: 'telefono', confidence: 'high' });
    expect(inferTokenType('333-1234567')).toEqual({ name: 'telefono', confidence: 'high' });
    expect(inferTokenType('(02) 1234567')).toEqual({ name: 'telefono', confidence: 'high' });
  });

  it('classifies italian fiscal code as codicefiscale (high)', () => {
    expect(inferTokenType('RSSMRA85M01H501Z')).toEqual({
      name: 'codicefiscale',
      confidence: 'high',
    });
  });

  it('classifies italian VAT number as partitaiva (high)', () => {
    expect(inferTokenType('12345678901')).toEqual({
      name: 'partitaiva',
      confidence: 'high',
    });
    expect(inferTokenType('IT12345678901')).toEqual({
      name: 'partitaiva',
      confidence: 'high',
    });
  });
});

describe('inferTokenType — pattern numerici/altri', () => {
  it('classifies monetary amount as importo (high)', () => {
    expect(inferTokenType('€ 123,45')).toEqual({ name: 'importo', confidence: 'high' });
    expect(inferTokenType('123,45 €')).toEqual({ name: 'importo', confidence: 'high' });
    expect(inferTokenType('99 euro')).toEqual({ name: 'importo', confidence: 'high' });
    expect(inferTokenType('$99.99')).toEqual({ name: 'importo', confidence: 'high' });
  });

  it('classifies URLs as url (high)', () => {
    expect(inferTokenType('https://example.com/page')).toEqual({
      name: 'url',
      confidence: 'high',
    });
  });

  it('classifies bare numbers as numero (low) — only when no more specific pattern matches', () => {
    expect(inferTokenType('42')).toEqual({ name: 'numero', confidence: 'low' });
    expect(inferTokenType('-3.14')).toEqual({ name: 'numero', confidence: 'low' });
  });

  it('falls back to slot for unclassifiable text', () => {
    expect(inferTokenType('Mario Rossi')).toEqual({ name: 'slot', confidence: 'fallback' });
    expect(inferTokenType('il consenso informato')).toEqual({
      name: 'slot',
      confidence: 'fallback',
    });
    expect(inferTokenType('')).toEqual({ name: 'slot', confidence: 'fallback' });
  });
});

describe('inferTokenType — idempotenza su token già validi', () => {
  it('keeps a valid known base name when input is the name itself', () => {
    expect(inferTokenType('data')).toEqual({ name: 'data', confidence: 'high' });
    expect(inferTokenType('orario')).toEqual({ name: 'orario', confidence: 'high' });
  });

  it('maps an indexed token name back to its base (`data1` → `data`)', () => {
    expect(inferTokenType('data1')).toEqual({ name: 'data', confidence: 'high' });
    expect(inferTokenType('slot12')).toEqual({ name: 'slot', confidence: 'high' });
  });

  it('falls back to slot when the token name is unknown', () => {
    /** Es. l'utente ha digitato a mano un nome non standard tipo `[paziente]`. */
    expect(inferTokenType('paziente')).toEqual({ name: 'slot', confidence: 'fallback' });
  });
});

describe('autoTokenizeAnnotated', () => {
  it('returns the input unchanged when there are no brackets', () => {
    const r = autoTokenizeAnnotated('Buongiorno, come va?');
    expect(r.tokenized).toBe('Buongiorno, come va?');
    expect(r.brackets).toEqual([]);
    expect(r.hasReclassified).toBe(false);
  });

  it('converts a single literal bracket into its inferred token (no index when unique)', () => {
    const r = autoTokenizeAnnotated('Ti propongo [12 giugno alle 09:00].');
    expect(r.tokenized).toBe('Ti propongo [data].');
    expect(r.brackets).toHaveLength(1);
    expect(r.brackets[0].baseName).toBe('data');
    expect(r.brackets[0].finalName).toBe('data');
    expect(r.hasReclassified).toBe(true);
  });

  it('splits the same span into two distinct tokens when user changes bracket boundaries', () => {
    /** Caso d'uso citato dall'utente: passa da `[12 giugno alle 09:00]` a `[12 giugno] alle [09:00]`. */
    const r = autoTokenizeAnnotated('Ti propongo [12 giugno] alle [09:00].');
    expect(r.tokenized).toBe('Ti propongo [data] alle [orario].');
    expect(r.brackets.map((b) => b.finalName)).toEqual(['data', 'orario']);
  });

  it('numbers duplicates of the same base type (data1, data2)', () => {
    const r = autoTokenizeAnnotated('Tra [12 giugno] e [20 giugno] vediamoci.');
    expect(r.tokenized).toBe('Tra [data1] e [data2] vediamoci.');
    expect(r.brackets.map((b) => b.finalName)).toEqual(['data1', 'data2']);
  });

  it('numbers also when one duplicate is unclassified (slot1, slot2)', () => {
    const r = autoTokenizeAnnotated('Chiamo [Mario Rossi] e [Luigi Bianchi].');
    expect(r.tokenized).toBe('Chiamo [slot1] e [slot2].');
  });

  it('keeps already-valid tokens stable when no reclassification is needed', () => {
    const r = autoTokenizeAnnotated('Ti propongo [data] alle [orario].');
    expect(r.tokenized).toBe('Ti propongo [data] alle [orario].');
    expect(r.hasReclassified).toBe(false);
  });

  it('treats unclosed brackets as literal text', () => {
    const r = autoTokenizeAnnotated('Frase incompleta [12 giugno');
    expect(r.tokenized).toBe('Frase incompleta [12 giugno');
    expect(r.brackets).toEqual([]);
  });
});
