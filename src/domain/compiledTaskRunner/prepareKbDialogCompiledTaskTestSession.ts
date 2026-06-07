/**
 * Allinea sessione omnia_dialog_step prima del Test agente (compiled-task): patch agente EL + inject compile.
 */

import type { Task } from '@types/taskTypes';
import { newSessionConversationId } from '@domain/convai/newSessionConversationId';
import {
  isKbDeterministicDeployMode,
  normalizeAgentConvaiDeployMode,
} from '@domain/convai/agentConvaiDeployMode';
import { parseAgentElevenLabsConvaiLinkJson } from '@domain/convai/agentElevenLabsConvaiLink';
import {
  CONVAI_WEBHOOK_GATEWAY_PORT,
  ensureConvaiDeployTunnelReady,
} from '@domain/devTunnel/ensureConvaiDeployTunnelReady';
import { patchOmniaDialogStepSessionOnAgent } from '@utils/iaAgentRuntime/omniaDialogStepConvaiTool';

export type PrepareKbDialogCompiledTaskTestSessionResult = {
  compiledTask: Record<string, unknown>;
  sessionConversationId: string | null;
};

/**
 * Per deploy kb_deterministic: patch tool EL (conversationId enum) e `convaiSessionConversationId` nel payload VB.
 */
export async function prepareKbDialogCompiledTaskTestSession(params: {
  task: Task;
  projectId: string;
  compiledTask: Record<string, unknown>;
}): Promise<PrepareKbDialogCompiledTaskTestSessionResult> {
  const task = params.task;
  const projectId = String(params.projectId ?? '').trim();
  const agentTaskId = String(task?.id ?? '').trim();
  if (!isKbDeterministicDeployMode(normalizeAgentConvaiDeployMode(task.agentConvaiDeployMode))) {
    return { compiledTask: params.compiledTask, sessionConversationId: null };
  }
  if (!projectId || !agentTaskId) {
    throw new Error('Test agente KB: projectId o taskId mancante.');
  }

  const link = parseAgentElevenLabsConvaiLinkJson(String(task.agentElevenLabsConvaiLinkJson ?? ''));
  const agentId = String(link?.agentId ?? '').trim();
  if (!agentId) {
    throw new Error(
      'Test agente KB: esegui Deploy ConvAI prima del test (agente ElevenLabs non collegato al task).'
    );
  }

  const tunnel = await ensureConvaiDeployTunnelReady([CONVAI_WEBHOOK_GATEWAY_PORT]);
  if (!tunnel.ok) {
    throw new Error(tunnel.error || 'Tunnel ngrok non pronto per omnia_dialog_step (porta 3100).');
  }

  const sessionConversationId = newSessionConversationId();
  await patchOmniaDialogStepSessionOnAgent({
    agentId,
    sessionConversationId,
    projectId,
    agentTaskId,
  });

  return {
    compiledTask: {
      ...params.compiledTask,
      convaiSessionConversationId: sessionConversationId,
    },
    sessionConversationId,
  };
}
