/**
 * Tests del roundtrip persistenza phase machine: snapshot (read) ↔ patch (write).
 *
 * Post-unificazione layout: il resolver (`resolveAgentConstructionPhase`) ritorna sempre
 * `'wizard'` perché esiste un unico shell. I test riflettono questa normalizzazione:
 * - lo snapshot mappa SEMPRE la phase a `'wizard'` (anche `'edit'` storico → `'wizard'`);
 * - la patch resta fedele al valore in input (per non corrompere dati storici di produzione
 *   che potrebbero contenere ancora `'edit'`).
 *
 * I campi `agentWizardCurrentStep` e `agentWizardTutorAcknowledged` mantengono la
 * semantica originale.
 */

import { describe, it, expect } from 'vitest';
import { buildTaskSnapshotFromRaw } from '../buildTaskSnapshot';
import { buildAIAgentTaskPersistPatch, type AIAgentPersistState } from '../buildPersistPatch';

const baseState: AIAgentPersistState = {
  designDescription: 'desc',
  agentPrompt: '',
  agentPromptTargetPlatform: 'elevenlabs',
  agentStructuredSectionsJson: '',
  outputVariableMappings: {},
  proposedFields: [],
  previewByStyle: {},
  previewStyleId: 'default',
  initialStateTemplateJson: '{}',
  agentRuntimeCompactJson: '',
  agentUseCaseGlobalStyleId: '',
  agentUseCaseStyleLearningNotes: '',
  hasAgentGeneration: false,
  agentLogicalStepsJson: '[]',
  agentUseCasesJson: '[]',
  agentStartPromptJson: '',
  agentStartUseCaseId: '',
  agentConversationalRulesJson: '[]',
  agentUseCaseWizardStateJson: '',
  agentIaRuntimeOverrideJson: '',
  agentImmediateStart: false,
  agentConstructionPhase: 'wizard',
  agentWizardCurrentStep: 2,
  agentWizardTutorAcknowledged: false,
  agentConversationStyleExample: '',
  agentConversationStyleAuto: false,
  agentConversationStyleSelections: {},
  agentConversationDeployStyleId: null,
  agentLogUseCase: false,
  agentLogBackendCalls: false,
  agentBehavior: 'B',
  agentInterfaceJson: '',
  agentKnowledgeBaseDocumentsJson: '',
};

describe('phase machine persist roundtrip', () => {
  it('scrive entrambi i campi nel patch', () => {
    const patch = buildAIAgentTaskPersistPatch(baseState);
    expect(patch.agentConstructionPhase).toBe('wizard');
    expect(patch.agentWizardCurrentStep).toBe(2);
  });

  it('legge entrambi i campi dallo snapshot', () => {
    const raw = buildAIAgentTaskPersistPatch(baseState);
    const snapshot = buildTaskSnapshotFromRaw(raw);
    expect(snapshot.agentConstructionPhase).toBe('wizard');
    expect(snapshot.agentWizardCurrentStep).toBe(2);
  });

  it("snapshot normalizza il valore storico 'edit' a 'wizard' (post-unificazione layout)", () => {
    const patch = buildAIAgentTaskPersistPatch({
      ...baseState,
      agentConstructionPhase: 'edit',
      agentWizardCurrentStep: 4,
    });
    expect(patch.agentConstructionPhase).toBe('edit');
    const snapshot = buildTaskSnapshotFromRaw(patch);
    expect(snapshot.agentConstructionPhase).toBe('wizard');
    expect(snapshot.agentWizardCurrentStep).toBe(4);
  });

  it('snapshot di task pre-feature (campi assenti, mai generato) \u2192 phase = wizard, step = 0', () => {
    const legacyRaw = {
      agentDesignDescription: '',
      agentDesignHasGeneration: false,
    };
    const snapshot = buildTaskSnapshotFromRaw(legacyRaw);
    expect(snapshot.agentConstructionPhase).toBe('wizard');
    expect(snapshot.agentWizardCurrentStep).toBe(0);
  });

  it('snapshot di task pre-feature gi\u00e0 generato \u2192 phase = wizard (unico shell post-unificazione)', () => {
    const legacyRaw = {
      agentDesignDescription: 'qualche descrizione',
      agentDesignHasGeneration: true,
    };
    const snapshot = buildTaskSnapshotFromRaw(legacyRaw);
    expect(snapshot.agentConstructionPhase).toBe('wizard');
    expect(snapshot.agentWizardCurrentStep).toBe(0);
  });

  it('snapshot tollera valori spuri/garbage e ricade ai default', () => {
    const garbageRaw = {
      agentConstructionPhase: 'garbage-value',
      agentWizardCurrentStep: 99,
      agentDesignHasGeneration: false,
    };
    const snapshot = buildTaskSnapshotFromRaw(garbageRaw);
    expect(snapshot.agentConstructionPhase).toBe('wizard');
    expect(snapshot.agentWizardCurrentStep).toBe(0);
  });

  it('agentWizardTutorAcknowledged: roundtrip preserva true', () => {
    const patch = buildAIAgentTaskPersistPatch({
      ...baseState,
      agentWizardTutorAcknowledged: true,
    });
    expect(patch.agentWizardTutorAcknowledged).toBe(true);
    const snapshot = buildTaskSnapshotFromRaw(patch);
    expect(snapshot.agentWizardTutorAcknowledged).toBe(true);
  });

  it('agentWizardTutorAcknowledged: task vergine \u2192 false (mostra Tutor)', () => {
    const snapshot = buildTaskSnapshotFromRaw({});
    expect(snapshot.agentWizardTutorAcknowledged).toBe(false);
  });

  it('agentStartPromptJson: roundtrip preserva testo di apertura', () => {
    const json = JSON.stringify({ schemaVersion: 1, text: 'Buongiorno, sono il tuo assistente.' });
    const patch = buildAIAgentTaskPersistPatch({ ...baseState, agentStartPromptJson: json });
    expect(patch.agentStartPromptJson).toBe(json);
    const snapshot = buildTaskSnapshotFromRaw(patch);
    expect(snapshot.agentStartPromptJson).toBe(json);
  });

  it('agentStartUseCaseId: roundtrip preserva use case Start', () => {
    const patch = buildAIAgentTaskPersistPatch({
      ...baseState,
      agentStartUseCaseId: 'uc-opening-1',
    });
    expect(patch.agentStartUseCaseId).toBe('uc-opening-1');
    const snapshot = buildTaskSnapshotFromRaw(patch);
    expect(snapshot.agentStartUseCaseId).toBe('uc-opening-1');
  });

  it('agentWizardTutorAcknowledged: task legacy gi\u00e0 generato \u2192 forced true (no Tutor inopportuna)', () => {
    const snapshot = buildTaskSnapshotFromRaw({
      agentDesignHasGeneration: true,
    });
    expect(snapshot.agentWizardTutorAcknowledged).toBe(true);
  });
});
