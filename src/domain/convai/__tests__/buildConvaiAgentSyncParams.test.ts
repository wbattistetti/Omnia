import { describe, expect, it, vi } from 'vitest';
import { buildConvaiAgentSyncParams } from '../buildConvaiAgentSyncParams';
import { TaskType } from '@types/taskTypes';
import { taskRepository } from '@services/TaskRepository';

describe('buildConvaiAgentSyncParams', () => {
  it('returns null when agent task missing', () => {
    expect(buildConvaiAgentSyncParams({ agentTaskId: 'missing' })).toBeNull();
  });

  it('builds params for AI Agent task', () => {
    const id = 'agent-sync-test';
    vi.spyOn(taskRepository, 'getTask').mockReturnValue({
      id,
      type: TaskType.AIAgent,
      label: 'Agent',
      agentUseCasesJson: '[]',
    } as never);
    const params = buildConvaiAgentSyncParams({
      agentTaskId: id,
      manualCatalogBackendTaskIds: ['bk1'],
    });
    expect(params?.agentTask.id).toBe(id);
    expect(params?.useCases).toEqual([]);
    expect(params?.manualCatalogBackendTaskIds).toEqual(['bk1']);
  });
});
