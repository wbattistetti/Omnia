/**
 * Test sostituzione slot_id nel testo tokenizzato.
 */

import { describe, expect, it } from 'vitest';
import { replaceSlotIdInTokenizedText, resolveNaturalSurfaceAtTokenIndex } from '../semanticTokenText';

describe('resolveNaturalSurfaceAtTokenIndex', () => {
  it('aligns tokenized token with natural bracket at same index', () => {
    const natural = 'Il [Dott. Verdi] è un [Allergologo].';
    const tokenized = 'Il [dott. verdi] è un [allergologo].';
    expect(
      resolveNaturalSurfaceAtTokenIndex(natural, tokenized, 'dott. verdi')
    ).toBe('Dott. Verdi');
    expect(
      resolveNaturalSurfaceAtTokenIndex(natural, tokenized, 'allergologo')
    ).toBe('Allergologo');
  });
});

describe('replaceSlotIdInTokenizedText', () => {
  it('replaces all occurrences of a token name', () => {
    const text =
      'Il [medico_richiesto1] è [specialita_richiesta1], non [specialita_richiesta2].';
    const out = replaceSlotIdInTokenizedText(
      text,
      'specialita_richiesta1',
      'specialita_associata_medico'
    );
    expect(out).toBe(
      'Il [medico_richiesto1] è [specialita_associata_medico], non [specialita_richiesta2].'
    );
  });
});
