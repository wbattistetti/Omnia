/**
 * ConvAI: appendix contratti backend nel prompt da `convaiBackendToolTaskIds` + task repository.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TaskType, type Task } from '@types/taskTypes';

const getTask = vi.fn();
vi.mock('@services/TaskRepository', () => ({
  taskRepository: { getTask: (...args: unknown[]) => getTask(...args) },
}));

import { resolveElevenLabsAgentPromptFromTask } from '../resolveAiAgentPlatformRulesString';

const minimalStructured = JSON.stringify({
  version: 1,
  sections: {
    goal: { base: 'G', deletedMask: '', inserts: [] },
    operational_sequence: { base: 'O', deletedMask: '', inserts: [] },
    context: { base: 'missing', deletedMask: '', inserts: [] },
    constraints: { base: '', deletedMask: '', inserts: [] },
    personality: { base: '', deletedMask: '', inserts: [] },
    tone: { base: '', deletedMask: '', inserts: [] },
    examples: { base: '', deletedMask: '', inserts: [] },
  },
});

describe('resolveElevenLabsAgentPromptFromTask ConvAI appendix', () => {
  beforeEach(() => {
    getTask.mockReset();
  });

  it('replaces missing context with backend contract appendix', () => {
    getTask.mockImplementation((id: string) =>
      id === 'bk1'
        ? ({
            id: 'bk1',
            type: TaskType.BackendCall,
            label: 'Slots',
            backendToolDescription: 'Restituisce slot ISO.',
            endpoint: { url: 'https://x/', method: 'GET', headers: {} },
          } as Task)
        : null
    );

    const task = {
      agentStructuredSectionsJson: minimalStructured,
      agentPrompt: '',
      agentPromptTargetPlatform: 'elevenlabs',
      agentIaRuntimeOverrideJson: JSON.stringify({
        platform: 'elevenlabs',
        convaiBackendToolTaskIds: ['bk1'],
      }),
    } as Task;

    const out = resolveElevenLabsAgentPromptFromTask(task);
    expect(out).toContain('Contratto tool backend');
    expect(out).toContain('Slots');
    expect(out).toContain('Restituisce slot ISO');
    expect(out).not.toMatch(/### Context\n\nmissing/m);
  });

  it('adds appendix from manualCatalogBackendTaskIds when override JSON has no backend ids', () => {
    getTask.mockImplementation((id: string) =>
      id === 'catBk'
        ? ({
            id: 'catBk',
            type: TaskType.BackendCall,
            label: 'Catalog API',
            backendToolDescription: 'Chiama il catalogo.',
            endpoint: { url: 'https://z/', method: 'GET', headers: {} },
          } as Task)
        : null
    );

    const task = {
      agentStructuredSectionsJson: minimalStructured,
      agentPrompt: '',
      agentPromptTargetPlatform: 'elevenlabs',
      agentIaRuntimeOverrideJson: JSON.stringify({ platform: 'elevenlabs', convaiBackendToolTaskIds: [] }),
    } as Task;

    const out = resolveElevenLabsAgentPromptFromTask(task, {
      manualCatalogBackendTaskIds: ['catBk'],
    });
    expect(out).toContain('Contratto tool backend');
    expect(out).toContain('Catalog API');
    expect(out).not.toMatch(/### Context\n\nmissing/m);
  });
});
