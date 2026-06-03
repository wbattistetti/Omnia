import { describe, expect, it } from 'vitest';
import {
  listRegisteredSlotIds,
  mergeSlotDefinitionsIntoLexicon,
  slotBindingStatus,
} from '../dynamicSlotRegistry';
import { emptyProjectSlotLexicon } from '../projectSlotLexicon';

describe('dynamicSlotRegistry', () => {
  it('starts with empty registry', () => {
    const lex = emptyProjectSlotLexicon();
    expect(lex.slotRegistry).toEqual({});
    expect(listRegisteredSlotIds(lex)).toEqual([]);
  });

  it('merges AI slot definitions', () => {
    const lex = mergeSlotDefinitionsIntoLexicon(emptyProjectSlotLexicon(), [
      {
        slotId: 'medico_richiesto',
        label: 'Medico richiesto',
        valueType: 'string',
        description: 'Nome medico nominato',
        binding: { kind: 'dialog', path: 'dialog.medico' },
        proposedByAi: true,
      },
    ]);
    expect(listRegisteredSlotIds(lex)).toContain('medico_richiesto');
    const def = lex.slotRegistry.medico_richiesto;
    expect(def?.description).toBe('Nome medico nominato');
    expect(slotBindingStatus({
      slotId: 'medico_richiesto',
      valueType: 'string',
      description: '',
      binding: { kind: 'dialog', path: 'dialog.medico' },
    })).toBe('ok');
  });
});
