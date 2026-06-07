/**
 * Test UC inform / disclosure implicita nel motore dialogStepEngine.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { executeDialogStep } from '../omniaDialogStep/dialogStepEngine.js';
import { parseKbPipeTable } from '../omniaDialogStep/parseKbPipeTable.js';
import { emptyInformState } from '../omniaDialogStep/kbDialogSelectorSemantics.js';

const SAMPLE_MD = `## Dati normalizzati

| specialita | tipo_visita | esame_associato | esame_obbligatorio |
| --- | --- | --- | --- |
| Cardiologia | Controllo | ECG | si |
| Cardiologia | Prima visita | nessuno | no |
| Ortopedia | Prima visita | RX | no |
`;

function selectorSpecWithInform() {
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
        informOnAutofill: true,
        acceptanceWhen: [{ metadataColumnId: 'esame_obbligatorio', metadataValue: 'si' }],
      },
      {
        columnId: 'esame_obbligatorio',
        headerLabel: 'esame_obbligatorio',
        role: 'data',
        promptType: 'closed_list',
        sortOrder: 99,
        promptTemplate: 'esame obbligatorio',
      },
    ],
    invalidationTemplates: [],
  };
}

function dialogIndexWithInform() {
  return {
    schemaVersion: 1,
    completeTemplate: 'Perfetto, prenoto {tipo_visita_nat} {specialita_nat}{esame_suffix}.',
    valueLabels: {},
    acquisition: {
      specialita: {
        useCaseId: 'uc_ask_specialita',
        selectorColumnId: 'specialita',
        rows: [{ bindingWhen: {}, say: 'Quale specialità?', allowedValues: ['Cardiologia', 'Ortopedia'] }],
      },
      tipo_visita: {
        useCaseId: 'uc_ask_tipo',
        selectorColumnId: 'tipo_visita',
        rows: [
          {
            bindingWhen: { specialita: 'Cardiologia' },
            say: 'Prima visita o controllo?',
            allowedValues: ['Prima visita', 'Controllo'],
          },
        ],
      },
    },
    inform: {
      esame_associato: {
        useCaseId: 'uc_inform_esame',
        selectorColumnId: 'esame_associato',
        rows: [
          {
            bindingWhen: { specialita: 'Cardiologia', tipo_visita: 'Controllo' },
            say: 'Per il controllo cardiologico è previsto l\'ECG obbligatorio.',
            deDisclosureSay: "L'esame ECG non è più previsto.",
            transitionSay: "Invece dell'ECG è previsto {esame_associato_nat}.",
            informedValue: 'ECG',
            requiresAcceptance: true,
          },
        ],
      },
    },
    correction: [],
    complete: { useCaseId: 'uc_complete', sayTemplate: 'Perfetto.' },
  };
}

describe('dialogStepEngine inform', () => {
  const grid = parseKbPipeTable(SAMPLE_MD);
  assert.ok(grid);

  it('emits inform_pending when implicit ECG requires acceptance', () => {
    const r1 = executeDialogStep({
      grid,
      selectorSpec: selectorSpecWithInform(),
      binding: {},
      updates: { specialita: 'Cardiologia' },
      dialogIndex: dialogIndexWithInform(),
      informState: emptyInformState(),
    });
    assert.equal(r1.status, 'ask');

    const r2 = executeDialogStep({
      grid,
      selectorSpec: selectorSpecWithInform(),
      binding: r1.binding,
      updates: { tipo_visita: 'Controllo' },
      dialogIndex: dialogIndexWithInform(),
      informState: r1.informState ?? emptyInformState(),
    });
    assert.equal(r2.status, 'inform_pending');
    assert.equal(r2.useCaseKind, 'inform');
    assert.equal(r2.requiresAcceptance, true);
    assert.match(r2.say.toLowerCase(), /ecg/);
  });

  it('continues to complete after inform accept', () => {
    let binding = {};
    let informState = emptyInformState();
    binding = executeDialogStep({
      grid,
      selectorSpec: selectorSpecWithInform(),
      binding,
      updates: { specialita: 'Cardiologia' },
      dialogIndex: dialogIndexWithInform(),
      informState,
    }).binding;

    const pending = executeDialogStep({
      grid,
      selectorSpec: selectorSpecWithInform(),
      binding,
      updates: { tipo_visita: 'Controllo' },
      dialogIndex: dialogIndexWithInform(),
      informState,
    });
    informState = pending.informState;

    const accepted = executeDialogStep({
      grid,
      selectorSpec: selectorSpecWithInform(),
      binding: pending.binding,
      updates: { __inform_response: 'accept' },
      dialogIndex: dialogIndexWithInform(),
      informState,
    });
    assert.equal(accepted.status, 'complete');
  });

  it('rejects conversation when inform declined', () => {
    const pending = executeDialogStep({
      grid,
      selectorSpec: selectorSpecWithInform(),
      binding: { specialita: 'Cardiologia', tipo_visita: 'Controllo' },
      updates: {},
      dialogIndex: dialogIndexWithInform(),
      informState: {
        lastDisclosed: {},
        acknowledged: [],
        informPending: {
          colId: 'esame_associato',
          value: 'ECG',
          informKey: 'specialita=cardiologia|tipo_visita=controllo::esame_associato::ecg',
          useCaseId: 'uc_inform_esame',
          say: 'ECG obbligatorio. Procediamo?',
        },
      },
    });
    assert.equal(pending.status, 'inform_pending');

    const rejected = executeDialogStep({
      grid,
      selectorSpec: selectorSpecWithInform(),
      binding: pending.binding,
      updates: { __inform_response: 'reject' },
      dialogIndex: dialogIndexWithInform(),
      informState: pending.informState,
    });
    assert.equal(rejected.status, 'rejected');
    assert.equal(rejected.conversationAction, 'terminate');
  });
});
