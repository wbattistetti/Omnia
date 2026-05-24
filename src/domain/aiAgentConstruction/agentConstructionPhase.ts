/**
 * AI Agent — Phase machine di alto livello del Task Editor.
 *
 * Wizard 7 step (ordine vincolante mag 2026):
 *   0 Task → 1 Knowledge Base → 2 Backend → 3 Prompts → 4 Error Handling → 5 Dati → 6 Voce
 */

export type AgentConstructionPhase = 'wizard' | 'edit';

/** Indici 0-based dei 7 step del Construction Wizard. */
export type AgentWizardStepIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const AGENT_WIZARD_STEP_COUNT = 7 as const;

export const AGENT_WIZARD_FIRST_STEP_INDEX: AgentWizardStepIndex = 0;

export const AGENT_WIZARD_LAST_STEP_INDEX: AgentWizardStepIndex = 6;

/** Versione ordine step persistita su task (2 = wizard a 7 fasi). */
export const AGENT_WIZARD_STEP_ORDER_VERSION = 2 as const;

/** Migrazione indici wizard legacy (5 step) → ordine attuale (7 step). */
const LEGACY_5_STEP_TO_7: Readonly<Record<number, AgentWizardStepIndex>> = {
  0: 0,
  1: 3,
  2: 2,
  3: 5,
  4: 6,
};

export function isAgentWizardStepIndex(value: unknown): value is AgentWizardStepIndex {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= AGENT_WIZARD_LAST_STEP_INDEX
  );
}

export function isAgentConstructionPhase(value: unknown): value is AgentConstructionPhase {
  return value === 'wizard' || value === 'edit';
}

export function resolveAgentConstructionPhase(
  persistedPhase: unknown,
  hasAgentGeneration: boolean
): AgentConstructionPhase {
  if (isAgentConstructionPhase(persistedPhase)) {
    return persistedPhase;
  }
  return hasAgentGeneration ? 'edit' : 'wizard';
}

/**
 * Risolve l'indice step corrente con migrazione da ordine legacy (5 step).
 */
export function resolveAgentWizardCurrentStep(
  persistedStep: unknown,
  persistedStepOrderVersion: unknown = 1
): AgentWizardStepIndex {
  const version =
    persistedStepOrderVersion === AGENT_WIZARD_STEP_ORDER_VERSION
      ? AGENT_WIZARD_STEP_ORDER_VERSION
      : 1;

  if (typeof persistedStep !== 'number' || !Number.isInteger(persistedStep)) {
    return AGENT_WIZARD_FIRST_STEP_INDEX;
  }

  if (version === AGENT_WIZARD_STEP_ORDER_VERSION && isAgentWizardStepIndex(persistedStep)) {
    return persistedStep;
  }

  if (persistedStep >= 0 && persistedStep <= 4) {
    return LEGACY_5_STEP_TO_7[persistedStep] ?? AGENT_WIZARD_FIRST_STEP_INDEX;
  }

  if (isAgentWizardStepIndex(persistedStep)) return persistedStep;
  return AGENT_WIZARD_FIRST_STEP_INDEX;
}
