import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskType, type Task } from '@types/taskTypes';
import {
  analyzeLocalhostEndpointReachability,
  saveDevTunnelPortMapToStorage,
} from '@domain/devTunnel/devTunnelCompileBridge';
import {
  collectConvaiWebhookTunnelReadinessForSync,
  buildConvaiWebhookUrlPreviewRows,
  prepareConvaiWebhookToolForElevenLabsApi,
} from '../prepareConvaiWebhookToolForElevenLabsApi';

beforeEach(() => {
  const map = new Map<string, string>();
  vi.stubGlobal(
    'localStorage',
    {
      getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
      clear: () => map.clear(),
      length: 0,
      key: () => null,
    } as Storage
  );
});

function backendTask(partial: Partial<Task> & { id: string }): Task {
  return {
    type: TaskType.BackendCall,
    label: partial.label ?? 'api',
    backendToolDescription: partial.backendToolDescription ?? 'desc',
    endpoint: { url: 'https://api.example.com/slots', method: 'POST', headers: {} },
    inputs: [],
    outputs: [],
    ...partial,
  } as Task;
}

describe('prepareConvaiWebhookToolForElevenLabsApi', () => {
  it('blocks sync when gateway localhost:3100 has no tunnel', () => {
    const task = backendTask({ id: 'bk1' });
    const out = prepareConvaiWebhookToolForElevenLabsApi({
      backendTask: task,
      projectId: 'proj-1',
      agentTaskId: 'agent-1',
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error).toMatch(/3100/);
    expect(out.missingPorts).toEqual([3100]);
  });

  it('rewrites gateway URL with ngrok when tunnel map has port 3100', () => {
    saveDevTunnelPortMapToStorage({ 3100: 'https://abc.ngrok-free.app' });
    const task = backendTask({ id: 'bk1' });
    const out = prepareConvaiWebhookToolForElevenLabsApi({
      backendTask: task,
      projectId: 'proj-1',
      agentTaskId: 'agent-1',
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.publicUrl).toBe(
      'https://abc.ngrok-free.app/api/runtime/convai-webhook/proj-1/agent-1/bk1'
    );
    expect((out.tool.api_schema as { url: string }).url).toBe(out.publicUrl);
  });

  it('useDevTunnel false keeps localhost gateway URL without reachability block', () => {
    const task = backendTask({ id: 'bk1' });
    const out = prepareConvaiWebhookToolForElevenLabsApi({
      backendTask: task,
      projectId: 'proj-1',
      agentTaskId: 'agent-1',
      useDevTunnel: false,
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.publicUrl).toContain('localhost:3100');
    expect(out.publicUrl).toContain('/api/runtime/convai-webhook/proj-1/agent-1/bk1');
  });

  it('collectConvaiWebhookTunnelReadinessForSync reports errors for missing projectId', () => {
    const agentTask = {
      id: 'agent-1',
      type: TaskType.AIAgent,
      agentIaRuntimeOverrideJson: JSON.stringify({
        platform: 'elevenlabs',
        convaiBackendToolTaskIds: ['bk1'],
      }),
    } as Task;
    const readiness = collectConvaiWebhookTunnelReadinessForSync(
      { agentTask, manualCatalogBackendTaskIds: [] },
      (id) => (id === 'bk1' ? backendTask({ id: 'bk1' }) : null)
    );
    expect(readiness.ready).toBe(false);
    expect(readiness.errors[0]).toMatch(/ProjectId mancante/i);
  });

  it('buildConvaiWebhookUrlPreviewRows returns gateway URL even without tunnel', () => {
    const agentTask = {
      id: 'agent-1',
      type: TaskType.AIAgent,
      agentIaRuntimeOverrideJson: JSON.stringify({
        platform: 'elevenlabs',
        convaiBackendToolTaskIds: ['bk1'],
      }),
    } as Task;
    const rows = buildConvaiWebhookUrlPreviewRows(
      {
        agentTask,
        projectId: 'proj-1',
        manualCatalogBackendTaskIds: [],
        catalogLabelsByBackendId: { bk1: 'next-window' },
      },
      (id) => (id === 'bk1' ? backendTask({ id: 'bk1', label: 'next-window' }) : null)
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('next-window');
    expect(rows[0].webhookUrl).toContain('/api/runtime/convai-webhook/proj-1/agent-1/bk1');
    expect(rows[0].reachable).toBe(false);
  });
});

describe('analyzeLocalhostEndpointReachability', () => {
  it('accepts public URLs without tunnel map', () => {
    expect(analyzeLocalhostEndpointReachability('https://api.example.com/x').unreachable).toBe(false);
  });

  it('flags localhost without mapped tunnel', () => {
    const reach = analyzeLocalhostEndpointReachability('http://localhost:3100/ping');
    expect(reach.unreachable).toBe(true);
    expect(reach.missingPorts).toEqual([3100]);
  });
});

describe('collectConvaiWebhookTunnelReadinessForSync — kb_deterministic', () => {
  const kbAgentTask = {
    id: 'agent-1',
    type: TaskType.AIAgent,
    agentConvaiDeployMode: 'kb_deterministic',
    agentIaRuntimeOverrideJson: JSON.stringify({ platform: 'elevenlabs' }),
  } as Task;

  it('requires tunnel on 3100 for omnia_dialog_step when no backend tools', () => {
    const out = collectConvaiWebhookTunnelReadinessForSync({
      agentTask: kbAgentTask,
      projectId: 'proj-1',
      manualCatalogBackendTaskIds: [],
    });
    expect(out.ready).toBe(false);
    expect(out.errors[0]).toMatch(/omnia_dialog_step/);
    expect(out.errors[0]).toMatch(/3100/);
  });

  it('accepts omnia_dialog_step when tunnel map has port 3100', () => {
    saveDevTunnelPortMapToStorage({ 3100: 'https://abc.ngrok-free.app' });
    const out = collectConvaiWebhookTunnelReadinessForSync({
      agentTask: kbAgentTask,
      projectId: 'proj-1',
      manualCatalogBackendTaskIds: [],
    });
    expect(out.ready).toBe(true);
    expect(out.publicUrlsByBackendId.omnia_dialog_step).toBe(
      'https://abc.ngrok-free.app/api/runtime/omnia-dialog-step/proj-1/agent-1'
    );
  });
});
