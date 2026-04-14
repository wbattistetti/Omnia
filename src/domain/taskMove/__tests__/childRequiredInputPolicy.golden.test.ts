/**
 * Golden policy: after moving "chiedi nome" into the subflow, `nome` is scoped to the child flow.
 * When moving "chiedi cognome", the cognome task payload may still reference `nome` (token scan);
 * that must NOT create an INPUT row — nome is already a child-flow variable, not a parent dependency.
 *
 * Parent "riepilogo" may reference `dati personali.nome` / `.cognome`; that affects §3 parent reference
 * scan, not this pure INPUT set difference.
 */

import { describe, expect, it } from 'vitest';
import {
  childFlowExistingVarIdsFromProjectVariables,
  childRequiredVariablesFromReferencedTaskVariablesAndTaskVariables,
} from '../ChildRequiredVariables';
import { interfaceInputVarsFromChildRequiredVariables } from '../InterfaceInputVars';
import type { VarId } from '../../guidModel/types';

describe('childRequired INPUT policy (nome / cognome golden)', () => {
  const nome: VarId = '12e02d18-dbe1-41c0-81dc-107f8ae30866' as VarId;
  const cognome: VarId = '8f4821cc-8f97-40a3-9699-ce52d35b6999' as VarId;
  const childFlowId = 'subflow_chiedi_dati_personali';

  it('second move: referenced {nome,cognome} ∩ task {cognome} minus child-existing {nome} → INPUT ∅', () => {
    const referencedTaskVariables = new Set<VarId>([nome, cognome]);
    const taskVariables = new Set<VarId>([cognome]);
    const childFlowExisting = new Set<VarId>([nome]);

    const childReq = childRequiredVariablesFromReferencedTaskVariablesAndTaskVariables(
      referencedTaskVariables,
      taskVariables,
      childFlowExisting
    );

    expect([...childReq].sort()).toEqual([]);
    expect(
      interfaceInputVarsFromChildRequiredVariables(childReq, (ids) => [...ids].map(String).sort() as VarId[])
    ).toEqual([]);
  });

  it('childFlowExistingVarIdsFromProjectVariables matches store rows after first move', () => {
    const projectRows = [
      { id: nome, scopeFlowId: childFlowId, taskInstanceId: 'task_chiedi_nome' },
      { id: cognome, scopeFlowId: 'main', taskInstanceId: 'task_riepilogo' },
    ];
    const inChild = childFlowExistingVarIdsFromProjectVariables(projectRows, childFlowId);
    expect(inChild.has(nome)).toBe(true);
    expect(inChild.has(cognome)).toBe(false);
  });

  it('true external: variable only in parent refs, not yet in child → stays in childRequired', () => {
    const external: VarId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' as VarId;
    const referenced = new Set<VarId>([external, cognome]);
    const taskVars = new Set<VarId>([cognome]);
    const childExisting = new Set<VarId>([nome]);

    const childReq = childRequiredVariablesFromReferencedTaskVariablesAndTaskVariables(
      referenced,
      taskVars,
      childExisting
    );
    expect(childReq.has(external)).toBe(true);
    expect(childReq.has(nome)).toBe(false);
  });
});
