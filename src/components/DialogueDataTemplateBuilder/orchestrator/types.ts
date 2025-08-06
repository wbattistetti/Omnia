// Tipi condivisi per l'orchestratore DDT step-by-step

export type DDTGenerationStep =
  | 'recognizeType'
  | 'structure'
  | 'constraints'
  | 'scripts'
  | 'messages'
  | 'assemble'
  | 'done'
  | 'error';

export interface DDTOrchestratorState {
  step: DDTGenerationStep;
  structure?: any;
  constraints?: any[];
  scripts?: { [constraintId: string]: any };
  messages?: Record<string, string>;
  finalDDT?: any;
  error?: string;
  recognizedType?: string;
  recognizedIcon?: string;
  isCustom?: boolean;
  confirmedType?: string;
  isOffline?: boolean;
  lastUserDesc?: string;
  lastDesc?: string;
}

export interface OrchestratorStep {
  name: string;
  status: 'pending' | 'success' | 'error';
  error?: string;
  retry: () => Promise<void>;
}

// Nuovi tipi per orchestratore step-by-step
export type StepType =
  | 'detectType'
  | 'createFor'
  | 'suggestStructureAndConstraints'
  | 'suggestConstraints'
  | 'startPrompt'
  | 'startPrompts'
  | 'noMatchPrompts'
  | 'noInputPrompts'
  | 'confirmationPrompts'
  | 'successPrompts'
  | 'validationRules'
  | 'constraintScript'
  | 'constraintTestSet'
  | 'constraintMessages';

export interface Step {
  key: string; // es: "IsPEC Script"
  label: string;
  payoff: string;
  type: StepType | string; // string per step dinamici
  run: () => Promise<StepResult>;
  constraintIdeId?: string;
  subDataInfo?: any; // Informazioni del subData per step specifici
  subDataIndex?: number; // Indice del subData
}

export interface StepResult {
  stepKey: string;
  payload: any;
  translations?: Record<string, string>;
}

export interface OrchestratorState {
  steps: Step[];
  currentStepIndex: number;
  stepError: boolean;
  stepLoading: boolean;
  stepResults: StepResult[];
  lastError?: Error;
}

export type Translations = Record<string, string>; 