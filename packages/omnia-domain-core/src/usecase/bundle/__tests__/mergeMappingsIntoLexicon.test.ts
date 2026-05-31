import { describe, expect, it } from 'vitest';
import {
  emptyProjectSlotLexicon,
  mergeMappingsIntoLexicon,
  UNCLASSIFIED_SLOT_ID,
} from '../projectSlotLexicon';

describe('mergeMappingsIntoLexicon', () => {
  it('upgrades undefined slot_id when upgradeUnclassified is set', () => {
    const lexicon = emptyProjectSlotLexicon();
    lexicon.entries.push({
      surface: 'fine mese',
      slot_id: UNCLASSIFIED_SLOT_ID,
      approved: false,
    });
    const { lexicon: out, conflicts } = mergeMappingsIntoLexicon(
      lexicon,
      [{ surface: 'fine mese', slot_id: 'datarelativa' }],
      { upgradeUnclassified: true, approveClassifiedProposals: true }
    );
    expect(conflicts).toHaveLength(0);
    expect(out.entries[0]?.slot_id).toBe('datarelativa');
    expect(out.entries[0]?.approved).toBe(true);
  });

  it('still records conflict when both sides are classified and differ', () => {
    const lexicon = emptyProjectSlotLexicon();
    lexicon.entries.push({ surface: 'foo', slot_id: 'data', approved: true });
    const { conflicts } = mergeMappingsIntoLexicon(
      lexicon,
      [{ surface: 'foo', slot_id: 'orario' }],
      { upgradeUnclassified: true }
    );
    expect(conflicts).toHaveLength(1);
  });
});
