import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isVariableVisibleInFlow,
  getTaskInstanceIdsOnFlowCanvas,
  getTaskInstanceIdsOnFlowCanvasFromFlows,
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
      id: 'a',
      varName: 'x',
      taskInstanceId: 'task-1',
      dataPath: 'd',
      scope: 'project',
    });
    expect(isVariableVisibleInFlow(v, 'main')).toBe(true);
    expect(isVariableVisibleInFlow(v, 'other')).toBe(false);
    expect(isVariableVisibleInFlow(v, 'subflow_x')).toBe(false);
  });

  it('when flows override is passed, uses it instead of FlowWorkspaceSnapshot for task rows', () => {
    FlowWorkspaceSnapshot.setSnapshot({}, 'main');
    const v = normalizeVariableInstance({
      id: 'a',
      varName: 'colore',
      taskInstanceId: 'task-1',
      dataPath: 'd',
      scope: 'project',
    });
    expect(isVariableVisibleInFlow(v, 'main')).toBe(false);
    const flows = {
      main: {
        id: 'main',
        title: 'Main',
        nodes: [{ id: 'n1', data: { rows: [{ id: 'task-1', text: 'Ask' }] } } as any],
        edges: [],
      },
    } as any;
    expect(getTaskInstanceIdsOnFlowCanvasFromFlows('main', flows).has('task-1')).toBe(true);
    expect(isVariableVisibleInFlow(v, 'main', flows)).toBe(true);
  });

  it('project-scoped manual globals (no task) are visible on every flow canvas', () => {
    const v = normalizeVariableInstance({
      id: 'b',
      varName: 'y',
      taskInstanceId: '',
      dataPath: '',
      scope: 'project',
    });
    expect(isVariableVisibleInFlow(v, 'main')).toBe(true);
    expect(isVariableVisibleInFlow(v, 'subflow_x')).toBe(true);
  });

  it('shows flow-scoped variables only on matching canvas', () => {
    const v = normalizeVariableInstance({
      id: 'c',
      varName: 'z',
      taskInstanceId: '',
      dataPath: '',
      scope: 'flow',
      scopeFlowId: 'subflow_1',
    });
    expect(isVariableVisibleInFlow(v, 'subflow_1')).toBe(true);
    expect(isVariableVisibleInFlow(v, 'main')).toBe(false);
  });

  it('sameVariableScopeBucket distinguishes project vs flow', () => {
    const project = normalizeVariableInstance({
      id: 'd',
      varName: 'p',
      taskInstanceId: '',
      dataPath: '',
      scope: 'project',
    });
    expect(sameVariableScopeBucket(project, 'project', null)).toBe(true);
    expect(sameVariableScopeBucket(project, 'flow', 'main')).toBe(false);
  });

  it('downgrades invalid flow scope without flow id to project', () => {
    const v = normalizeVariableInstance({
      id: 'e',
      varName: 'q',
      taskInstanceId: '',
      dataPath: '',
      scope: 'flow',
      scopeFlowId: '',
    });
    expect(v.scope).toBe('project');
  });
});
