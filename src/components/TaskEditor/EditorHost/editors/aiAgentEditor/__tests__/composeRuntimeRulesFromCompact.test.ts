/**
 * Tests for compact runtime JSON parsing and platform-resolved compile rules.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/iaAgentRuntime/globalIaAgentPersistence', () => ({
  loadGlobalIaAgentConfig: vi.fn(),
}));

import { loadGlobalIaAgentConfig } from '@utils/iaAgentRuntime/globalIaAgentPersistence';
import { getDefaultConfig } from '@utils/iaAgentRuntime/platformHelpers';
import {
  buildMinimalAiAgentCompileTask,
  composeRulesTextFromRuntimeCompact,
  parseAgentRuntimeCompactJson,
} from '../composeRuntimeRulesFromCompact';

const mockLoadGlobalIa = vi.mocked(loadGlobalIaAgentConfig);

describe('composeRuntimeRulesFromCompact', () => {
  beforeEach(() => {
    mockLoadGlobalIa.mockReturnValue(getDefaultConfig('openai'));
  });
  it('parseAgentRuntimeCompactJson returns null for empty or invalid', () => {
    expect(parseAgentRuntimeCompactJson('')).toBeNull();
    expect(parseAgentRuntimeCompactJson('not json')).toBeNull();
    expect(parseAgentRuntimeCompactJson('{}')).toBeNull();
  });

  it('parses valid compact JSON', () => {
    const rc = {
      behavior_compact: 'Do A.',
      constraints_compact: 'Must B.',
      sequence_compact: 'Step 1.',
      corrections_compact: 'Fix C.',
      examples_compact: [
        { role: 'assistant' as const, content: 'Hi' },
        { role: 'user' as const, content: 'Yo' },
      ],
    };
    const json = JSON.stringify(rc);
    expect(parseAgentRuntimeCompactJson(json)).toEqual(rc);
  });

  it('composeRulesTextFromRuntimeCompact joins four fields', () => {
    const text = composeRulesTextFromRuntimeCompact({
      behavior_compact: 'One',
      constraints_compact: 'Two',
      sequence_compact: 'Three',
      corrections_compact: 'Four',
      examples_compact: [{ role: 'assistant', content: 'x' }, { role: 'user', content: 'y' }],
    });
    expect(text).toBe('One\n\nTwo\n\nThree\n\nFour');
  });

  it('buildMinimalAiAgentCompileTask derives rules from persisted sections / migrated agentPrompt', () => {
    const minimal = buildMinimalAiAgentCompileTask({
      id: 'task-1',
      type: 6,
      templateId: null,
      llmEndpoint: '',
      agentStructuredSectionsJson: '',
      agentPrompt: '## Purpose\n\nServe users politely.',
      agentPromptTargetPlatform: undefined,
    });
    expect(minimal.id).toBe('task-1');
    expect(minimal.type).toBe(6);
    expect(minimal.rules.length).toBeGreaterThan(20);
    expect(minimal.rules).toMatch(/Purpose|Serve users/i);
    expect(minimal.llmEndpoint).toBe('http://localhost:3100/api/runtime/ai-agent/step');
    expect(minimal.immediateStart).toBe(false);
    expect(minimal.firstMessage).toBe('Hello! How can I help you today?');
    expect(Object.keys(minimal).sort()).toEqual(
      ['firstMessage', 'immediateStart', 'id', 'llmEndpoint', 'rules', 'templateId', 'type'].sort()
    );
  });

  it('buildMinimalAiAgentCompileTask keeps explicit llmEndpoint', () => {
    const custom = 'https://example.com/step';
    const minimal = buildMinimalAiAgentCompileTask({
      id: 'x',
      type: 6,
      templateId: null,
      llmEndpoint: custom,
      agentStructuredSectionsJson: '',
      agentPrompt: 'Hello.',
    });
    expect(minimal.llmEndpoint).toBe(custom);
  });

  it('buildMinimalAiAgentCompileTask adds ElevenLabs fields when override platform is elevenlabs', () => {
    const minimal = buildMinimalAiAgentCompileTask({
      id: 'agent-task-1',
      type: 6,
      templateId: null,
      agentStructuredSectionsJson: '',
      agentPrompt: 'Agent instructions here.',
      agentIaRuntimeOverrideJson: JSON.stringify({
        platform: 'elevenlabs',
        model: 'convai_default',
        temperature: 0.5,
        maxTokens: 1024,
        reasoning: 'none',
        systemPrompt: '',
        tools: [],
        convaiAgentId: 'agent_xyz',
        elevenLabsBackendBaseUrl: 'http://localhost:5000',
      }),
    });
    expect(minimal.platform).toBe('elevenlabs');
    expect(minimal.agentId).toBe('agent_xyz');
    expect(minimal.backendBaseUrl).toBe('http://localhost:5000');
    expect(minimal.rules.length).toBeGreaterThan(10);
    expect(minimal.immediateStart).toBe(false);
    expect(Object.keys(minimal).sort()).toEqual(
      [
        'agentId',
        'backendBaseUrl',
        'firstMessage',
        'immediateStart',
        'id',
        'llmEndpoint',
        'platform',
        'rules',
        'templateId',
        'type',
      ].sort()
    );
  });

  it('buildMinimalAiAgentCompileTask sets empty firstMessage when agentImmediateStart', () => {
    const minimal = buildMinimalAiAgentCompileTask({
      id: 'imm',
      type: 6,
      templateId: null,
      agentStructuredSectionsJson: '',
      agentPrompt: 'Hi.',
      agentImmediateStart: true,
    });
    expect(minimal.immediateStart).toBe(true);
    expect(minimal.firstMessage).toBe('');
  });

  it('buildMinimalAiAgentCompileTask fills convaiAgentId from global defaults when task EL override omits it', () => {
    mockLoadGlobalIa.mockReturnValue({
      ...getDefaultConfig('elevenlabs'),
      convaiAgentId: 'agent_from_global_defaults',
      elevenLabsBackendBaseUrl: 'http://global-api:5000',
    });
    const minimal = buildMinimalAiAgentCompileTask({
      id: 'agent-task-merge',
      type: 6,
      templateId: null,
      agentStructuredSectionsJson: '',
      agentPrompt: 'Test.',
      agentIaRuntimeOverrideJson: JSON.stringify({
        platform: 'elevenlabs',
        model: 'convai_default',
        temperature: 0.5,
        maxTokens: 1024,
        reasoning: 'none',
        systemPrompt: '',
        tools: [],
      }),
    });
    expect(minimal.platform).toBe('elevenlabs');
    expect(minimal.agentId).toBe('agent_from_global_defaults');
    expect(minimal.backendBaseUrl).toBe('http://global-api:5000');
  });

  it('buildMinimalAiAgentCompileTask adds ElevenLabs from global defaults when task has no IA override JSON', () => {
    mockLoadGlobalIa.mockReturnValue({
      ...getDefaultConfig('elevenlabs'),
      convaiAgentId: 'only_in_local_storage',
    });
    const minimal = buildMinimalAiAgentCompileTask({
      id: 'agent-global-only',
      type: 6,
      templateId: null,
      agentStructuredSectionsJson: '',
      agentPrompt: 'Hello.',
      agentIaRuntimeOverrideJson: '',
    });
    expect(minimal.platform).toBe('elevenlabs');
    expect(minimal.agentId).toBe('only_in_local_storage');
  });
});
