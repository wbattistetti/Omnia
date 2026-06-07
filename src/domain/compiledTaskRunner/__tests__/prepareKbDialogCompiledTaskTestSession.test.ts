import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Task } from '@types/taskTypes';
import { TaskType } from '@types/taskTypes';
import { prepareKbDialogCompiledTaskTestSession } from '../prepareKbDialogCompiledTaskTestSession';

vi.mock('@domain/devTunnel/ensureConvaiDeployTunnelReady', () => ({
  CONVAI_WEBHOOK_GATEWAY_PORT: 3100,
  ensureConvaiDeployTunnelReady: vi.fn(async () => ({ ok: true, error: '' })),
}));

vi.mock('@utils/iaAgentRuntime/omniaDialogStepConvaiTool', () => ({
  patchOmniaDialogStepSessionOnAgent: vi.fn(async () => undefined),
}));

describe('prepareKbDialogCompiledTaskTestSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips patch for legacy deploy mode', async () => {
    const task = {
      id: 'agent-1',
      type: TaskType.AIAgent,
      agentConvaiDeployMode: 'legacy',
    } as Task;
    const compiledTask = { id: 'agent-1' };
    const out = await prepareKbDialogCompiledTaskTestSession({
      task,
      projectId: 'proj-1',
      compiledTask,
    });
    expect(out.sessionConversationId).toBeNull();
    expect(out.compiledTask).toEqual(compiledTask);
  });

  it('patches agent and injects convaiSessionConversationId for kb_deterministic', async () => {
    const { patchOmniaDialogStepSessionOnAgent } = await import(
      '@utils/iaAgentRuntime/omniaDialogStepConvaiTool'
    );
    const task = {
      id: 'agent-1',
      type: TaskType.AIAgent,
      agentConvaiDeployMode: 'kb_deterministic',
      agentElevenLabsConvaiLinkJson: JSON.stringify({ schemaVersion: 1, agentId: 'el-agent-1' }),
    } as Task;
    const out = await prepareKbDialogCompiledTaskTestSession({
      task,
      projectId: 'proj-1',
      compiledTask: { id: 'agent-1' },
    });
    expect(out.sessionConversationId).toMatch(/^omnia_conv_/);
    expect(out.compiledTask.convaiSessionConversationId).toBe(out.sessionConversationId);
    expect(patchOmniaDialogStepSessionOnAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 'el-agent-1',
        projectId: 'proj-1',
        agentTaskId: 'agent-1',
        sessionConversationId: out.sessionConversationId,
      })
    );
  });

  it('throws when kb_deterministic without deployed agent link', async () => {
    const task = {
      id: 'agent-1',
      type: TaskType.AIAgent,
      agentConvaiDeployMode: 'kb_deterministic',
    } as Task;
    await expect(
      prepareKbDialogCompiledTaskTestSession({
        task,
        projectId: 'proj-1',
        compiledTask: { id: 'agent-1' },
      })
    ).rejects.toThrow(/Deploy ConvAI/);
  });
});
