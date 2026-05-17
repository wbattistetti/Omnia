/**
 * ElevenLabs ConvAI workspace provider implementation.
 */

import type { WorkspaceProvider, ListRemoteAgentsResult } from '../core/WorkspaceProvider';
import { remoteAgentRef } from '../core/WorkspaceProvider';
import type { RemoteAgentRef, WorkspaceAgentSnapshot } from '../core/types';
import { extractConvaiAgentSettings } from './extractConvaiAgentSettings';
import {
  extractGlobalPromptFromConversationConfig,
  parseConvaiWorkflowFromConversationConfig,
} from './parseConvaiWorkflow';
import {
  getConvaiAgentDetail,
  listConvaiAgentsForWorkspace,
  patchConvaiAgent,
} from './api/convaiAgentApi';
import { buildAgentToolInventory, emptyToolInventory } from './buildAgentToolInventory';

export const ELEVENLABS_WORKSPACE_PROVIDER_ID = 'elevenlabs' as const;

export class ElevenLabsWorkspaceProvider implements WorkspaceProvider {
  readonly id = ELEVENLABS_WORKSPACE_PROVIDER_ID;
  readonly displayName = 'ElevenLabs';

  async listAgents(params?: {
    pageSize?: number;
    cursor?: string | null;
    search?: string | null;
  }): Promise<ListRemoteAgentsResult> {
    return listConvaiAgentsForWorkspace(params);
  }

  async getAgent(ref: RemoteAgentRef): Promise<WorkspaceAgentSnapshot> {
    const detail = await getConvaiAgentDetail(ref.agentId);
    const globalPrompt = extractGlobalPromptFromConversationConfig(detail.conversationConfig);
    const workflow = parseConvaiWorkflowFromConversationConfig(
      detail.conversationConfig,
      globalPrompt
    );
    const settings = extractConvaiAgentSettings(detail.conversationConfig, detail.raw?.workflow);
    let toolInventory = emptyToolInventory();
    try {
      toolInventory = await buildAgentToolInventory(detail.conversationConfig, workflow);
    } catch {
      toolInventory = emptyToolInventory();
    }
    return {
      ref: remoteAgentRef(this.id, detail.agentId, detail.name || ref.name),
      rawConversationConfig: detail.conversationConfig,
      workflow,
      globalPrompt: globalPrompt || undefined,
      settings,
      toolInventory,
    };
  }

  async patchAgent(ref: RemoteAgentRef, body: Record<string, unknown>): Promise<void> {
    await patchConvaiAgent(ref.agentId, body);
  }
}
