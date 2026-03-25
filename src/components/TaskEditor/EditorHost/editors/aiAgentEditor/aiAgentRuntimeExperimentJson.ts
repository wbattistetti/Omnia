/**
 * Read-only JSON preview for Prompt finale (same shape as compile payload).
 */

import { defaultAiAgentLlmEndpoint } from './composeRuntimeRulesFromCompact';

export type AiAgentExperimentExampleTurn = { role: 'assistant' | 'user'; content: string };

export interface AiAgentRuntimeExperimentPayload {
  compileInput: {
    taskType: 'AIAgent';
    rules: string;
    llmEndpoint: string;
  };
  runtimeStepPayload: {
    state: Record<string, unknown> & { examples?: AiAgentExperimentExampleTurn[] };
    user_message: string;
  };
}

export function buildAiAgentRuntimeExperimentPayload(
  rules: string,
  parsedInitialState: Record<string, unknown>,
  previewExamples: AiAgentExperimentExampleTurn[]
): AiAgentRuntimeExperimentPayload {
  return {
    compileInput: {
      taskType: 'AIAgent',
      rules,
      llmEndpoint: defaultAiAgentLlmEndpoint(),
    },
    runtimeStepPayload: {
      state: {
        ...parsedInitialState,
        examples: previewExamples,
      },
      user_message: '',
    },
  };
}

export function stringifyExperimentPayload(p: AiAgentRuntimeExperimentPayload): string {
  return JSON.stringify(p, null, 2);
}

export { buildDistilledRulesString, buildRichRulesString } from './composeRuntimeRulesFromCompact';
