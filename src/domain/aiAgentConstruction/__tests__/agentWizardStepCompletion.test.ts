/**
 * Tests per le regole di completamento step del wizard AI Agent.
 * Coprono i due gate stretti (step 1 e step 3) e gli step soft (sempre ✅).
 */

import { describe, it, expect } from 'vitest';
import {
  type AgentWizardCompletionInput,
  areAllAgentWizardStepsComplete,
  evaluateAgentWizardCompletion,
  isStep1TaskComplete,
  isStep2BackendComplete,
  isStep3ConversationComplete,
  isStep4DataComplete,
  isStep5VoiceComplete,
  nextIncompleteAgentWizardStep,
} from '../agentWizardStepCompletion';

const empty: AgentWizardCompletionInput = {
  descriptionTrimmed: '',
  useCaseCount: 0,
  conversationCount: 0,
};

const taskOnly: AgentWizardCompletionInput = {
  descriptionTrimmed: 'Agente che prenota visite',
  useCaseCount: 0,
  conversationCount: 0,
};

const allDone: AgentWizardCompletionInput = {
  descriptionTrimmed: 'Agente che prenota visite',
  useCaseCount: 1,
  conversationCount: 1,
};

describe('agentWizardStepCompletion — gate stretti', () => {
  it('step 1 è incompleto se la descrizione è vuota', () => {
    expect(isStep1TaskComplete(empty)).toBe(false);
  });

  it('step 1 è completo con descrizione non vuota', () => {
    expect(isStep1TaskComplete(taskOnly)).toBe(true);
  });

  it('step 3 richiede ALMENO una use case E una conversazione', () => {
    expect(isStep3ConversationComplete(empty)).toBe(false);
    expect(
      isStep3ConversationComplete({ ...empty, useCaseCount: 1 })
    ).toBe(false);
    expect(
      isStep3ConversationComplete({ ...empty, conversationCount: 1 })
    ).toBe(false);
    expect(
      isStep3ConversationComplete({ ...empty, useCaseCount: 1, conversationCount: 1 })
    ).toBe(true);
  });
});

describe('agentWizardStepCompletion — step soft (sempre ✅)', () => {
  it('step 2 (Backend) è sempre completato', () => {
    expect(isStep2BackendComplete(empty)).toBe(true);
    expect(isStep2BackendComplete(allDone)).toBe(true);
  });

  it('step 4 (Dati) è sempre completato', () => {
    expect(isStep4DataComplete(empty)).toBe(true);
    expect(isStep4DataComplete(allDone)).toBe(true);
  });

  it('step 5 (Voce) è sempre completato', () => {
    expect(isStep5VoiceComplete(empty)).toBe(true);
    expect(isStep5VoiceComplete(allDone)).toBe(true);
  });
});

describe('agentWizardStepCompletion — aggregati', () => {
  /**
   * Post-riordino mag 2026 l'ordine ufficiale è:
   *   0 → Task          (gate STRETTO)
   *   1 → Prompts       (gate STRETTO, ex-Conversazione)
   *   2 → Backend       (soft, sempre ✅)
   *   3 → Dati          (soft)
   *   4 → Voce          (soft)
   * Quindi su input `empty` (no descrizione, no use case) i due gate stretti
   * (posizioni 0 e 1) sono false, gli altri true.
   */
  it('evaluateAgentWizardCompletion ritorna 5 flag in ordine', () => {
    const flags = evaluateAgentWizardCompletion(empty);
    expect(flags).toHaveLength(5);
    expect(flags).toEqual([false, false, true, true, true]);
  });

  it('areAllAgentWizardStepsComplete è false se mancano i gate stretti', () => {
    expect(areAllAgentWizardStepsComplete(empty)).toBe(false);
    expect(areAllAgentWizardStepsComplete(taskOnly)).toBe(false);
  });

  it('areAllAgentWizardStepsComplete è true quando i due gate stretti passano', () => {
    expect(areAllAgentWizardStepsComplete(allDone)).toBe(true);
  });

  it('nextIncompleteAgentWizardStep ritorna il primo step non completato', () => {
    expect(nextIncompleteAgentWizardStep(empty)).toBe(0);
    /**
     * Con il nuovo ordine il primo step non completato dopo Task è Prompts (idx 1),
     * non più Backend: il gate stretto «≥1 use case + ≥1 conversazione» è in posizione 1.
     */
    expect(nextIncompleteAgentWizardStep(taskOnly)).toBe(1);
    expect(nextIncompleteAgentWizardStep(allDone)).toBe(4);
  });
});
