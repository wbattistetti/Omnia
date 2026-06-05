import { describe, expect, it } from 'vitest';
import { parseMarkdownPipeTable } from '../parseKbTabularText';
import {
  escapeMarkdownPipeCell,
  serializeMarkdownPipeTable,
  serializeParsedKbTabular,
} from '../kbRestructuredGridMarkdown';
import {
  addGridColumn,
  cloneKbTabularGrid,
  commitGridCellEdit,
  createPendingColumnHeader,
  deleteGridColumn,
  insertGridColumnAfter,
  isPendingColumnHeader,
  reorderGridColumn,
  renameGridColumn,
  replaceColumnValues,
  setSingleGridCellValue,
  toKbTabularGrid,
} from '../kbRestructuredGridEdit';

describe('serializeMarkdownPipeTable', () => {
  it('roundtrips with parseMarkdownPipeTable', () => {
    const grid = {
      headers: ['code', 'label'],
      rows: [
        ['A', 'Visita'],
        ['B', 'Controllo'],
      ],
    };
    const md = serializeMarkdownPipeTable(grid);
    expect(md).toContain('## Dati normalizzati');
    const parsed = parseMarkdownPipeTable(md);
    expect(parsed?.grid.headers).toEqual(['code', 'label']);
    expect(parsed?.grid.rows).toEqual(grid.rows);
  });

  it('escapes pipe in cells', () => {
    expect(escapeMarkdownPipeCell('a|b')).toBe('a\\|b');
  });

  it('preserves preamble via serializeParsedKbTabular', () => {
    const md = serializeParsedKbTabular({
      preamble: ['## Dati normalizzati', 'Nota intro'],
      grid: { headers: ['x', 'y'], rows: [['1', '2']] },
    });
    expect(md).toContain('Nota intro');
  });
});

describe('kbRestructuredGridEdit', () => {
  const sample = {
    headers: ['visit_type', 'label'],
    rows: [
      ['unspecified', 'Visita A'],
      ['unspecified', 'Visita B'],
      ['controllo', 'Visita C'],
    ],
  };

  it('replaces all matching values in column', () => {
    const mutable = cloneKbTabularGrid(sample);
    const { grid, replacedCount } = replaceColumnValues(
      mutable,
      0,
      'unspecified',
      'specialistica'
    );
    expect(replacedCount).toBe(2);
    expect(grid.rows[0]![0]).toBe('specialistica');
    expect(grid.rows[1]![0]).toBe('specialistica');
    expect(grid.rows[2]![0]).toBe('controllo');
  });

  it('commitGridCellEdit propagates in column', () => {
    const mutable = cloneKbTabularGrid(sample);
    const { replacedCount } = commitGridCellEdit(mutable, 0, 0, 'unspecified', 'prima_visita');
    expect(replacedCount).toBe(2);
  });

  it('commitGridCellEdit matches previousValue (pre-edit identity), not current cell in grid', () => {
    const mutable = cloneKbTabularGrid(sample);
    mutable.rows[0]![0] = 'prima_visita';
    const { grid, replacedCount } = commitGridCellEdit(
      mutable,
      0,
      0,
      'unspecified',
      'prima_visita'
    );
    expect(replacedCount).toBe(1);
    expect(grid.rows[0]![0]).toBe('prima_visita');
    expect(grid.rows[1]![0]).toBe('prima_visita');
  });

  it('setSingleGridCellValue updates one cell only', () => {
    const mutable = cloneKbTabularGrid(sample);
    const updated = setSingleGridCellValue(mutable, 0, 0, 'prima_visita');
    expect(updated.rows[0]![0]).toBe('prima_visita');
    expect(updated.rows[1]![0]).toBe('unspecified');
  });

  it('reorders columns', () => {
    const mutable = cloneKbTabularGrid(sample);
    const next = reorderGridColumn(mutable, 0, 1);
    expect(next.headers).toEqual(['label', 'visit_type']);
    expect(next.rows[0]).toEqual(['Visita A', 'unspecified']);
  });

  it('renames header', () => {
    const mutable = cloneKbTabularGrid(sample);
    const next = renameGridColumn(mutable, 0, 'tipo_visita');
    expect(next.headers[0]).toBe('tipo_visita');
  });

  it('inserts column after index', () => {
    const mutable = cloneKbTabularGrid(sample);
    const next = insertGridColumnAfter(mutable, 0, '__pending_1__', '');
    expect(next.headers).toEqual(['visit_type', '__pending_1__', 'label']);
    expect(next.rows[0]).toEqual(['unspecified', '', 'Visita A']);
  });

  it('adds and deletes column', () => {
    let mutable = cloneKbTabularGrid(sample);
    mutable = addGridColumn(mutable, 'age_group', '');
    expect(mutable.headers).toContain('age_group');
    mutable = deleteGridColumn(mutable, 2);
    expect(mutable.headers).toEqual(['visit_type', 'label']);
  });

  it('prevents deleting last column', () => {
    const mutable = { headers: ['only'], rows: [['x']] };
    expect(() => deleteGridColumn(mutable, 0)).toThrow();
  });

  it('toKbTabularGrid returns immutable copy', () => {
    const mutable = cloneKbTabularGrid(sample);
    const grid = toKbTabularGrid(mutable);
    mutable.headers[0] = 'changed';
    expect(grid.headers[0]).toBe('visit_type');
  });

  it('pending column roundtrip serialize parse', () => {
    const sample = { headers: ['code', 'label'], rows: [['12', 'Visita']] };
    const mutable = cloneKbTabularGrid(sample);
    const updated = insertGridColumnAfter(
      mutable,
      0,
      createPendingColumnHeader(mutable.headers),
      ''
    );
    const grid = toKbTabularGrid(updated);
    expect(grid.headers).toEqual(['code', '__pending_1__', 'label']);
    const md = serializeParsedKbTabular({
      preamble: ['## Dati normalizzati'],
      grid,
    });
    expect(md).toContain('__pending_1__');
    const parsed = parseMarkdownPipeTable(md);
    expect(parsed?.grid.headers).toEqual(['code', '__pending_1__', 'label']);
    expect(parsed?.grid.rows[0]).toEqual(['12', '', 'Visita']);
  });

  it('pending column headers', () => {
    expect(isPendingColumnHeader('__pending_1__')).toBe(true);
    expect(isPendingColumnHeader('code')).toBe(false);
    expect(createPendingColumnHeader(['__pending_1__'])).toBe('__pending_2__');
  });
});
