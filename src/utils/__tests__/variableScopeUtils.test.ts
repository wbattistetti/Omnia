import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isVariableVisibleInFlow,
  getTaskInstanceIdsOnFlowCanvas,
  normalizeVariableInstance,
  sameVariableScopeBucket,
} from '../variableScopeUtils';
import { FlowWorkspaceSnapshot } from '../../flows/FlowWorkspaceSnapshot';

describe('variableScopeUtils', () => {
  beforeEach(() => {
    FlowWorkspaceSnapshot.setSnapshot(
      {
        main: {
          nodes: [{ id: 'n1', data: { rows: [{ id: 'task-1', text: 'T' }] } } as any],
          edges: [],
        },
        other: { nodes: [{ id: 'n2', data: { rows: [{ id: 'task-2', text: 'U' }] } } as any], edges: [] },
        subflow_x: { nodes: [], edges: [] },
        subflow_1: { nodes: [], edges: [] },
      },
      'main'
    );
  });

  afterEach(() => {
    FlowWorkspaceSnapshot.setSnapshot({}, 'main');
  });

  it('getTaskInstanceIdsOnFlowCanvas collects row ids', () => {
    expect([...getTaskInstanceIdsOnFlowCanvas('main')]).toEqual(['task-1']);
    expect([...getTaskInstanceIdsOnFlowCanvas('other')]).toEqual(['task-2']);
    expect(getTaskInstanceIdsOnFlowCanvas('subflow_x').size).toBe(0);
  });

  it('task-bound variables are visible only on flows that contain that task row', () => {
    const v = normalizeVariableInstance({
      varId: 'a',
      varName: 'x',
      taskInstanceId: 'task-1',
      nodeId: 'n',
      ddtPath: 'd',
      scope: 'project',
    });
    expect(isVariableVisibleInFlow(v, 'main')).toBe(true);
    expect(isVariableVisibleInFlow(v, 'other')).toBe(false);
    expect(isVariableVisibleInFlow(v, 'subflow_x')).toBe(false);
  });

  it('project-scoped manual variables (no task) are not visible on per-flow authoring surfaces', () => {
    const v = normalizeVariableInstance({
      varId: 'b',
      varName: 'y',
      taskInstanceId: '',
      nodeId: '',
      ddtPath: '',
      scope: 'project',
    });
    expect(isVariableVisibleInFlow(v, 'main')).toBe(false);
    expect(isVariableVisibleInFlow(v, 'subflow_x')).toBe(false);
  });

  it('shows flow-scoped variables only on matching canvas', () => {
    const v = normalizeVariableInstance({
      varId: 'c',
      varName: 'z',
      taskInstanceId: '',
      nodeId: '',
      ddtPath: '',
      scope: 'flow',
      scopeFlowId: 'subflow_1',
    });
    expect(isVariableVisibleInFlow(v, 'subflow_1')).toBe(true);
    expect(isVariableVisibleInFlow(v, 'main')).toBe(false);
  });

  it('sameVariableScopeBucket distinguishes project vs flow', () => {
    const project = normalizeVariableInstance({
      varId: 'd',
      varName: 'p',
      taskInstanceId: '',
      nodeId: '',
      ddtPath: '',
      scope: 'project',
    });
    expect(sameVariableScopeBucket(project, 'project', null)).toBe(true);
    expect(sameVariableScopeBucket(project, 'flow', 'main')).toBe(false);
  });

  it('downgrades invalid flow scope without flow id to project', () => {
    const v = normalizeVariableInstance({
      varId: 'e',
      varName: 'q',
      taskInstanceId: '',
      nodeId: '',
      ddtPath: '',
      scope: 'flow',
      scopeFlowId: '',
    });
    expect(v.scope).toBe('project');
  });
});
