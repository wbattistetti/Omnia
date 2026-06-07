/**
 * Risolve la frase di apertura statica (ConvAI `first_message` / incipit Test agente).
 * Nessuna compilazione slot al turno 0: testo naturale o start prompt JSON.
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
import { resolveStartUseCaseOpeningSpeechText } from '@domain/useCaseGeneratorWizard/startUseCase';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { CONVAI_DEFAULT_FIRST_MESSAGE } from '@utils/iaAgentRuntime/convaiAgentCreatePayload';

export type ResolveAgentOpeningMessageParams = {
  agentImmediateStart?: boolean;
  startUseCaseId?: string | null;
  agentStartPromptJson?: string | null;
  useCases?: readonly AIAgentUseCase[];
  agentConvaiDeployMode?: AgentConvaiDeployMode | string | null;
  /** Se true, usa fallback generico quando non c'è opener esplicito (legacy non-kb). */
  allowDefaultFallback?: boolean;
};

/** Frase statica configurata esplicitamente (start prompt JSON o UC Start naturale). */
export function resolveExplicitAgentOpeningMessage(
  params: Pick<
    ResolveAgentOpeningMessageParams,
    'startUseCaseId' | 'agentStartPromptJson' | 'useCases'
  >
): string {
  const fromStartPrompt = resolveAgentStartPromptSpeechText(
    parseAgentStartPromptJson(params.agentStartPromptJson ?? '')
  );
  if (fromStartPrompt.trim()) return fromStartPrompt.trim();

  const startId = String(params.startUseCaseId ?? '').trim();
  if (startId && params.useCases && params.useCases.length > 0) {
    const fromStartUc = resolveStartUseCaseOpeningSpeechText(params.useCases, startId);
    if (fromStartUc.trim()) return fromStartUc.trim();
  }

  return '';
}

/**
 * ConvAI `first_message` / opener runtime Test agente.
 * - kb_deterministic: sempre vuoto — la prima domanda slot arriva da `omnia_dialog_step` (bootstrap turno 0).
 * - Legacy: start prompt JSON → UC Start → default.
 * - immediateStart (legacy): vuoto se non c'è opener esplicito (turno sintetico VB).
 */
export function resolveAgentOpeningMessage(params: ResolveAgentOpeningMessageParams): string {
  const kbDet = isKbDeterministicDeployMode(
    normalizeAgentConvaiDeployMode(params.agentConvaiDeployMode)
  );
  if (kbDet) {
    return '';
  }

  const explicit = resolveExplicitAgentOpeningMessage(params);
  if (explicit) return explicit;

  if (params.agentImmediateStart === true) {
    return '';
  }

  if (params.allowDefaultFallback === false) return '';
  return CONVAI_DEFAULT_FIRST_MESSAGE;
}
