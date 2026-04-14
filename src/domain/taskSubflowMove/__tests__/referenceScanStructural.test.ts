/**
 * §3 normative scan: structural extraction + UUID tokens (no haystack.includes per var).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { taskRepository } from '@services/TaskRepository';
import { variableCreationService } from '@services/VariableCreationService';
import { TaskType } from '@types/taskTypes';
import {
  buildLowercaseToCanonicalVarIdMap,
  extractKnownVarIdsFromText,
  extractReferencedVarIdsFromParentFlowStructure,
  extractReferencedVarIdsFromTaskObject,
} from '../referenceScanStructural';
import { collectReferencedVarIdsForParentFlowWorkspace } from '../collectReferencedVarIds';
import {
  conditionExpressionTextForParentReferenceScan,
  conditionExpressionTextForReferenceScan,
} from '../internalReferenceHaystack';

describe('referenceScanStructural (§3)', () => {
  const d1 = '11111111-1111-4111-8111-111111111111';
  const d2 = '22222222-2222-4222-8222-222222222222';
  const d3 = '33333333-3333-4333-8333-333333333333';
  const unknownUuid = '99999999-9999-4999-8999-999999999999';

  it('extractKnownVarIdsFromText uses token scan, not per-id substring', () => {
    const known = new Set([d1, d2]);
    const map = buildLowercaseToCanonicalVarIdMap(known);
    const text = `x ${d1} y ${d2} z`;
    const out = extractKnownVarIdsFromText(text, map);
    expect([...out].sort()).toEqual([d1, d2].sort());
    const noUnknown = extractKnownVarIdsFromText(`ref ${unknownUuid}`, map);
    expect(noUnknown.size).toBe(0);
  });

  it('extractReferencedVarIdsFromParentFlowStructure reads flowInterface and bindings', () => {
    const known = new Set([d1, d2, d3]);
    const map = buildLowercaseToCanonicalVarIdMap(known);
    const flows = {
      main: {
        nodes: [],
        edges: [],
        meta: {
          flowInterface: {
            input: [{ variableRefId: d1 }],
            output: [{ variableRefId: d2 }],
          },
        },
        bindings: [{ interfaceParameterId: d3, parentVariableId: d1 }],
      },
    } as any;
    const out = extractReferencedVarIdsFromParentFlowStructure('main', flows, map);
    expect(out.has(d1)).toBe(true);
    expect(out.has(d2)).toBe(true);
    expect(out.has(d3)).toBe(true);
  });

  it('extractReferencedVarIdsFromTaskObject reads subflowBindings and tokens in strings', () => {
    const known = new Set([d1, d2]);
    const map = buildLowercaseToCanonicalVarIdMap(known);
    const task = {
      type: TaskType.Subflow,
      subflowBindings: [{ interfaceParameterId: d1, parentVariableId: d2 }],
      displayText: `Hello ${d1}`,
    };
    const out = extractReferencedVarIdsFromTaskObject(task, map);
    expect(out.has(d1)).toBe(true);
    expect(out.has(d2)).toBe(true);
  });

  it('conditionExpressionTextForParentReferenceScan falls back to script when primary empty', () => {
    expect(conditionExpressionTextForReferenceScan({ script: 'only' })).toBe('');
    expect(conditionExpressionTextForParentReferenceScan({ script: 'only' })).toBe('only');
    expect(conditionExpressionTextForParentReferenceScan({ script: `return [${d1}] > 0` })).toBe(
      `return [${d1}] > 0`
    );
  });
});

describe('collectReferencedVarIdsForParentFlowWorkspace §3 integration', () => {
  const d1 = '11111111-1111-4111-8111-111111111111';
  const taskRowId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  let getAllVariablesSpy: ReturnType<typeof vi.spyOn>;
  let getTaskSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getAllVariablesSpy = vi.spyOn(variableCreationService, 'getAllVariables');
    getTaskSpy = vi.spyOn(taskRepository, 'getTask');
  });

  afterEach(() => {
    getAllVariablesSpy.mockRestore();
    getTaskSpy.mockRestore();
  });

  it('finds UUID in condition script when no internal/compiled/executable (§3 conditions)', () => {
    getAllVariablesSpy.mockReturnValue([{ id: d1, taskInstanceId: taskRowId, dataPath: 'p' }] as any);
    getTaskSpy.mockReturnValue(null);

    const refs = collectReferencedVarIdsForParentFlowWorkspace({
      projectId: 'p',
      parentFlowId: 'main',
      flows: {
        main: { nodes: [], edges: [{ conditionId: 'c-script' }] },
      } as any,
      conditions: [
        {
          id: 'c-script',
          expression: { script: `return [${d1}] > 0` },
        },
      ],
    });

    expect(refs.has(d1)).toBe(true);
  });

  it('collects var id from meta.translations key var:<uuid> (§3 messages / labels)', () => {
    getAllVariablesSpy.mockReturnValue([{ id: d1, taskInstanceId: taskRowId, dataPath: 'p' }] as any);
    getTaskSpy.mockReturnValue(null);

    const refs = collectReferencedVarIdsForParentFlowWorkspace({
      projectId: 'p',
      parentFlowId: 'main',
      flows: {
        main: {
          nodes: [],
          edges: [],
          meta: {
            translations: { [`var:${d1}`]: 'Label text' },
          },
        },
      } as any,
    });

    expect(refs.has(d1)).toBe(true);
  });

  it('scans moved task via movedTaskInstanceIdForReferenceScan when absent from parent canvas', () => {
    getAllVariablesSpy.mockReturnValue([{ id: d1, taskInstanceId: taskRowId, dataPath: 'p' }] as any);
    getTaskSpy.mockImplementation((id: string) => {
      if (id !== taskRowId) return null;
      return {
        id: taskRowId,
        type: TaskType.SayMessage,
        referenceScanInternalText: `{{${d1}}}`,
      } as any;
    });

    const refs = collectReferencedVarIdsForParentFlowWorkspace({
      projectId: 'p',
      parentFlowId: 'main',
      flows: { main: { nodes: [], edges: [] } } as any,
      movedTaskInstanceIdForReferenceScan: taskRowId,
    });

    expect(refs.has(d1)).toBe(true);
  });
});
