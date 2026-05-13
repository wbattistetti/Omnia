/**
 * Test del domain helper `splitTextBySeed`. Coprono:
 *  - edge case (testo/seed vuoto, seed più lungo del testo, soli spazi)
 *  - case-insensitivity
 *  - più occorrenze
 *  - preservazione del casing originale nelle porzioni `match`
 *  - safety: seed con metacaratteri regex non causa crash né match spurii
 *  - invariante "concat di tutte le porzioni == text"
 */

import { describe, expect, it } from 'vitest';
import { splitTextBySeed } from '../splitTextBySeed';

describe('splitTextBySeed', () => {
  it('seed vuoto → singola porzione no-match con tutto il testo', () => {
    expect(splitTextBySeed('Ciao mondo', '')).toEqual([{ text: 'Ciao mondo', match: false }]);
  });

  it('seed solo spazi → trattato come vuoto', () => {
    expect(splitTextBySeed('Ciao mondo', '   ')).toEqual([
      { text: 'Ciao mondo', match: false },
    ]);
  });

  it('testo vuoto → singola porzione no-match con stringa vuota', () => {
    expect(splitTextBySeed('', 'foo')).toEqual([{ text: '', match: false }]);
  });

  it('seed più lungo del testo → no-match', () => {
    expect(splitTextBySeed('hi', 'hello-world')).toEqual([{ text: 'hi', match: false }]);
  });

  it('match unico al centro', () => {
    expect(splitTextBySeed('Ciao mondo bello', 'mondo')).toEqual([
      { text: 'Ciao ', match: false },
      { text: 'mondo', match: true },
      { text: ' bello', match: false },
    ]);
  });

  it('match a inizio e fine stringa', () => {
    expect(splitTextBySeed('foo bar foo', 'foo')).toEqual([
      { text: 'foo', match: true },
      { text: ' bar ', match: false },
      { text: 'foo', match: true },
    ]);
  });

  it('case-insensitive ma preserva casing originale', () => {
    const parts = splitTextBySeed('Ordine, ORDINARE, ordini', 'ord');
    expect(parts).toEqual([
      { text: 'Ord', match: true },
      { text: 'ine, ', match: false },
      { text: 'ORD', match: true },
      { text: 'INARE, ', match: false },
      { text: 'ord', match: true },
      { text: 'ini', match: false },
    ]);
  });

  it('seed con metacaratteri regex non crasha né matcha spuriamente', () => {
    expect(splitTextBySeed('a.b.c', '.b')).toEqual([
      { text: 'a', match: false },
      { text: '.b', match: true },
      { text: '.c', match: false },
    ]);
    expect(splitTextBySeed('abc', '.*')).toEqual([{ text: 'abc', match: false }]);
  });

  it('match contigui (no overlap)', () => {
    expect(splitTextBySeed('aaaa', 'aa')).toEqual([
      { text: 'aa', match: true },
      { text: 'aa', match: true },
    ]);
  });

  it('invariante: la concat di tutte le porzioni ricostruisce il testo originale', () => {
    const samples: ReadonlyArray<{ text: string; seed: string }> = [
      { text: 'Salve, come posso aiutarla?', seed: 'come' },
      { text: 'Niente match qui dentro', seed: 'xyz' },
      { text: 'AAAaaAAAaa', seed: 'a' },
      { text: '   spazi   ai   bordi   ', seed: 'spazi' },
    ];
    for (const { text, seed } of samples) {
      const reconstructed = splitTextBySeed(text, seed)
        .map((p) => p.text)
        .join('');
      expect(reconstructed).toBe(text);
    }
  });

  it('seed trim: spazi attorno al seed vengono ignorati', () => {
    expect(splitTextBySeed('Hello world', '  world  ')).toEqual([
      { text: 'Hello ', match: false },
      { text: 'world', match: true },
    ]);
  });
});
