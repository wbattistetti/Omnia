/**
 * Tests per la risoluzione della phase machine top-level (wizard / edit) e dell'indice step.
 */

import { describe, it, expect } from 'vitest';
import {
  AGENT_WIZARD_FIRST_STEP_INDEX,
  AGENT_WIZARD_LAST_STEP_INDEX,
  AGENT_WIZARD_STEP_COUNT,
  AGENT_WIZARD_STEP_ORDER_VERSION,
  isAgentConstructionPhase,
  isAgentWizardStepIndex,
  resolveAgentConstructionPhase,
  resolveAgentWizardCurrentStep,
} from '../agentConstructionPhase';

describe('isAgentConstructionPhase', () => {
  it('accepta esclusivamente "wizard" e "edit"', () => {
    expect(isAgentConstructionPhase('wizard')).toBe(true);
    expect(isAgentConstructionPhase('edit')).toBe(true);
  });

  it('rifiuta valori sconosciuti, undefined, null, numeri', () => {
    expect(isAgentConstructionPhase(undefined)).toBe(false);
    expect(isAgentConstructionPhase(null)).toBe(false);
    expect(isAgentConstructionPhase('done')).toBe(false);
    expect(isAgentConstructionPhase('')).toBe(false);
    expect(isAgentConstructionPhase(0)).toBe(false);
  });
});

describe('isAgentWizardStepIndex', () => {
  it('accetta interi nel range [0..6]', () => {
    for (let i = 0; i < AGENT_WIZARD_STEP_COUNT; i++) {
      expect(isAgentWizardStepIndex(i)).toBe(true);
    }
    expect(AGENT_WIZARD_LAST_STEP_INDEX).toBe(6);
  });

  it('rifiuta indici fuori range, decimali, stringhe, undefined', () => {
    expect(isAgentWizardStepIndex(-1)).toBe(false);
    expect(isAgentWizardStepIndex(7)).toBe(false);
    expect(isAgentWizardStepIndex(2.5)).toBe(false);
    expect(isAgentWizardStepIndex('2')).toBe(false);
    expect(isAgentWizardStepIndex(undefined)).toBe(false);
    expect(isAgentWizardStepIndex(null)).toBe(false);
  });
});

describe('resolveAgentWizardCurrentStep', () => {
  it('migra indici legacy 5-step verso ordine 7-step (via catene legacy)', () => {
    expect(resolveAgentWizardCurrentStep(1)).toBe(3);
    expect(resolveAgentWizardCurrentStep(3)).toBe(5);
    expect(resolveAgentWizardCurrentStep(4)).toBe(6);
  });

  it('migra ordine 8-step (v3) verso 7-step senza State Map dedicato', () => {
    expect(resolveAgentWizardCurrentStep(3, 3)).toBe(3);
    expect(resolveAgentWizardCurrentStep(4, 3)).toBe(3);
    expect(resolveAgentWizardCurrentStep(5, 3)).toBe(4);
    expect(resolveAgentWizardCurrentStep(7, 3)).toBe(6);
  });

  it('rispetta indici validi con versione 4', () => {
    expect(resolveAgentWizardCurrentStep(3, AGENT_WIZARD_STEP_ORDER_VERSION)).toBe(3);
    expect(resolveAgentWizardCurrentStep(6, AGENT_WIZARD_STEP_ORDER_VERSION)).toBe(6);
  });

  it('fallback al primo step su input invalidi', () => {
    expect(resolveAgentWizardCurrentStep(undefined)).toBe(AGENT_WIZARD_FIRST_STEP_INDEX);
    expect(resolveAgentWizardCurrentStep(null)).toBe(AGENT_WIZARD_FIRST_STEP_INDEX);
    expect(resolveAgentWizardCurrentStep(99)).toBe(AGENT_WIZARD_FIRST_STEP_INDEX);
    expect(resolveAgentWizardCurrentStep(-1)).toBe(AGENT_WIZARD_FIRST_STEP_INDEX);
    expect(resolveAgentWizardCurrentStep('2')).toBe(AGENT_WIZARD_FIRST_STEP_INDEX);
  });
});
