import { describe, it, expect } from 'vitest';
import {
  isVariableVisibleInFlow,
  normalizeVariableInstance,
  sameVariableScopeBucket,
} from '../variableScopeUtils';

describe('variableScopeUtils', () => {
  it('treats task-bound variables as visible in every flow', () => {
    const v = normalizeVariableInstance({
      varId: 'a',
      varName: 'x',
      taskInstanceId: 'task-1',
      nodeId: 'n',
      ddtPath: 'd',
      scope: 'flow',
      scopeFlowId: 'main',
    });
    expect(isVariableVisibleInFlow(v, 'other')).toBe(true);
  });

  it('shows project-scoped manual variables in all flows', () => {
    const v = normalizeVariableInstance({
      varId: 'b',
      varName: 'y',
      taskInstanceId: '',
      nodeId: '',
      ddtPath: '',
      scope: 'project',
    });
    expect(isVariableVisibleInFlow(v, 'main')).toBe(true);
    expect(isVariableVisibleInFlow(v, 'subflow_x')).toBe(true);
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
