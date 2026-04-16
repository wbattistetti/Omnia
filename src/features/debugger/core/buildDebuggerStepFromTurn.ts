/**
 * Builds a DebuggerStep from one user turn + bot reply metadata (pure, testable).
 */
import { createStepId, type DebuggerStep } from './DebuggerStep';

export type TurnBuildInput = {
  utterance: string;
  /** From user message extractedValues */
  semanticValue: string;
  linguisticValue: string;
  /** Winning grammar line */
  grammarType: string;
  grammarContract: string;
  elapsedMs: number;
  /** Label for NLU tree “slot” row (e.g. flow node label). */
  slotLabel?: string;
  /** Flow node id for the row that was waiting (best-effort). */
  activeNodeId: string;
  /** Nodes completed before this step */
  priorPassedNodeIds: string[];
  noMatchNodeIds: string[];
  activeEdgeId: string;
  botResponse?: string;
  botResponsePlaceholders?: Record<string, string>;
  variables?: Record<string, unknown>;
  /** Messaggio chat collegato (stesso ordine dei turni utente). */
  clientMessageId?: string;
};

export function buildDebuggerStepFromTurn(input: TurnBuildInput): DebuggerStep {
  const passed = new Set(input.priorPassedNodeIds);
  if (input.activeNodeId && !input.noMatchNodeIds.includes(input.activeNodeId)) {
    passed.add(input.activeNodeId);
  }

  return {
    id: createStepId(),
    clientMessageId: input.clientMessageId,
    utterance: input.utterance,
    semanticValue: input.semanticValue,
    linguisticValue: input.linguisticValue,
    grammar: {
      type: input.grammarType,
      contract: input.grammarContract,
      elapsedMs: input.elapsedMs,
    },
    slotLabel: input.slotLabel,
    activeNodeId: input.activeNodeId,
    passedNodeIds: [...passed],
    noMatchNodeIds: [...input.noMatchNodeIds],
    activeEdgeId: input.activeEdgeId,
    botResponse: input.botResponse,
    botResponsePlaceholders: input.botResponsePlaceholders,
    variables: input.variables,
  };
}
