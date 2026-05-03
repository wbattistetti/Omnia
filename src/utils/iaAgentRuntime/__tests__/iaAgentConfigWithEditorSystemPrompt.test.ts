import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';
import type { Task } from '@types/taskTypes';
import { TaskType } from '@types/taskTypes';

const resolveElevenLabs = vi.fn();
vi.mock(
  '@components/TaskEditor/EditorHost/editors/aiAgentEditor/resolveAiAgentPlatformRulesString',
  () => ({
    resolveElevenLabsAgentPromptFromTask: (task: Task, opts?: unknown) => resolveElevenLabs(task, opts),
  })
);

import { iaAgentConfigWithEditorSystemPrompt } from '../iaAgentConfigWithEditorSystemPrompt';

const baseCfg: IAAgentConfig = {
  platform: 'elevenlabs',
  convaiAgentId: '',
  systemPrompt: 'fallback-from-runtime-json',
} as IAAgentConfig;

function minimalTask(overrides: Partial<Task>): Task {
  return {
    id: 't1',
    instanceId: 't1',
    type: TaskType.AIAgent,
    agentRuntimeCompactJson: '',
    agentPrompt: '',
    ...overrides,
  } as Task;
}

describe('iaAgentConfigWithEditorSystemPrompt', () => {
  beforeEach(() => {
    resolveElevenLabs.mockReset();
  });

  it('returns cfg unchanged when task is null', () => {
    expect(iaAgentConfigWithEditorSystemPrompt(baseCfg, null)).toBe(baseCfg);
  });

  it('sets systemPrompt from resolveElevenLabsAgentPromptFromTask when non-empty', () => {
    resolveElevenLabs.mockReturnValue('  Hello from editor  ');
    const task = minimalTask({ agentPrompt: 'x' });
    const out = iaAgentConfigWithEditorSystemPrompt(baseCfg, task);
    expect(out).not.toBe(baseCfg);
    expect(out.systemPrompt).toBe('Hello from editor');
  });

  it('forwards manualCatalogBackendTaskIds to the resolver (options pass-through)', () => {
    resolveElevenLabs.mockReturnValue('ok');
    const task = minimalTask({ agentPrompt: 'x' });
    iaAgentConfigWithEditorSystemPrompt(baseCfg, task, { manualCatalogBackendTaskIds: ['a'] });
    expect(resolveElevenLabs).toHaveBeenCalledWith(task, { manualCatalogBackendTaskIds: ['a'] });
  });

  it('leaves cfg unchanged when editor yields empty string', () => {
    resolveElevenLabs.mockReturnValue('   ');
    const task = minimalTask({ agentRuntimeCompactJson: '', agentPrompt: '   ' });
    expect(iaAgentConfigWithEditorSystemPrompt(baseCfg, task)).toBe(baseCfg);
  });
});
