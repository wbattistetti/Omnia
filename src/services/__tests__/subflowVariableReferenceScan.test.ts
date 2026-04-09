import { describe, expect, it } from 'vitest';
import { taskRepository } from '../TaskRepository';
import { TaskType } from '../../types/taskTypes';
import {
  collectParentVariableIdsForChildOutput,
  findParentVarGuidReferences,
  projectHasBracketReferenceToVarId,
  validateRemovalOfInterfaceOutputRow,
} from '../subflowVariableReferenceScan';

describe('findParentVarGuidReferences', () => {
  it('finds guid in translations only', () => {
    const guid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const refs = findParentVarGuidReferences(
      guid,
      { main: { id: 'main', nodes: [], edges: [] } } as any,
      {
        translations: { tk1: `Test [${guid}] end` },
      }
    );
    expect(refs.some((r) => r.kind === 'translation' && r.id === 'tk1')).toBe(true);
  });
});

describe('projectHasBracketReferenceToVarId', () => {
  it('detects GUID token in task JSON', () => {
    const vid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    taskRepository.createTask(TaskType.SayMessage, null, {
      parameters: [{ text: `[${vid}] hello` }],
    } as any);
    expect(
      projectHasBracketReferenceToVarId('p1', vid, {
        main: { id: 'main', nodes: [], edges: [] },
      } as any)
    ).toBe(true);
  });
});

describe('validateRemovalOfInterfaceOutputRow', () => {
  it('blocks when a parent var is referenced in a task (S2 subflowBindings)', () => {
    const childFlow = 'child_f';
    const childVar = '10000000-0000-4000-8000-000000000001';
    const parentVar = '20000000-0000-4000-8000-000000000002';

    taskRepository.createTask(
      TaskType.Subflow,
      null,
      {
        flowId: childFlow,
        subflowBindingsSchemaVersion: 1,
        subflowBindings: [{ interfaceParameterId: childVar, parentVariableId: parentVar }],
      } as any,
      'subflow_task_1'
    );

    taskRepository.createTask(TaskType.SayMessage, null, {
      parameters: [{ text: `[${parentVar}] x` }],
    } as any);

    const flows = {
      main: {
        id: 'main',
        nodes: [{ data: { rows: [{ id: 'subflow_task_1', text: 'x' }] } }],
        edges: [],
      },
    } as any;

    const r = validateRemovalOfInterfaceOutputRow('proj', childFlow, childVar, flows, {});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.parentVarId).toBe(parentVar);
      expect(r.references.length).toBeGreaterThan(0);
    }
  });

  it('blocks when reference exists only in translations (GUID token)', () => {
    const childFlow = 'child_tr';
    const childVar = '30000000-0000-4000-8000-000000000003';
    const parentGuid = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';

    taskRepository.createTask(
      TaskType.Subflow,
      null,
      {
        flowId: childFlow,
        subflowBindingsSchemaVersion: 1,
        subflowBindings: [{ interfaceParameterId: childVar, parentVariableId: parentGuid }],
      } as any,
      'sf_tr_1'
    );

    const flows = {
      main: {
        id: 'main',
        nodes: [{ data: { rows: [{ id: 'sf_tr_1', text: 'x' }] } }],
        edges: [],
      },
    } as any;

    const translations = { msgKey: `Salve [${parentGuid}]!` };

    const r = validateRemovalOfInterfaceOutputRow('proj', childFlow, childVar, flows, translations);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.references.some((x) => x.kind === 'translation')).toBe(true);
    }
  });
});

describe('collectParentVariableIdsForChildOutput', () => {
  it('returns parent variable ids from subflowBindings', () => {
    const childFlow = 'cf2';
    const childVar = '40000000-0000-4000-8000-000000000004';
    const parentVar = '50000000-0000-4000-8000-000000000005';
    taskRepository.createTask(
      TaskType.Subflow,
      null,
      {
        flowId: childFlow,
        subflowBindingsSchemaVersion: 1,
        subflowBindings: [{ interfaceParameterId: childVar, parentVariableId: parentVar }],
      } as any,
      'sf_t2'
    );
    const ids = collectParentVariableIdsForChildOutput(childFlow, childVar, {
      main: { nodes: [{ data: { rows: [{ id: 'sf_t2' }] } }] },
    } as any);
    expect(ids).toContain(parentVar);
  });
});
