import { describe, expect, it } from 'vitest';
import { generateKbDialogUseCases, buildAcquisitionSay } from '../kbDialogUseCaseGeneration';
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

    expect(out.categories.length).toBe(3);
    expect(out.useCases.some((uc) => uc.category_id === KB_DIALOG_CATEGORY_ACQUISITION)).toBe(true);
    expect(out.useCases.some((uc) => uc.category_id === KB_DIALOG_CATEGORY_COMPLETE)).toBe(true);
    expect(out.useCases.filter((uc) => uc.kb_dialog_meta?.kind === 'correction').length).toBeGreaterThan(0);
    expect(out.runtimeIndex.complete.sayTemplate).toContain('Perfetto');
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
