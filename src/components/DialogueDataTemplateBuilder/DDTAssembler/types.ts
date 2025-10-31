// Types and constants for DDTAssembler StepBuilder

export type ActionParameter = {
  parameterId: string;
  value: string; // key in translations
};

export type Action = {
  actionId: string;
  actionInstanceId: string;
  parameters: ActionParameter[];
};

export type Escalation = {
  escalationId: string;
  actions: Action[];
};

export type StepGroup = {
  type: 'start' | 'noMatch' | 'noInput' | 'confirmation' | 'success' | 'introduction';
  escalations: Escalation[];
};

export const KNOWN_ACTIONS = {
  askQuestion: { defaultParameter: 'text' },
  sayMessage: { defaultParameter: 'text' }
  // ... altri tipi se servono
};