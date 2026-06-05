/**
 * AI Agent — Phase machine di alto livello del Task Editor.
 *
 * Wizard 7 step (ordine giu 2026):
 *   0 Task → 1 KB → 2 Backend → 3 Prompts → 4 Error Handling → 5 Dati → 6 Voce
 */

export type AgentConstructionPhase = 'wizard' | 'edit';

/** Indici 0-based dei 7 step del Construction Wizard. */
export type AgentWizardStepIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const AGENT_WIZARD_STEP_COUNT = 7 as const;

export const AGENT_WIZARD_FIRST_STEP_INDEX: AgentWizardStepIndex = 0;

export const AGENT_WIZARD_LAST_STEP_INDEX: AgentWizardStepIndex = 6;

/** Versione ordine step persistita su task (4 = wizard a 7 fasi senza step State Map dedicato). */
export const AGENT_WIZARD_STEP_ORDER_VERSION = 4 as const;

/** Migrazione indici wizard legacy (5 step) → ordine 7-step (v2). */
const LEGACY_5_STEP_TO_7: Readonly<Record<number, AgentWizardStepIndex>> = {
  0: 0,
  1: 3,
  2: 2,
  3: 5,
  4: 6,
};

/** Migrazione ordine 7-step (v2) → 8-step (v3): inseriva State Map @3. */
const LEGACY_7_STEP_TO_8: Readonly<Record<number, AgentWizardStepIndex>> = {
  0: 0,
  1: 1,
  2: 2,
  3: 4,
  4: 5,
  5: 6,
  6: 7,
};

/** Migrazione ordine 8-step (v3) → 7-step (v4): rimuove State Map @3. */
const LEGACY_8_STEP_TO_7: Readonly<Record<number, AgentWizardStepIndex>> = {
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 3,
  5: 4,
  6: 5,
  7: 6,
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
 * Risolve l'indice step corrente con migrazione da ordini legacy (5, 7, 8 step).
 */
export function resolveAgentWizardCurrentStep(
  persistedStep: unknown,
  persistedStepOrderVersion: unknown = 1
): AgentWizardStepIndex {
  const versionRaw =
    persistedStepOrderVersion === AGENT_WIZARD_STEP_ORDER_VERSION
      ? AGENT_WIZARD_STEP_ORDER_VERSION
      : persistedStepOrderVersion === 3
        ? 3
        : persistedStepOrderVersion === 2
          ? 2
          : 1;

  if (typeof persistedStep !== 'number' || !Number.isInteger(persistedStep)) {
    return AGENT_WIZARD_FIRST_STEP_INDEX;
  }

  if (versionRaw === AGENT_WIZARD_STEP_ORDER_VERSION && isAgentWizardStepIndex(persistedStep)) {
    return persistedStep;
  }

  if (versionRaw === 3 && persistedStep >= 0 && persistedStep <= 7) {
    return LEGACY_8_STEP_TO_7[persistedStep] ?? AGENT_WIZARD_FIRST_STEP_INDEX;
  }

  if (versionRaw === 2 && persistedStep >= 0 && persistedStep <= 6) {
    const migrated8 = LEGACY_7_STEP_TO_8[persistedStep] ?? AGENT_WIZARD_FIRST_STEP_INDEX;
    return LEGACY_8_STEP_TO_7[migrated8] ?? migrated8;
  }

  if (persistedStep >= 0 && persistedStep <= 4) {
    const migrated7 = LEGACY_5_STEP_TO_7[persistedStep] ?? AGENT_WIZARD_FIRST_STEP_INDEX;
    const migrated8 = LEGACY_7_STEP_TO_8[migrated7] ?? migrated7;
    return LEGACY_8_STEP_TO_7[migrated8] ?? migrated8;
  }

  if (isAgentWizardStepIndex(persistedStep)) return persistedStep;
  return AGENT_WIZARD_FIRST_STEP_INDEX;
}
