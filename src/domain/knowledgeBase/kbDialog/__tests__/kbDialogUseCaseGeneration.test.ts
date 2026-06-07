import { describe, expect, it } from 'vitest';
import {
  generateKbDialogUseCases,
  buildAcquisitionSay,
  refreshKbDialogRuntimeIndexSayFromUseCases,
} from '../kbDialogUseCaseGeneration';
import { inferSelectorSpecFromGrid } from '../../kbSelectorSpec';
import { interpolateCompleteTemplate } from '../kbDialogCompleteTemplate';
import { KB_DIALOG_CATEGORY_ACQUISITION, KB_DIALOG_CATEGORY_COMPLETE } from '../kbDialogConstants';

const grid = {
  headers: ['specialita', 'tipo_visita', 'esame_associato'],
  rows: [
    ['cardiologia', 'prima_visita', 'nessuno'],
    ['cardiologia', 'controllo', 'ecg'],
    ['radiologia', 'prima_visita', 'nessuno'],
  ],
};

describe('generateKbDialogUseCases', () => {
  it('generates acquisition, correction and complete categories', () => {
    const selectorSpec = inferSelectorSpecFromGrid(grid);
    const out = generateKbDialogUseCases({ grid, selectorSpec, kbDocumentId: 'doc1' });

    expect(out.categories.length).toBe(4);
    expect(out.useCases.some((uc) => uc.category_id === KB_DIALOG_CATEGORY_ACQUISITION)).toBe(true);
    expect(out.useCases.some((uc) => uc.category_id === KB_DIALOG_CATEGORY_COMPLETE)).toBe(true);
    expect(out.useCases.filter((uc) => uc.kb_dialog_meta?.kind === 'correction').length).toBeGreaterThan(0);
    expect(out.runtimeIndex.complete.sayTemplate).toContain('Perfetto');
    expect(out.runtimeIndex.slotLexicon?.specialita?.length).toBeGreaterThan(0);
  });

  it('builds explicit list acquisition for two visit types', () => {
    const selectorSpec = inferSelectorSpecFromGrid(grid);
    const say = buildAcquisitionSay({
      col: selectorSpec.columns.find((c) => c.columnId === 'tipo_visita')!,
      allowedValues: ['prima_visita', 'controllo'],
      bindingWhen: { specialita: 'cardiologia' },
      valueLabels: {},
    });
    expect(say.toLowerCase()).toContain('cardiologica');
    expect(say).toMatch(/ o /);
  });

  it('runtime index acquisition say follows UC dialogue not stale auto text', () => {
    const selectorSpec = inferSelectorSpecFromGrid(grid);
    const out = generateKbDialogUseCases({ grid, selectorSpec });
    const specUc = out.useCases.find(
      (uc) =>
        uc.kb_dialog_meta?.kind === 'acquisition' && uc.kb_dialog_meta.selectorColumnId === 'specialita'
    )!;
    const designerSay = 'Che visita desidera prenotare?';
    const editedUseCases = out.useCases.map((uc) =>
      uc.id === specUc.id
        ? {
            ...uc,
            dialogue: uc.dialogue.map((t) =>
              t.role === 'assistant' ? { ...t, content: designerSay } : t
            ),
          }
        : uc
    );
    const refreshed = refreshKbDialogRuntimeIndexSayFromUseCases(out.runtimeIndex, editedUseCases);
    expect(refreshed.acquisition.specialita?.rows.every((r) => r.say === designerSay)).toBe(true);
  });
});

describe('interpolateCompleteTemplate', () => {
  it('interpolates multi-slot complete template', () => {
    const selectorSpec = inferSelectorSpecFromGrid(grid);
    const generated = generateKbDialogUseCases({ grid, selectorSpec });
    const binding = {
      specialita: 'cardiologia',
      tipo_visita: 'controllo',
      esame_associato: 'ecg',
    };
    const { sayCore, unresolved } = interpolateCompleteTemplate({
      template: generated.completeTemplate,
      binding,
      grid,
      matchedRow: grid.rows[1],
      valueLabels: generated.valueLabels,
    });
    expect(unresolved.length).toBe(0);
    expect(sayCore.toLowerCase()).toContain('cardiolog');
    expect(sayCore.toLowerCase()).toContain('ecg');
  });
});
