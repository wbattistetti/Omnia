import { describe, expect, it } from 'vitest';
import { iaAgentConfigWithEditorSystemPrompt } from '../iaAgentConfigWithEditorSystemPrompt';
import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';
import type { Task } from '@types/taskTypes';
import { TaskType } from '@types/taskTypes';

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
  it('returns cfg unchanged when task is null', () => {
    expect(iaAgentConfigWithEditorSystemPrompt(baseCfg, null)).toBe(baseCfg);
  });

  it('sets systemPrompt from agentPrompt when compact is empty', () => {
    const task = minimalTask({ agentPrompt: '  Hello from editor  ' });
    const out = iaAgentConfigWithEditorSystemPrompt(baseCfg, task);
    expect(out).not.toBe(baseCfg);
    expect(out.systemPrompt).toBe('Hello from editor');
  });

  it('leaves cfg unchanged when editor yields empty string', () => {
    const task = minimalTask({ agentRuntimeCompactJson: '', agentPrompt: '   ' });
    expect(iaAgentConfigWithEditorSystemPrompt(baseCfg, task)).toBe(baseCfg);
  });
});
