import { describe, expect, it } from 'vitest';
import type { KbTabularGrid } from '../../parseKbTabularText';
import type { SelectorColumnSpec, SelectorValueLabels } from '../../kbSelectorSpec';
import { buildKbDialogSlotLexicon, synonymsForAllowedSemantic } from '../kbDialogSlotLexicon';
import { parseUtteranceWithSlotLexicon } from '../kbDialogSlotLexiconParser';
import { interpolateAcquisitionSay } from '../kbDialogAcquisitionSay';

const grid: KbTabularGrid = {
  headers: ['specialita', 'tipo_visita', 'esame_associato'],
  rows: [
    ['cardiologia', 'prima_visita', 'nessuno'],
    ['cardiologia', 'controllo', 'ecg'],
    ['urologia', 'prima_visita', 'nessuno'],
  ],
};

const askable: SelectorColumnSpec[] = [
  {
    columnId: 'specialita',
    headerLabel: 'specialita',
    role: 'selector',
    promptType: 'closed_list',
    sortOrder: 0,
    promptTemplate: 'la specialità',
    askPolicy: 'required',
  },
  {
    columnId: 'tipo_visita',
    headerLabel: 'tipo_visita',
    role: 'selector',
    promptType: 'closed_list',
    sortOrder: 10,
    promptTemplate: 'il tipo di visita',
    askPolicy: 'optional',
  },
];

const valueLabels: SelectorValueLabels = {
  specialita: { cardiologia: 'cardiologica', urologia: 'urologica' },
  tipo_visita: { prima_visita: 'prima visita', controllo: 'visita di controllo' },
};

describe('buildKbDialogSlotLexicon', () => {
  it('includes natural labels as synonyms', () => {
    const lexicon = buildKbDialogSlotLexicon({ grid, askable, valueLabels });
    const syns = synonymsForAllowedSemantic(lexicon, 'specialita', 'cardiologia', valueLabels);
    expect(syns.map((s) => s.toLowerCase())).toContain('cardiologica');
  });
});

describe('parseUtteranceWithSlotLexicon', () => {
  const lexicon = buildKbDialogSlotLexicon({ grid, askable, valueLabels });

  it('maps cardiologica → cardiologia', () => {
    const r = parseUtteranceWithSlotLexicon({
      utterance: 'cardiologica',
      grid,
      selectorSpec: { schemaVersion: 1, columns: askable },
      binding: {},
      slotLexicon: lexicon,
      valueLabels,
    });
    expect(r.updates.specialita).toBe('cardiologia');
  });

  it('extracts multi-slot from one sentence', () => {
    const r = parseUtteranceWithSlotLexicon({
      utterance: 'vorrei una prima visita cardiologica',
      grid,
      selectorSpec: { schemaVersion: 1, columns: askable },
      binding: {},
      slotLexicon: lexicon,
      valueLabels,
    });
    expect(r.updates.specialita).toBe('cardiologia');
    expect(r.updates.tipo_visita).toBe('prima_visita');
    expect(r.matches).toHaveLength(2);
  });
});

describe('interpolateAcquisitionSay', () => {
  it('replaces [specialita] with natural label from binding', () => {
    const say = interpolateAcquisitionSay({
      say: 'Una prima visita [specialita] o una visita di controllo?',
      binding: { specialita: 'cardiologia' },
      valueLabels,
      allowedValues: ['prima_visita', 'controllo'],
      selectorColumnId: 'tipo_visita',
    });
    expect(say).toBe('Una prima visita cardiologica o una visita di controllo?');
    expect(say).not.toContain('[');
  });
});
