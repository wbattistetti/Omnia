/**
 * Test isolati per la logica del gate di stile («Imita questo stile») del passo
 * «Conversazione» del wizard use case.
 *
 * Copre:
 *  - {@link isStyleDefined}: disgiunzione esempio non vuoto OPPURE flag auto.
 *  - Roundtrip persist: i due nuovi campi `agentConversationStyleExample` e
 *    `agentConversationStyleAuto` sopravvivono a `buildPersistPatch` →
 *    `buildTaskSnapshotFromRaw`. Difende da regressioni del wiring.
 */

import { describe, it, expect } from 'vitest';
import { isStyleDefined } from '../useCaseGeneratorWizard/ConversationsStyleGate';
import { buildAIAgentTaskPersistPatch } from '../buildPersistPatch';
import { buildTaskSnapshotFromRaw } from '../buildTaskSnapshot';

describe('isStyleDefined', () => {
  it('returns false when both inputs are empty/false', () => {
    expect(isStyleDefined('', false)).toBe(false);
  });

  it('returns false for whitespace-only example with auto OFF', () => {
    expect(isStyleDefined('   \n  \t', false)).toBe(false);
  });

  it('returns true when example has content even if auto OFF', () => {
    expect(isStyleDefined('utente: ciao', false)).toBe(true);
  });

  it('returns true when auto is ON regardless of example', () => {
    expect(isStyleDefined('', true)).toBe(true);
    expect(isStyleDefined('   ', true)).toBe(true);
  });

  it('returns true when both are valid (auto wins as fallback, example is preferred upstream)', () => {
    expect(isStyleDefined('utente: ciao', true)).toBe(true);
  });
});

describe('agentConversationStyle{Example,Auto} — persist roundtrip', () => {
  /**
   * `buildAIAgentTaskPersistPatch` accetta uno state minimo con tutti i campi obbligatori.
   * Per questo test ci interessano solo i due nuovi campi style: gli altri sono fillati con
   * valori "sentinella" innocui per evitare divergenze nel patch.
   */
  function makeMinimalState(overrides: Partial<Parameters<typeof buildAIAgentTaskPersistPatch>[0]>) {
    return {
      designDescription: '',
      agentPrompt: '',
      agentPromptTargetPlatform: '',
      agentStructuredSectionsJson: '',
      outputVariableMappings: {},
      proposedFields: [],
      previewByStyle: {},
      previewStyleId: '',
      initialStateTemplateJson: '{}',
      agentRuntimeCompactJson: '',
      agentUseCaseGlobalStyleId: '',
      agentUseCaseStyleLearningNotes: '',
      hasAgentGeneration: false,
      agentLogicalStepsJson: '',
      agentUseCasesJson: '',
      agentUseCaseWizardStateJson: '',
      agentIaRuntimeOverrideJson: '',
      agentImmediateStart: false,
      agentConstructionPhase: 'wizard' as const,
      agentWizardCurrentStep: 0 as const,
      agentWizardTutorAcknowledged: false,
      agentConversationStyleExample: '',
      agentConversationStyleAuto: false,
      agentConversationStyleSelections: {},
      agentConversationDeployStyleId: null,
      agentLogUseCase: false,
      ...overrides,
    };
  }

  it('preserves example through patch → snapshot', () => {
    const state = makeMinimalState({
      agentConversationStyleExample: 'utente: vorrei prenotare\nagente: per quale data?',
    });
    const patch = buildAIAgentTaskPersistPatch(state);
    const snap = buildTaskSnapshotFromRaw(patch);
    expect(snap.agentConversationStyleExample).toBe(
      'utente: vorrei prenotare\nagente: per quale data?'
    );
    expect(snap.agentConversationStyleAuto).toBe(false);
  });

  it('preserves auto flag through patch → snapshot', () => {
    const state = makeMinimalState({ agentConversationStyleAuto: true });
    const patch = buildAIAgentTaskPersistPatch(state);
    const snap = buildTaskSnapshotFromRaw(patch);
    expect(snap.agentConversationStyleAuto).toBe(true);
    expect(snap.agentConversationStyleExample).toBe('');
  });

  it('defaults to empty/false when fields absent in raw row', () => {
    const snap = buildTaskSnapshotFromRaw({ id: 'x' });
    expect(snap.agentConversationStyleExample).toBe('');
    expect(snap.agentConversationStyleAuto).toBe(false);
    expect(snap.agentConversationStyleSelections).toEqual({});
    expect(snap.agentConversationDeployStyleId).toBeNull();
  });
});

describe('agentConversationStyleSelections / DeployStyleId — persist roundtrip', () => {
  function makeMinimalState(overrides: Partial<Parameters<typeof buildAIAgentTaskPersistPatch>[0]>) {
    return {
      designDescription: '',
      agentPrompt: '',
      agentPromptTargetPlatform: '',
      agentStructuredSectionsJson: '',
      outputVariableMappings: {},
      proposedFields: [],
      previewByStyle: {},
      previewStyleId: '',
      initialStateTemplateJson: '{}',
      agentRuntimeCompactJson: '',
      agentUseCaseGlobalStyleId: '',
      agentUseCaseStyleLearningNotes: '',
      hasAgentGeneration: false,
      agentLogicalStepsJson: '',
      agentUseCasesJson: '',
      agentUseCaseWizardStateJson: '',
      agentIaRuntimeOverrideJson: '',
      agentImmediateStart: false,
      agentConstructionPhase: 'wizard' as const,
      agentWizardCurrentStep: 0 as const,
      agentWizardTutorAcknowledged: false,
      agentConversationStyleExample: '',
      agentConversationStyleAuto: false,
      agentConversationStyleSelections: {},
      agentConversationDeployStyleId: null,
      agentLogUseCase: false,
      ...overrides,
    };
  }

  it('preserves multi-style selections through patch → snapshot', () => {
    const state = makeMinimalState({
      agentConversationStyleSelections: {
        cortese: { checked: true, description: 'desc cortese', example: 'utente: a' },
        ironico: { checked: false, description: 'desc ironico', example: '' },
      },
      agentConversationDeployStyleId: 'cortese',
    });
    const patch = buildAIAgentTaskPersistPatch(state);
    const snap = buildTaskSnapshotFromRaw(patch);
    expect(snap.agentConversationStyleSelections.cortese?.checked).toBe(true);
    expect(snap.agentConversationStyleSelections.cortese?.example).toBe('utente: a');
    expect(snap.agentConversationStyleSelections.ironico?.checked).toBe(false);
    expect(snap.agentConversationDeployStyleId).toBe('cortese');
  });

  it('preserves agentLogUseCase=true through patch → snapshot', () => {
    const state = makeMinimalState({ agentLogUseCase: true });
    const patch = buildAIAgentTaskPersistPatch(state);
    const snap = buildTaskSnapshotFromRaw(patch);
    expect(snap.agentLogUseCase).toBe(true);
  });

  it('defaults agentLogUseCase to false when missing in raw row (back-compat)', () => {
    const snap = buildTaskSnapshotFromRaw({ id: 'x' });
    expect(snap.agentLogUseCase).toBe(false);
  });

  it('lazy-migrates legacy example when selections are absent on load', () => {
    /**
     * Simula un task v1 persistito: solo `agentConversationStyleExample` valorizzato,
     * `agentConversationStyleSelections` assente. Il loader (via
     * `buildTaskSnapshotFromRaw → migrateLegacyStyleExample`) deve seedare lo stile
     * default come checked con l'esempio legacy.
     */
    const snap = buildTaskSnapshotFromRaw({
      id: 't',
      agentConversationStyleExample: 'utente: legacy\nagente: ok',
    });
    const seedId = Object.keys(snap.agentConversationStyleSelections)[0];
    expect(seedId).toBeTruthy();
    expect(snap.agentConversationStyleSelections[seedId!].checked).toBe(true);
    expect(snap.agentConversationStyleSelections[seedId!].example).toBe(
      'utente: legacy\nagente: ok'
    );
  });
});
