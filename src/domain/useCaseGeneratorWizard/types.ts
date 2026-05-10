/**
 * Types for the guided use-case generator wizard (pipeline UI + dirty baselines per step).
 */

/** Five steps after merging «creazione» and «validazione» use case into one editor phase. */
export type UseCaseGeneratorWizardStepId =
  | 'use_case_list'
  | 'example_phrases'
  | 'conversations'
  | 'tokenization'
  | 'json_generation';

/** Simulated multi-use-case conversation (design-time wizard). */
export interface UseCaseGeneratorWizardTurnUser {
  role: 'user';
  text: string;
}

export interface UseCaseGeneratorWizardTurnAgent {
  role: 'agent';
  useCaseId: string;
  text: string;
}

export type UseCaseGeneratorWizardTurn =
  | UseCaseGeneratorWizardTurnUser
  | UseCaseGeneratorWizardTurnAgent;

export interface UseCaseGeneratorWizardConversation {
  conversationId: string;
  turns: UseCaseGeneratorWizardTurn[];
}

export interface UseCaseGeneratorWizardPersistedState {
  /** Default true: modalità guidata sempre disponibile nel view generator. */
  enabled?: boolean;
  stepIndex: number;
  /** Massimo indice passo (0–4) selezionabile nella pipeline. */
  unlockedMaxStepIndex?: number;
}
