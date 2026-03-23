/**
 * Tests for AI Agent persist downgrade safety net.
 */

import { describe, expect, it } from 'vitest';
import { taskRepository } from '@services/TaskRepository';
import { TaskType, type Task } from '@types/taskTypes';
import { wouldDowngradeAgentPersistPatch } from './aiAgentPersistGuard';

const PROJECT = 'proj-ai-agent-guard';

function emptyPatch(): Record<string, unknown> {
  return {
    agentDesignDescription: '',
    agentPrompt: '',
    agentStructuredSectionsJson: '',
    agentUseCasesJson: '[]',
    agentLogicalStepsJson: '[]',
    agentProposedFields: [],
    agentDesignHasGeneration: false,
  };
}

describe('wouldDowngradeAgentPersistPatch', () => {
  it('returns false when task is missing from repository', () => {
    expect(wouldDowngradeAgentPersistPatch('missing-id', emptyPatch())).toBe(false);
  });

  it('returns true when repo has description and patch clears description', () => {
    const id = 'task-guard-desc';
    taskRepository.createTask(TaskType.AIAgent, null, undefined, id, PROJECT);
    taskRepository.updateTask(
      id,
      { agentDesignDescription: 'Saved design' } as Partial<Task>,
      PROJECT
    );
    expect(wouldDowngradeAgentPersistPatch(id, emptyPatch())).toBe(true);
  });

  it('returns false when patch keeps description equal to repo', () => {
    const id = 'task-guard-sync';
    taskRepository.createTask(TaskType.AIAgent, null, undefined, id, PROJECT);
    taskRepository.updateTask(
      id,
      { agentDesignDescription: 'Kept' } as Partial<Task>,
      PROJECT
    );
    expect(
      wouldDowngradeAgentPersistPatch(id, {
        ...emptyPatch(),
        agentDesignDescription: 'Kept',
      })
    ).toBe(false);
  });

  it('returns true when repo has use cases JSON and patch clears use cases', () => {
    const id = 'task-guard-uc';
    taskRepository.createTask(TaskType.AIAgent, null, undefined, id, PROJECT);
    taskRepository.updateTask(
      id,
      { agentUseCasesJson: '[{"id":"a"}]' } as Partial<Task>,
      PROJECT
    );
    expect(wouldDowngradeAgentPersistPatch(id, emptyPatch())).toBe(true);
  });

  it('returns true when repo has agentStructuredSectionsJson and patch clears it', () => {
    const id = 'task-guard-structured';
    taskRepository.createTask(TaskType.AIAgent, null, undefined, id, PROJECT);
    taskRepository.updateTask(
      id,
      { agentStructuredSectionsJson: '{"sections":{}}' } as Partial<Task>,
      PROJECT
    );
    expect(wouldDowngradeAgentPersistPatch(id, emptyPatch())).toBe(true);
  });

  it('returns true when repo has description and patch clears description even if structured JSON is non-empty', () => {
    const id = 'task-guard-mixed';
    taskRepository.createTask(TaskType.AIAgent, null, undefined, id, PROJECT);
    taskRepository.updateTask(
      id,
      {
        agentDesignDescription: 'Hello world text',
        agentStructuredSectionsJson: '{"sections":{}}',
      } as Partial<Task>,
      PROJECT
    );
    expect(
      wouldDowngradeAgentPersistPatch(id, {
        ...emptyPatch(),
        agentDesignDescription: '',
        agentStructuredSectionsJson: '{"sections":{}}',
        agentPrompt: 'x',
      })
    ).toBe(true);
  });
});
