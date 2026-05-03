/**
 * ConvAI backend tool derivation → codici errore compile (mock {@link taskRepository}).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TaskType } from '@types/taskTypes';

const getTask = vi.fn();
vi.mock('@services/TaskRepository', () => ({
  taskRepository: { getTask: (...args: unknown[]) => getTask(...args) },
}));

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

import { collectIaAgentRuntimeCompileErrors } from '../collectIaAgentRuntimeCompileErrors';

function elevenLabsOverrideJson(extra: Record<string, unknown>): string {
  return JSON.stringify({
    platform: 'elevenlabs',
    convaiAgentId: 'ag_xyz',
    voices: [{ id: 'voice_1', role: 'primary' }],
    voice: { id: 'voice_1', language: 'it-IT' },
    advanced: {
      llm: { model: 'gpt-4o-mini', temperature: 0.5, max_tokens: 4096 },
    },
    ...extra,
  });
}

describe('collectIaAgentRuntimeCompileErrors — ConvAI backend tools', () => {
  beforeEach(() => {
    getTask.mockReset();
  });

  it('emits IaConvaiBackendToolMissingDescription when label ok but ConvAI description missing', () => {
    getTask.mockImplementation((id: string) =>
      id === 'bk1'
        ? ({
            id: 'bk1',
            type: TaskType.BackendCall,
            label: 'Prenota',
            endpoint: { url: 'https://api.test/x', method: 'GET', headers: {} },
            inputs: [],
            outputs: [],
          } as Record<string, unknown>)
        : null
    );

    const raw = collectIaAgentRuntimeCompileErrors(
      [
        {
          id: 'agent1',
          type: TaskType.AIAgent,
          agentIaRuntimeOverrideJson: elevenLabsOverrideJson({
            convaiBackendToolTaskIds: ['bk1'],
          }),
        },
      ],
      new Map([['agent1', { rowId: 'agent1', flowId: 'main', nodeId: 'n1' }]]),
      'main'
    );

    expect(raw.some((e) => e.code === 'IaConvaiBackendToolMissingDescription')).toBe(true);
    expect(raw.some((e) => e.code === 'IaConvaiBackendToolMissingLabel')).toBe(false);
  });

  it('emits IaConvaiBackendToolMissingLabel when backendToolDescription ok but label missing', () => {
    getTask.mockImplementation((id: string) =>
      id === 'bk2'
        ? ({
            id: 'bk2',
            type: TaskType.BackendCall,
            label: '',
            backendToolDescription: 'Fa qualcosa.',
            endpoint: { url: 'https://api.test/y', method: 'GET', headers: {} },
            inputs: [],
            outputs: [],
          } as Record<string, unknown>)
        : null
    );

    const raw = collectIaAgentRuntimeCompileErrors(
      [
        {
          id: 'agent1',
          type: TaskType.AIAgent,
          agentIaRuntimeOverrideJson: elevenLabsOverrideJson({
            convaiBackendToolTaskIds: ['bk2'],
          }),
        },
      ],
      new Map([['agent1', { rowId: 'agent1', flowId: 'main', nodeId: 'n1' }]]),
      'main'
    );

    expect(raw.some((e) => e.code === 'IaConvaiBackendToolMissingLabel')).toBe(true);
  });

  it('emits IaConvaiBackendToolIdsEmpty when flow has reachable BackendCall but no ids selected', () => {
    getTask.mockImplementation((id: string) =>
      id === 'bkReach'
        ? ({
            id: 'bkReach',
            type: TaskType.BackendCall,
            label: 'B',
            backendToolDescription: 'D',
            endpoint: { url: 'https://z/', method: 'GET', headers: {} },
            inputs: [],
            outputs: [],
          } as Record<string, unknown>)
        : null
    );

    const flowsByFlowId = {
      main: {
        nodes: [
          { id: 'n1', data: { rows: [{ id: 'agent1' }] } },
          { id: 'n2', data: { rows: [{ id: 'bkReach' }] } },
        ],
        edges: [{ source: 'n1', target: 'n2' }],
      },
    };

    const raw = collectIaAgentRuntimeCompileErrors(
      [
        {
          id: 'agent1',
          type: TaskType.AIAgent,
          agentIaRuntimeOverrideJson: elevenLabsOverrideJson({
            convaiBackendToolTaskIds: [],
          }),
        },
      ],
      new Map([['agent1', { rowId: 'agent1', flowId: 'main', nodeId: 'n1' }]]),
      'main',
      { flowsByFlowId }
    );

    expect(raw.some((e) => e.code === 'IaConvaiBackendToolIdsEmpty')).toBe(true);
  });

});
