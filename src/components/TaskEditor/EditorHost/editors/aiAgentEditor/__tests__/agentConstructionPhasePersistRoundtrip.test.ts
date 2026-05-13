/**
 * Tests del roundtrip persistenza phase machine: snapshot (read) ↔ patch (write).
 *
 * Garantisce che i nuovi campi `agentConstructionPhase` e `agentWizardCurrentStep`:
 *   - vengano letti correttamente da `buildTaskSnapshotFromRaw` con fallback intelligente;
 *   - vengano scritti dal `buildAIAgentTaskPersistPatch` senza perdita semantica;
 *   - sopravvivano a un giro completo read → modify → write → read.
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
  hasAgentGeneration: false,
  agentLogicalStepsJson: '[]',
  agentUseCasesJson: '[]',
  agentUseCaseWizardStateJson: '',
  agentIaRuntimeOverrideJson: '',
  agentImmediateStart: false,
  agentConstructionPhase: 'wizard',
  agentWizardCurrentStep: 2,
  agentWizardTutorAcknowledged: false,
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

  it('roundtrip completo wizard \u2192 edit preserva la phase', () => {
    const patch = buildAIAgentTaskPersistPatch({
      ...baseState,
      agentConstructionPhase: 'edit',
      agentWizardCurrentStep: 4,
    });
    const snapshot = buildTaskSnapshotFromRaw(patch);
    expect(snapshot.agentConstructionPhase).toBe('edit');
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

  it('snapshot di task pre-feature gi\u00e0 generato \u2192 phase = edit (veterani saltano il wizard)', () => {
    const legacyRaw = {
      agentDesignDescription: 'qualche descrizione',
      agentDesignHasGeneration: true,
    };
    const snapshot = buildTaskSnapshotFromRaw(legacyRaw);
    expect(snapshot.agentConstructionPhase).toBe('edit');
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

  it('agentWizardTutorAcknowledged: task legacy gi\u00e0 generato \u2192 forced true (no Tutor inopportuna)', () => {
    const snapshot = buildTaskSnapshotFromRaw({
      agentDesignHasGeneration: true,
    });
    expect(snapshot.agentWizardTutorAcknowledged).toBe(true);
  });
});
