import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TaskType } from '@types/taskTypes';

vi.mock('@utils/iaAgentRuntime/globalIaAgentPersistence', () => ({
  loadGlobalIaAgentConfig: () => ({
    platform: 'elevenlabs',
    model: 'convai_default',
    temperature: 0.7,
    maxTokens: 4096,
    reasoning: 'medium',
    systemPrompt: '',
    tools: [],
    voice: { id: '', language: 'en' },
    voices: [{ id: '', role: 'primary' }],
    advanced: {
      llm: { model: 'gpt-4o-mini', temperature: 0.5, max_tokens: 4096 },
    },
  }),
}));

describe('collectIaAgentRuntimeCompileErrors', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('includes normalized provisioning error and skips generic missing agent id', async () => {
    const { setIaProvisioningError } = await import('../iaProvisioningErrorStore');
    const { collectIaAgentRuntimeCompileErrors } = await import('../collectIaAgentRuntimeCompileErrors');

    setIaProvisioningError('task-prov', {
      provider: 'elevenlabs',
      code: 'validation',
      message: 'Non-english Agents must use turbo or flash v2_5.',
    });

    const json = JSON.stringify({
      platform: 'elevenlabs',
      voices: [{ id: 'voice_1', role: 'primary' }],
      voice: { id: 'voice_1', language: 'it' },
      advanced: {
        llm: { model: 'gpt-4o', temperature: 0.5, max_tokens: 4096 },
      },
    });

    const raw = collectIaAgentRuntimeCompileErrors(
      [{ id: 'task-prov', type: TaskType.AIAgent, agentIaRuntimeOverrideJson: json }],
      new Map([['task-prov', { rowId: 'task-prov', flowId: 'main', nodeId: 'n1' }]]),
      'main'
    );

    expect(raw.some((e) => e.code === 'IaProvisionProviderError')).toBe(true);
    expect(raw.some((e) => e.code === 'IaElevenLabsMissingAgentId')).toBe(false);
    const prov = raw.find((e) => e.code === 'IaProvisionProviderError');
    expect((prov?.fixTarget as { focus?: string })?.focus).toBe('llm');

    setIaProvisioningError('task-prov', null);
  });

  it('does not flag IaElevenLabsMissingAgentId when convaiAgentId absent (provisioning gestisce createAgent)', async () => {
    const { collectIaAgentRuntimeCompileErrors } = await import('../collectIaAgentRuntimeCompileErrors');

    const json = JSON.stringify({
      platform: 'elevenlabs',
      voices: [{ id: 'voice_1', role: 'primary' }],
      voice: { id: 'voice_1', language: 'it-IT' },
      advanced: {
        llm: { model: 'gpt-4o-mini', temperature: 0.5, max_tokens: 4096 },
      },
    });

    const raw = collectIaAgentRuntimeCompileErrors(
      [{ id: 'task-a', type: TaskType.AIAgent, agentIaRuntimeOverrideJson: json }],
      new Map([['task-a', { rowId: 'task-a', flowId: 'main', nodeId: 'n1' }]]),
      'main'
    );

    expect(raw.some((e) => (e.code as string) === 'IaElevenLabsMissingAgentId')).toBe(false);
  });

  it('does not duplicate elevenlabs checks when configured', async () => {
    const { collectIaAgentRuntimeCompileErrors } = await import('../collectIaAgentRuntimeCompileErrors');

    const json = JSON.stringify({
      platform: 'elevenlabs',
      convaiAgentId: 'ag_xyz',
      voices: [{ id: 'voice_1', role: 'primary' }],
      voice: { id: 'voice_1', language: 'it-IT' },
      advanced: {
        llm: { model: 'gpt-4o-mini', temperature: 0.5, max_tokens: 4096 },
      },
    });

    const raw = collectIaAgentRuntimeCompileErrors(
      [{ id: 'task-b', type: TaskType.AIAgent, agentIaRuntimeOverrideJson: json }],
      new Map([['task-b', { rowId: 'task-b', flowId: 'main', nodeId: 'n1' }]]),
      'main'
    );

    expect(raw.filter((e) => String(e.code ?? '').startsWith('IaElevenLabs'))).toHaveLength(0);
  });
});
