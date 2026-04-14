import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { taskRepository } from '@services/TaskRepository';
import { variableCreationService } from '@services/VariableCreationService';
import { TaskType } from '@types/taskTypes';
import {
  buildParentFlowReferenceCorpus,
  collectAllProjectConditionExpressionChunks,
  collectConditionIdsFromFlowEdges,
  collectReferencedVarIdsForParentFlowWorkspace,
  collectReferencedVarIdsInParentFlowCorpus,
  isVariableReferencedInFlow,
  conditionTextsForIds,
  extractReferencedVarIdsFromText,
  partitionVariablesByReference,
} from '../collectReferencedVarIds';

describe('collectReferencedVarIds', () => {
  const d1 = '11111111-1111-4111-8111-111111111111';
  const d2 = '22222222-2222-4222-8222-222222222222';
  const known = new Set([d1, d2]);

  it('extractReferencedVarIdsFromText finds known ids by RFC UUID token scan', () => {
    const text = `condition [${d1}] and plain ${d2} noise`;
    const out = extractReferencedVarIdsFromText(text, known);
    expect(out.has(d1)).toBe(true);
    expect(out.has(d2)).toBe(true);
  });

  it('collectReferencedVarIdsInParentFlowCorpus matches corpus', () => {
    const corpus = buildParentFlowReferenceCorpus({
      flowJson: { edges: [{ conditionId: 'c1' }] },
      conditionTextChunks: [`return x === "${d1}"`],
      extraChunks: [],
    });
    const refs = collectReferencedVarIdsInParentFlowCorpus(corpus, known);
    expect(refs.has(d1)).toBe(true);
    expect(refs.has(d2)).toBe(false);
  });

  it('collectConditionIdsFromFlowEdges dedupes', () => {
    const ids = collectConditionIdsFromFlowEdges({
      edges: [{ conditionId: 'a' }, { conditionId: 'a' }, { conditionId: 'b' }],
    });
    expect(ids).toEqual(['a', 'b']);
  });

  it('conditionTextsForIds pulls expression fields', () => {
    const conds = [
      {
        id: 'a',
        expression: { compiledCode: 'CODE_A', script: 'S_A' },
      },
    ];
    const t = conditionTextsForIds(['a'], conds);
    expect(t.join('')).toContain('CODE_A');
    expect(t.join('')).toContain('S_A');
  });

  it('collectAllProjectConditionExpressionChunks gathers all category items', () => {
    const pd = {
      conditions: [
        {
          items: [
            { id: 'c1', expression: { compiledCode: `use ${d1}` } },
            { id: 'c2', expression: { script: `x ${d2}` } },
          ],
        },
      ],
    };
    const chunks = collectAllProjectConditionExpressionChunks(pd);
    const joined = chunks.join('\n');
    expect(joined).toContain(d1);
    expect(joined).toContain(d2);
  });

  it('partitionVariablesByReference splits rows', () => {
    const vars = [
      { id: d1, taskInstanceId: 't', dataPath: 'p' },
      { id: d2, taskInstanceId: 't', dataPath: 'p2' },
    ] as any[];
    const { referenced, notReferenced } = partitionVariablesByReference(vars, new Set([d1]));
    expect(referenced).toHaveLength(1);
    expect(notReferenced).toHaveLength(1);
    expect(referenced[0].id).toBe(d1);
  });
});

describe('collectReferencedVarIdsForParentFlowWorkspace (internal haystack)', () => {
  const d1 = '11111111-1111-4111-8111-111111111111';
  const d2 = '22222222-2222-4222-8222-222222222222';
  const taskId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

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

  const minimalFlow = (rowId: string) =>
    ({
      nodes: [{ data: { rows: [{ id: rowId }] } }],
      edges: [],
    }) as any;

  it('finds varId from persisted referenceScanInternalText on task (scan does not parse UI labels)', () => {
    getAllVariablesSpy.mockReturnValue([{ id: d1, taskInstanceId: taskId, dataPath: 'p' }] as any);
    getTaskSpy.mockImplementation((id: string) => {
      if (id !== taskId) return null;
      return {
        id: taskId,
        type: TaskType.SayMessage,
        templateId: null,
        displayText: 'Ciao {{nome}}!',
        referenceScanInternalText: `Ciao {{${d1}}}!`,
      } as any;
    });

    const refs = collectReferencedVarIdsForParentFlowWorkspace({
      projectId: 'proj1',
      parentFlowId: 'main',
      flows: { main: minimalFlow(taskId) } as any,
      movedTaskInstanceIdForReferenceScan: taskId,
    });

    expect(refs.has(d1)).toBe(true);
  });

  it('does not resolve raw UI task fields without referenceScanInternalText', () => {
    getAllVariablesSpy.mockReturnValue([{ id: d1, taskInstanceId: taskId, dataPath: 'p' }] as any);
    getTaskSpy.mockImplementation((id: string) => {
      if (id !== taskId) return null;
      return {
        id: taskId,
        type: TaskType.SayMessage,
        templateId: null,
        displayText: 'Ciao {{nome}}!',
      } as any;
    });

    const refs = collectReferencedVarIdsForParentFlowWorkspace({
      projectId: 'proj1',
      parentFlowId: 'main',
      flows: { main: minimalFlow(taskId) } as any,
      movedTaskInstanceIdForReferenceScan: taskId,
    });

    expect(refs.has(d1)).toBe(false);
  });

  it('finds varId from condition executableCode (GUID DSL)', () => {
    getAllVariablesSpy.mockReturnValue([
      { id: d2, varName: 'eta', taskInstanceId: taskId, dataPath: 'p' },
    ] as any);
    getTaskSpy.mockReturnValue(null);

    const refs = collectReferencedVarIdsForParentFlowWorkspace({
      projectId: 'proj1',
      parentFlowId: 'main',
      flows: {
        main: {
          nodes: [],
          edges: [{ conditionId: 'cond1' }],
        },
      } as any,
      conditions: [
        {
          id: 'cond1',
          expression: { executableCode: `[${d2}] > 0`, script: '[eta] > 0' },
        },
      ],
    });

    expect(refs.has(d2)).toBe(true);
  });

  it('ignores condition script when executable/internal present', () => {
    getAllVariablesSpy.mockReturnValue([
      { id: d1, taskInstanceId: 't', dataPath: 'p' },
      { id: d2, taskInstanceId: 't', dataPath: 'p' },
    ] as any);
    getTaskSpy.mockReturnValue(null);
    const refs = collectReferencedVarIdsForParentFlowWorkspace({
      projectId: 'proj1',
      parentFlowId: 'main',
      flows: { main: { nodes: [], edges: [{ conditionId: 'c1' }] } } as any,
      conditions: [
        {
          id: 'c1',
          expression: {
            internalReferenceText: `[${d2}] == 1`,
            script: '[wrong] > 0',
          },
        },
      ],
    });
    expect(refs.has(d2)).toBe(true);
    expect(refs.has(d1)).toBe(false);
  });

  it('finds varId from task referenceScanInternalText for API-shaped payload', () => {
    getAllVariablesSpy.mockReturnValue([{ id: d1, taskInstanceId: taskId, dataPath: 'p' }] as any);
    getTaskSpy.mockImplementation((id: string) => {
      if (id !== taskId) return null;
      return {
        id: taskId,
        type: TaskType.BackendCall,
        templateId: null,
        params: { body: '{"x":"{{nome}}"}' },
        referenceScanInternalText: `{"x":"{{${d1}}"}`,
      } as any;
    });

    const refs = collectReferencedVarIdsForParentFlowWorkspace({
      projectId: 'proj1',
      parentFlowId: 'main',
      flows: { main: minimalFlow(taskId) } as any,
    });

    expect(refs.has(d1)).toBe(true);
  });

  it('finds varId in serialized flow A JSON (e.g. meta / bindings)', () => {
    getAllVariablesSpy.mockReturnValue([{ id: d1, taskInstanceId: taskId, dataPath: 'p' }] as any);
    getTaskSpy.mockReturnValue(null);

    const refs = collectReferencedVarIdsForParentFlowWorkspace({
      projectId: 'proj1',
      parentFlowId: 'main',
      flows: {
        main: {
          nodes: [],
          edges: [],
          meta: { flowInterface: { output: [{ variableRefId: d1 }] } },
        },
      } as any,
    });

    expect(refs.has(d1)).toBe(true);
  });

  it('isVariableReferencedInFlow matches collectReferencedVarIdsForParentFlowWorkspace', () => {
    getAllVariablesSpy.mockReturnValue([{ id: d1, taskInstanceId: taskId, dataPath: 'p' }] as any);
    getTaskSpy.mockReturnValue(null);

    const params = {
      projectId: 'proj1',
      parentFlowId: 'main',
      flows: {
        main: {
          nodes: [],
          edges: [],
          meta: { flowInterface: { output: [{ variableRefId: d1 }] } },
        },
      } as any,
    };

    expect(isVariableReferencedInFlow(d1, params)).toBe(true);
    expect(isVariableReferencedInFlow(d2, params)).toBe(false);
  });
});
