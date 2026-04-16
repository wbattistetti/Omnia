/**
 * Canonical data model for replayable/regression-ready use cases.
 */
export type UseCase = {
  id: string;
  key: string;
  label: string;
  note?: string;
  steps: UseCaseStep[];
};

/**
 * One deterministic replay step.
 */
export type UseCaseStep = {
  userUtterance: string;
  semanticValue: string;
  linguisticValue: string;
  grammarUsed: {
    type: string;
    contract: string;
  };
  botResponse: string;
  botResponsePlaceholders?: Record<string, string>;
};

/**
 * Runtime observation for a single replay step.
 */
export type UseCaseObservedStep = {
  semanticValue: string;
  linguisticValue: string;
  grammarUsed: {
    type: string;
    contract: string;
  };
  botResponse: string;
};

/**
 * Detailed field-level diff for one step.
 */
export type UseCaseStepDiff = {
  changed: boolean;
  semanticValue: { changed: boolean; expected: string; actual: string };
  linguisticValue: { changed: boolean; expected: string; actual: string };
  grammarType: { changed: boolean; expected: string; actual: string };
  grammarContract: { changed: boolean; expected: string; actual: string };
  botResponse: { changed: boolean; expected: string; actual: string };
};

/**
 * Replay result row used by result UI.
 */
export type UseCaseRunResult = {
  stepIndex: number;
  utterance: string;
  expected: UseCaseStep;
  actual: UseCaseObservedStep;
  diff: UseCaseStepDiff;
  ok: boolean;
};

/**
 * Runtime bridge contract used by runner.
 */
export interface UseCaseRuntimePort {
  /**
   * Resets the runtime conversation/session.
   */
  restart(): Promise<void>;
  /**
   * Sends one utterance and resolves to observed runtime values.
   */
  executeUtterance(utterance: string): Promise<UseCaseObservedStep>;
}

