/**
 * Test motore omnia_dialog_step — filtro tabella, ask, invalid, complete.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { executeDialogStep } from '../omniaDialogStep/dialogStepEngine.js';
import { parseKbPipeTable } from '../omniaDialogStep/parseKbPipeTable.js';
import { filterRowsByBinding } from '../omniaDialogStep/kbDialogBindings.js';

const SAMPLE_MD = `## Dati normalizzati

| codice | specialita | tipo_visita | esame_associato |
| --- | --- | --- | --- |
| A1 | Cardiologia | Prima visita | ECG |
| A2 | Cardiologia | Controllo | - |
| B1 | Ortopedia | Prima visita | RX |
`;

function baseSelectorSpec() {
  return {
    schemaVersion: 1,
    columns: [
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
      {
        columnId: 'esame_associato',
        headerLabel: 'esame_associato',
        role: 'selector',
        promptType: 'closed_list',
        sortOrder: 20,
        promptTemplate: "l'esame associato",
        askPolicy: 'optional',
        autoFillSingleValue: true,
      },
      {
        columnId: 'codice',
        headerLabel: 'codice',
        role: 'data',
        promptType: 'closed_list',
        sortOrder: 99,
        promptTemplate: 'codice',
      },
    ],
    invalidationTemplates: [
      {
        id: 'tpl1',
        approved: true,
        template: 'Per {colonna} non è disponibile {valore_rifiutato}. Provi con {alternativa_suggerita}.',
      },
    ],
  };
}

describe('parseKbPipeTable', () => {
  it('parses pipe table from restructured markdown', () => {
    const parsed = parseKbPipeTable(SAMPLE_MD);
    assert.ok(parsed);
    assert.equal(parsed.headers.length, 4);
    assert.equal(parsed.rows.length, 3);
    assert.equal(parsed.headers[1], 'specialita');
  });
});

describe('executeDialogStep', () => {
  const grid = parseKbPipeTable(SAMPLE_MD);
  const selectorSpec = baseSelectorSpec();

  it('asks first selector column when binding is empty', () => {
    const r = executeDialogStep({ grid, selectorSpec, binding: {}, updates: {} });
    assert.equal(r.status, 'ask');
    assert.equal(r.nextColumnId, 'specialita');
    assert.ok(r.allowedValues.includes('Cardiologia'));
    assert.ok(r.allowedValues.includes('Ortopedia'));
    assert.ok(r.say.includes('specialità'));
  });

  it('completes via auto-fill when specialty leaves a single matching row', () => {
    const r = executeDialogStep({
      grid,
      selectorSpec,
      binding: {},
      updates: { specialita: 'Cardiologia' },
    });
    assert.equal(r.status, 'complete');
    assert.equal(r.matchedRow.codice, 'A1');
    assert.equal(r.binding.esame_associato, 'ECG');
  });

  it('asks next column when multiple rows remain after specialty', () => {
    const md = `| codice | specialita | tipo_visita | esame_associato |
| --- | --- | --- | --- |
| A1 | Cardiologia | Prima visita | ECG |
| A2 | Cardiologia | Controllo | Holter |
`;
    const ambigGrid = parseKbPipeTable(md);
    const r = executeDialogStep({
      grid: ambigGrid,
      selectorSpec,
      binding: {},
      updates: { specialita: 'Cardiologia' },
    });
    assert.equal(r.status, 'ask');
    assert.equal(r.nextColumnId, 'tipo_visita');
    assert.deepEqual(r.allowedValues, ['Controllo', 'Prima visita']);
    assert.equal(r.remainingRowCount, 2);
  });

  it('auto-fills single-value column and completes', () => {
    const r = executeDialogStep({
      grid,
      selectorSpec,
      binding: { specialita: 'Ortopedia' },
      updates: { tipo_visita: 'Prima visita' },
    });
    assert.equal(r.status, 'complete');
    assert.ok(r.matchedRow);
    assert.equal(r.matchedRow.codice, 'B1');
    assert.equal(r.matchedRow.esame_associato, 'RX');
  });

  it('returns invalid with template when combination has no rows', () => {
    const r = executeDialogStep({
      grid,
      selectorSpec,
      binding: { specialita: 'Cardiologia' },
      updates: { tipo_visita: 'Prima visita', esame_associato: 'RX' },
    });
    assert.equal(r.status, 'invalid');
    assert.ok(r.say.includes('non è disponibile'));
    assert.equal(r.rejected.columnId, 'esame_associato');
    assert.equal(r.rejected.value, 'RX');
  });

  it('completes when all selectors resolved to single row', () => {
    const r = executeDialogStep({
      grid,
      selectorSpec,
      binding: { specialita: 'Cardiologia' },
      updates: { tipo_visita: 'Controllo' },
    });
    assert.equal(r.status, 'complete');
    assert.equal(r.matchedRow.codice, 'A2');
  });
});

describe('filterRowsByBinding', () => {
  const grid = parseKbPipeTable(SAMPLE_MD);

  it('matches case-insensitively', () => {
    const rows = filterRowsByBinding(grid.rows, grid.headers, { specialita: 'cardiologia' });
    assert.equal(rows.length, 2);
  });
});
