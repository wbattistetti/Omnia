/**
 * Risolve `conversation_config.agent.first_message` per sync/provision ConvAI.
 */

import { resolveAgentOpeningMessage } from '@domain/convai/resolveAgentOpeningMessage';
import type { AgentConvaiDeployMode } from '@domain/convai/agentConvaiDeployMode';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';

export function resolveConvaiAgentFirstMessage(params: {
  agentImmediateStart?: boolean;
  startUseCaseId?: string | null;
  agentStartPromptJson?: string | null;
  useCases?: readonly AIAgentUseCase[];
  agentConvaiDeployMode?: AgentConvaiDeployMode | string | null;
}): string {
  return resolveAgentOpeningMessage({
    ...params,
    allowDefaultFallback: true,
  });
}
