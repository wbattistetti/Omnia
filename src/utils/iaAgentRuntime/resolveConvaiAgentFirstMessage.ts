/**
 * Risolve `conversation_config.agent.first_message` per sync/provision ConvAI.
 */

import {
  isKbDeterministicDeployMode,
  normalizeAgentConvaiDeployMode,
  type AgentConvaiDeployMode,
} from '@domain/convai/agentConvaiDeployMode';
import {
  parseAgentStartPromptJson,
  resolveAgentStartPromptSpeechText,
} from '@domain/useCaseGeneratorWizard/agentStartPrompt';
import { resolveStartUseCaseSpeechText } from '@domain/useCaseGeneratorWizard/startUseCase';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { CONVAI_DEFAULT_FIRST_MESSAGE } from './convaiAgentCreatePayload';

export function resolveConvaiAgentFirstMessage(params: {
  agentImmediateStart?: boolean;
  startUseCaseId?: string | null;
  agentStartPromptJson?: string | null;
  useCases?: readonly AIAgentUseCase[];
  /** Deploy deterministico: first_message vuoto — prima frase da omnia_dialog_step. */
  agentConvaiDeployMode?: AgentConvaiDeployMode | string | null;
}): string {
  if (isKbDeterministicDeployMode(normalizeAgentConvaiDeployMode(params.agentConvaiDeployMode))) {
    return '';
  }
  if (params.agentImmediateStart === true) {
    return '';
  }
  const startId = String(params.startUseCaseId ?? '').trim();
  if (startId && params.useCases && params.useCases.length > 0) {
    const fromStartUc = resolveStartUseCaseSpeechText(params.useCases, startId);
    if (fromStartUc) return fromStartUc;
  }
  const fromStartPrompt = resolveAgentStartPromptSpeechText(
    parseAgentStartPromptJson(params.agentStartPromptJson ?? '')
  );
  if (fromStartPrompt) return fromStartPrompt;
  return CONVAI_DEFAULT_FIRST_MESSAGE;
}
