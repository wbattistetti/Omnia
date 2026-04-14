import { describe, expect, it } from 'vitest';
import {
  childFlowExistingVarIdsFromProjectVariables,
  childRequiredVariablesFromReferencedTaskVariablesAndTaskVariables,
} from '../ChildRequiredVariables';
import { deletableOriginVariablesFromTaskVariablesAndVarsReferencedInOrigin } from '../DeletableOriginVariables';
import { interfaceInputVarsFromChildRequiredVariables } from '../InterfaceInputVars';
import { referencedTaskVariablesFromMovedCorpus } from '../ReferencedTaskVariables';
import { taskVariablesFromTaskVariableRows } from '../TaskVariables';
import { varsReferencedInOriginFromTaskVariablesAndParentReferences } from '../VarsReferencedInOrigin';
import type { VarId } from '../../guidModel/types';

describe('domain-centric sets (GUID)', () => {
  const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' as VarId;
  const b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' as VarId;
  const c = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' as VarId;

  it('taskVariablesFromTaskVariableRows collects ids', () => {
    const tv = taskVariablesFromTaskVariableRows([{ id: a } as any, { id: b } as any]);
    expect(tv.size).toBe(2);
    expect(tv.has(a)).toBe(true);
  });

  it('referencedTaskVariablesFromMovedCorpus finds RFC UUID tokens in corpus', () => {
    const known = new Set([a, b].map(String));
    const corpus = `hello "${a}" and ${b} end`;
    const r = referencedTaskVariablesFromMovedCorpus(corpus, known);
    expect(r.has(a)).toBe(true);
    expect(r.has(b)).toBe(true);
  });

  it('childRequiredVariablesFromReferencedTaskVariablesAndTaskVariables is set difference', () => {
    const taskVars = new Set<VarId>([a]);
    const ref = new Set<VarId>([a, c]);
    const childReq = childRequiredVariablesFromReferencedTaskVariablesAndTaskVariables(ref, taskVars);
    expect(childReq.size).toBe(1);
    expect(childReq.has(c)).toBe(true);
  });

  it('childRequired excludes vars already present in child flow (nome/cognome sibling case)', () => {
    const nome = '11111111-1111-4111-8111-111111111111' as VarId;
    const cognome = '22222222-2222-4222-8222-222222222222' as VarId;
    const taskVars = new Set<VarId>([cognome]);
    const ref = new Set<VarId>([nome, cognome]);
    const childFlowIds = new Set<VarId>([nome]);
    const childReq = childRequiredVariablesFromReferencedTaskVariablesAndTaskVariables(ref, taskVars, childFlowIds);
    expect(childReq.size).toBe(0);
  });

  it('childFlowExistingVarIdsFromProjectVariables filters by scopeFlowId', () => {
    const childFlowId = 'subflow_sf1';
    const rows = [
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', scopeFlowId: childFlowId },
      { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', scopeFlowId: 'main' },
    ];
    const s = childFlowExistingVarIdsFromProjectVariables(rows, childFlowId);
    expect(s.size).toBe(1);
    expect(s.has('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' as VarId)).toBe(true);
  });

  it('varsReferencedInOriginFromTaskVariablesAndParentReferences intersects', () => {
    const taskVars = new Set<VarId>([a, b]);
    const parentRefs = new Set([String(a)]);
    const v = varsReferencedInOriginFromTaskVariablesAndParentReferences(taskVars, parentRefs);
    expect(v.size).toBe(1);
    expect(v.has(a)).toBe(true);
  });

  it('deletableOriginVariablesFromTaskVariablesAndVarsReferencedInOrigin subtracts', () => {
    const taskVars = new Set<VarId>([a, b]);
    const inOrigin = new Set<VarId>([a]);
    const del = deletableOriginVariablesFromTaskVariablesAndVarsReferencedInOrigin(taskVars, inOrigin);
    expect(del.size).toBe(1);
    expect(del.has(b)).toBe(true);
  });

  it('interfaceInputVarsFromChildRequiredVariables sorts stably', () => {
    const z = '00000000-0000-4000-8000-000000000001' as VarId;
    const y = '00000000-0000-4000-8000-000000000002' as VarId;
    const cr = new Set<VarId>([z, y]);
    const order = interfaceInputVarsFromChildRequiredVariables(cr, (ids) =>
      [...ids].map(String).sort() as VarId[]
    );
    expect(order[0] < order[1]).toBe(true);
  });
});
