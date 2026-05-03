import { describe, expect, it } from 'vitest';
import { TaskType, type Task } from '@types/taskTypes';
import {
  collectReachableBackendCallTaskIdsFromFlow,
  type FlowSliceForBackendDiscovery,
} from '../collectReachableBackendCallTaskIdsFromFlow';

describe('collectReachableBackendCallTaskIdsFromFlow', () => {
  const tasks = new Map<string, Task>([
    ['agent-1', { id: 'agent-1', type: TaskType.AIAgent } as Task],
    ['bk-a', { id: 'bk-a', type: TaskType.BackendCall } as Task],
    ['bk-b', { id: 'bk-b', type: TaskType.BackendCall } as Task],
    ['other', { id: 'other', type: TaskType.Message } as Task],
  ]);

  const getTask = (id: string) => tasks.get(id);

  it('returns backend ids reachable via outgoing edges from the agent row node', () => {
    const flow: FlowSliceForBackendDiscovery = {
      nodes: [
        { id: 'n1', data: { rows: [{ id: 'agent-1' }] } },
        { id: 'n2', data: { rows: [{ id: 'bk-a' }] } },
        { id: 'n3', data: { rows: [{ id: 'bk-b' }] } },
      ],
      edges: [
        { source: 'n1', target: 'n2' },
        { source: 'n2', target: 'n3' },
      ],
    };
    const out = collectReachableBackendCallTaskIdsFromFlow(flow, 'agent-1', getTask);
    expect(out.sort()).toEqual(['bk-a', 'bk-b'].sort());
  });

  it('does not traverse upstream or unrelated branches', () => {
    const flow: FlowSliceForBackendDiscovery = {
      nodes: [
        { id: 'n0', data: { rows: [{ id: 'other' }] } },
        { id: 'n1', data: { rows: [{ id: 'agent-1' }] } },
        { id: 'n2', data: { rows: [{ id: 'bk-a' }] } },
        { id: 'n3', data: { rows: [{ id: 'bk-b' }] } },
      ],
      edges: [
        { source: 'n0', target: 'n1' },
        { source: 'n1', target: 'n2' },
        { source: 'n1', target: 'n3' },
      ],
    };
    const out = collectReachableBackendCallTaskIdsFromFlow(flow, 'agent-1', getTask);
    expect(out).toContain('bk-a');
    expect(out).toContain('bk-b');
    expect(out).not.toContain('other');
  });

  it('returns empty when agent row is not on any node', () => {
    const flow: FlowSliceForBackendDiscovery = {
      nodes: [{ id: 'n2', data: { rows: [{ id: 'bk-a' }] } }],
      edges: [],
    };
    expect(collectReachableBackendCallTaskIdsFromFlow(flow, 'missing', getTask)).toEqual([]);
  });
});
