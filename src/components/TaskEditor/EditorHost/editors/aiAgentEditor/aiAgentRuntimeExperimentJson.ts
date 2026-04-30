/**
 * Read-only JSON preview for Prompt finale (same shape as compile payload).
 */

import { CONVAI_DEFAULT_FIRST_MESSAGE } from '@utils/iaAgentRuntime/convaiAgentCreatePayload';
import { defaultAiAgentLlmEndpoint } from './composeRuntimeRulesFromCompact';

export type AiAgentExperimentExampleTurn = { role: 'assistant' | 'user'; content: string };

/** Synthetic user turn when «Avvio immediato» is on (orchestrator aligns with VB). */
export const AI_AGENT_IMMEDIATE_START_SYNTHETIC_USER_MESSAGE = 'start';

export interface AiAgentRuntimeExperimentPayload {
  compileInput: {
    taskType: 'AIAgent';
    rules: string;
    llmEndpoint: string;
    first_message: string;
    immediateStart: boolean;
  };
  runtimeStepPayload: {
    state: Record<string, unknown> & { examples?: AiAgentExperimentExampleTurn[] };
    user_message: string;
  };
}

export function buildAiAgentRuntimeExperimentPayload(
  rules: string,
  parsedInitialState: Record<string, unknown>,
  previewExamples: AiAgentExperimentExampleTurn[],
  options?: { immediateStart?: boolean }
): AiAgentRuntimeExperimentPayload {
  const immediateStart = options?.immediateStart === true;
  return {
    compileInput: {
      taskType: 'AIAgent',
      rules,
      llmEndpoint: defaultAiAgentLlmEndpoint(),
      first_message: immediateStart ? '' : CONVAI_DEFAULT_FIRST_MESSAGE,
      immediateStart,
    },
    runtimeStepPayload: {
      state: {
        ...parsedInitialState,
        examples: previewExamples,
      },
      user_message: immediateStart ? AI_AGENT_IMMEDIATE_START_SYNTHETIC_USER_MESSAGE : '',
    },
  };
}

export function stringifyExperimentPayload(p: AiAgentRuntimeExperimentPayload): string {
  return JSON.stringify(p, null, 2);
}
