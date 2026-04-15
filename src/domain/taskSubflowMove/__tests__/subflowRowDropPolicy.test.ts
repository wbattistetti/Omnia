import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskType } from '@types/taskTypes';
import type { Task } from '@types/taskTypes';

vi.mock('../subflowSyncFlowsRef', () => ({
  getSubflowSyncFlows: vi.fn(() => ({})),
}));

import { getSubflowSyncFlows } from '../subflowSyncFlowsRef';
import {
  canAcceptSubflowPortalRowDrop,
  flowCanvasIdImplementsSubflowNestedFlow,
  getChildFlowIdFromSubflowTask,
} from '../subflowRowDropPolicy';

describe('getChildFlowIdFromSubflowTask', () => {
  it('prefers task.flowId', () => {
    expect(getChildFlowIdFromSubflowTask({ flowId: 'abc', parameters: [] })).toBe('abc');
  });

  it('reads flowId from parameters when direct flowId is empty', () => {
    expect(
      getChildFlowIdFromSubflowTask({
        parameters: [{ parameterId: 'flowId', value: 'nested-1' }],
      })
    ).toBe('nested-1');
  });
});

describe('flowCanvasIdImplementsSubflowNestedFlow', () => {
  beforeEach(() => {
    vi.mocked(getSubflowSyncFlows).mockReturnValue({});
  });

  it('is true when canvas id equals nested flow id', () => {
    expect(flowCanvasIdImplementsSubflowNestedFlow('flow-a', 'flow-a')).toBe(true);
  });

  it('is true when slice id matches nested flow id (alias canvas key)', () => {
    vi.mocked(getSubflowSyncFlows).mockReturnValue({
      canvasKey: { id: 'real-flow-id' },
    } as any);
    expect(flowCanvasIdImplementsSubflowNestedFlow('canvasKey', 'real-flow-id')).toBe(true);
  });
});

describe('canAcceptSubflowPortalRowDrop', () => {
  const subflow = (childFlowId: string): Task =>
    ({
      id: 't1',
      type: TaskType.Subflow,
      templateId: null,
      flowId: childFlowId,
    }) as Task;

  it('allows non-Subflow tasks', () => {
    expect(
      canAcceptSubflowPortalRowDrop(
        { id: 'x', type: TaskType.SayMessage, templateId: null } as Task,
        'any',
        { sameFlowCrossNodeDrop: false }
      )
    ).toBe(true);
  });

  it('rejects same-flow cross-node Subflow portal drops', () => {
    expect(
      canAcceptSubflowPortalRowDrop(subflow('child'), 'main', { sameFlowCrossNodeDrop: true })
    ).toBe(false);
  });

  it('rejects dropping the portal onto the nested flow canvas (self-call)', () => {
    expect(
      canAcceptSubflowPortalRowDrop(subflow('nested-1'), 'nested-1', { sameFlowCrossNodeDrop: false })
    ).toBe(false);
  });

  it('allows Subflow portal onto a different flow canvas', () => {
    expect(
      canAcceptSubflowPortalRowDrop(subflow('nested-1'), 'main', { sameFlowCrossNodeDrop: false })
    ).toBe(true);
  });
});
