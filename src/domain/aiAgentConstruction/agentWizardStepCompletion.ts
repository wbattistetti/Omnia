/**
 * AI Agent — Regole di completamento per gli step del wizard (7 fasi).
 */

import type { AgentWizardStepIndex } from './agentConstructionPhase';
import { AGENT_WIZARD_STEP_COUNT } from './agentConstructionPhase';

export interface AgentWizardCompletionInput {
  readonly descriptionTrimmed: string;
  readonly useCaseCount: number;
  readonly conversationCount: number;
  readonly knowledgeBaseDocumentCount?: number;
}

export function isStepTaskComplete(input: AgentWizardCompletionInput): boolean {
  return input.descriptionTrimmed.length > 0;
}

export function isStepKnowledgeBaseComplete(_input: AgentWizardCompletionInput): boolean {
  return true;
}

export function isStepBackendComplete(_input: AgentWizardCompletionInput): boolean {
  return true;
}

export function isStepPromptsComplete(input: AgentWizardCompletionInput): boolean {
  return input.useCaseCount >= 1 && input.conversationCount >= 1;
}

export function isStepErrorHandlingComplete(_input: AgentWizardCompletionInput): boolean {
  return true;
}

export function isStepDatiComplete(_input: AgentWizardCompletionInput): boolean {
  return true;
}

export function isStepVoceComplete(_input: AgentWizardCompletionInput): boolean {
  return true;
}

/** 0 Task, 1 KB, 2 Backend, 3 Prompts, 4 Error Handling, 5 Dati, 6 Voce */
const STEP_COMPLETION_RULES: ReadonlyArray<(input: AgentWizardCompletionInput) => boolean> = [
  isStepTaskComplete,
  isStepKnowledgeBaseComplete,
  isStepBackendComplete,
  isStepPromptsComplete,
  isStepErrorHandlingComplete,
  isStepDatiComplete,
  isStepVoceComplete,
];

export function evaluateAgentWizardCompletion(
  input: AgentWizardCompletionInput
): readonly boolean[] {
  return STEP_COMPLETION_RULES.map((rule) => rule(input));
}

export function areAllAgentWizardStepsComplete(input: AgentWizardCompletionInput): boolean {
  return evaluateAgentWizardCompletion(input).every(Boolean);
}

export function nextIncompleteAgentWizardStep(
  input: AgentWizardCompletionInput
): AgentWizardStepIndex {
  const flags = evaluateAgentWizardCompletion(input);
  for (let i = 0; i < AGENT_WIZARD_STEP_COUNT; i++) {
    if (!flags[i]) return i as AgentWizardStepIndex;
  }
  return AGENT_WIZARD_STEP_COUNT - 1;
}
