import { describe, expect, it } from 'vitest';
import {
  distinctColumnValues,
  excludeSelectorColumn,
  inferSelectorSpecFromGrid,
  isEmptySelectorCellValue,
  listAskableSelectorColumns,
  mergeSelectorSpecFromAiAndGrid,
  moveSelectorColumn,
  parseKbDocumentSelectorSpec,
  serializeKbDocumentSelectorSpec,
  slugifySelectorColumnId,
  validateSelectorSpecForApproval,
} from '../kbSelectorSpec';

describe('slugifySelectorColumnId', () => {
  it('normalizes headers to snake_case ids', () => {
    expect(slugifySelectorColumnId('Tipo visita')).toBe('tipo_visita');
    expect(slugifySelectorColumnId('Specialità')).toBe('specialita');
  });
});

describe('inferSelectorSpecFromGrid', () => {
  it('assigns closed_list to low-cardinality columns', () => {
    const spec = inferSelectorSpecFromGrid({
      headers: ['specialty', 'visit_type'],
      rows: [
        ['cardio', 'prima_visita'],
        ['radio', 'controllo'],
        ['cardio', 'prima_visita'],
      ],
    });
    const askable = listAskableSelectorColumns(spec);
    expect(askable.length).toBe(2);
    const visit = askable.find((c) => c.columnId === 'visit_type');
    expect(visit?.promptType).toBe('closed_list');
    expect(askable[0]?.columnId).toBe('specialty');
    expect(askable[0]?.askPolicy).toBe('required');
    expect(visit?.askPolicy).toBe('optional');
  });

  it('assigns open_question to high-cardinality columns', () => {
    const rows = Array.from({ length: 10 }, (_, i) => [`spec_${i}`, 'prima_visita']);
    const spec = inferSelectorSpecFromGrid({
      headers: ['specialty', 'visit_type'],
      rows,
    });
    const specialty = spec.columns.find((c) => c.columnId === 'specialty');
    expect(specialty?.promptType).toBe('open_question');
  });
});

describe('parseKbDocumentSelectorSpec', () => {
  it('round-trips via JSON string', () => {
    const inferred = inferSelectorSpecFromGrid({
      headers: ['a', 'b'],
      rows: [['1', 'x'], ['2', 'y']],
    });
    const json = serializeKbDocumentSelectorSpec(inferred);
    const parsed = parseKbDocumentSelectorSpec(json);
    expect(parsed?.columns.length).toBe(inferred.columns.length);
  });
});

describe('validateSelectorSpecForApproval', () => {
  it('requires at least one selector column', () => {
    const issues = validateSelectorSpecForApproval(
      {
        schemaVersion: 1,
        columns: [
          {
            columnId: 'x',
            headerLabel: 'x',
            role: 'data',
            promptType: 'closed_list',
            sortOrder: 0,
            promptTemplate: '',
          },
        ],
        invalidationTemplates: [],
      },
      { headers: ['x'], rows: [['a']] }
    );
    expect(issues.some((i) => i.code === 'no_selectors')).toBe(true);
  });

  it('passes for inferred grid spec', () => {
    const grid = {
      headers: ['visit_type', 'specialty'],
      rows: [
        ['prima_visita', 'cardio'],
        ['controllo', 'radio'],
      ],
    };
    const spec = mergeSelectorSpecFromAiAndGrid(null, grid);
    expect(validateSelectorSpecForApproval(spec, grid)).toEqual([]);
  });
});

describe('listAskableSelectorColumns', () => {
  it('hides data role and auto-fill columns', () => {
    const spec = inferSelectorSpecFromGrid({
      headers: ['a', 'b'],
      rows: [['only', 'x'], ['only', 'y']],
    });
    const askable = listAskableSelectorColumns(spec);
    expect(askable.every((c) => c.role === 'selector' && !c.autoFillSingleValue)).toBe(true);
  });
});

describe('moveSelectorColumn', () => {
  it('swaps order of adjacent askable columns', () => {
    const grid = {
      headers: ['visit_type', 'specialty'],
      rows: [
        ['prima_visita', 'cardio'],
        ['controllo', 'radio'],
      ],
    };
    const spec = mergeSelectorSpecFromAiAndGrid(null, grid);
    const first = listAskableSelectorColumns(spec)[0]!;
    const moved = moveSelectorColumn(spec, first.columnId, 'down');
    const reordered = listAskableSelectorColumns(moved);
    expect(reordered[0]?.columnId).not.toBe(first.columnId);
  });
});

describe('isEmptySelectorCellValue', () => {
  it('treats dash and non applicabile as empty', () => {
    expect(isEmptySelectorCellValue('-')).toBe(true);
    expect(isEmptySelectorCellValue('non applicabile')).toBe(true);
    expect(isEmptySelectorCellValue('non_applicable')).toBe(true);
    expect(isEmptySelectorCellValue('si')).toBe(false);
  });
});

describe('distinctColumnValues', () => {
  it('excludes non applicabile from selectable values', () => {
    const values = distinctColumnValues(
      [['si'], ['non applicabile'], ['-'], ['no']],
      0
    );
    expect(values).toEqual(['no', 'si']);
  });
});

describe('inferSelectorSpecFromGrid domain rules', () => {
  it('excludes esame_obbligatorio and puts specialita first as required', () => {
    const spec = inferSelectorSpecFromGrid({
      headers: ['tipo_visita', 'specialita', 'esame_obbligatorio', 'codice'],
      rows: [
        ['prima_visita', 'pneumologia', 'non applicabile', '12'],
        ['controllo', 'urologia', 'si', '14'],
        ['unica', 'senologia', '-', '15'],
      ],
    });
    const askable = listAskableSelectorColumns(spec);
    expect(askable[0]?.columnId).toBe('specialita');
    expect(askable[0]?.askPolicy).toBe('required');
    expect(askable.some((c) => c.columnId === 'esame_obbligatorio')).toBe(false);
    expect(askable.some((c) => c.columnId === 'codice')).toBe(false);
  });
});

describe('excludeSelectorColumn', () => {
  it('removes column from askable list', () => {
    const grid = {
      headers: ['visit_type', 'specialty'],
      rows: [
        ['prima_visita', 'cardio'],
        ['controllo', 'radio'],
      ],
    };
    const spec = mergeSelectorSpecFromAiAndGrid(null, grid);
    const target = listAskableSelectorColumns(spec)[0]!;
    const next = excludeSelectorColumn(spec, target.columnId);
    expect(listAskableSelectorColumns(next).some((c) => c.columnId === target.columnId)).toBe(
      false
    );
  });
});
