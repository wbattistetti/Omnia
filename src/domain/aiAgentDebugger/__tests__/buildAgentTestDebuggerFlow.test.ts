import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TaskType } from '@types/taskTypes';
import { buildSyntheticSingleAgentFlow } from '../buildAgentTestDebuggerFlow';

vi.mock('@services/TaskRepository', () => ({
  taskRepository: {
    getTask: vi.fn(),
    getAllTasks: vi.fn(() => []),
  },
}));

vi.mock('@flows/FlowWorkspaceSnapshot', () => ({
  FlowWorkspaceSnapshot: {
    getAllFlowIds: vi.fn(() => []),
    getFlowById: vi.fn(() => null),
  },
}));

describe('buildSyntheticSingleAgentFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds one-node flow with agent row id', () => {
    const slice = buildSyntheticSingleAgentFlow('agent-1', 'Paros OT', []);
    expect(slice.flowId).toBe('__agent_test__agent-1');
    expect(slice.nodes).toHaveLength(1);
    const node = slice.nodes[0] as { data?: { rows?: { id: string }[] } };
    expect(node.data?.rows?.[0]?.id).toBe('agent-1');
  });
});

describe('findAiAgentFlowPlacement', () => {
  it('returns null when agent task missing', async () => {
    const { taskRepository } = await import('@services/TaskRepository');
    vi.mocked(taskRepository.getTask).mockReturnValue(undefined);
    const { findAiAgentFlowPlacement } = await import('../findAiAgentFlowPlacement');
    expect(findAiAgentFlowPlacement('missing')).toBeNull();
  });

  it('returns null for non AI Agent task type', async () => {
    const { taskRepository } = await import('@services/TaskRepository');
    vi.mocked(taskRepository.getTask).mockReturnValue({
      id: 't1',
      type: TaskType.SayMessage,
      label: 'Say',
      templateId: null,
    } as never);
    const { findAiAgentFlowPlacement } = await import('../findAiAgentFlowPlacement');
    expect(findAiAgentFlowPlacement('t1')).toBeNull();
  });
});
