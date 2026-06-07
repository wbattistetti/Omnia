import { describe, expect, it } from 'vitest';
import { generateKbDialogUseCases, buildInformSays } from '../kbDialogUseCaseGeneration';
import { inferSelectorSpecFromGrid } from '../../kbSelectorSpec';
import { KB_DIALOG_CATEGORY_INFORM } from '../kbDialogConstants';

const grid = {
  headers: ['specialita', 'tipo_visita', 'esame_associato', 'esame_obbligatorio'],
  rows: [
    ['cardiologia', 'controllo', 'ecg', 'si'],
    ['cardiologia', 'prima_visita', 'nessuno', 'no'],
  ],
};

describe('generateKbDialogUseCases inform', () => {
  it('generates inform UC when informOnAutofill is enabled', () => {
    const base = inferSelectorSpecFromGrid(grid);
    const selectorSpec = {
      ...base,
      columns: base.columns.map((c) =>
        c.columnId === 'esame_associato'
          ? {
              ...c,
              informOnAutofill: true,
              acceptanceWhen: [{ metadataColumnId: 'esame_obbligatorio', metadataValue: 'si' }],
            }
          : c
      ),
    };
    const out = generateKbDialogUseCases({ grid, selectorSpec, kbDocumentId: 'doc1' });
    const informUc = out.useCases.find((uc) => uc.category_id === KB_DIALOG_CATEGORY_INFORM);
    expect(informUc).toBeDefined();
    expect(informUc?.kb_dialog_meta?.kind).toBe('inform');
    expect(out.runtimeIndex.inform.esame_associato?.rows.length).toBeGreaterThan(0);
    expect(out.runtimeIndex.inform.esame_associato?.rows[0]?.requiresAcceptance).toBe(true);
  });

  it('buildInformSays produces transition templates', () => {
    const spec = inferSelectorSpecFromGrid(grid);
    const col = spec.columns.find((c) => c.columnId === 'esame_associato')!;
    const says = buildInformSays({
      col,
      informedValue: 'ecg',
      bindingWhen: { specialita: 'cardiologia', tipo_visita: 'controllo' },
      valueLabels: {},
    });
    expect(says.say.toLowerCase()).toContain('ecg');
    expect(says.transitionSay).toContain('prev_esame_associato_nat');
  });
});
