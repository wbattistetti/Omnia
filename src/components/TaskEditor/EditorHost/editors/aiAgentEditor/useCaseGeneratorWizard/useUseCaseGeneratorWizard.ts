/**
 * Lightweight pipeline state for the guided use-case generator: step index, IA baselines, sequential unlock.
 */

import React from 'react';
import { USE_CASE_GENERATOR_WIZARD_STEP_ORDER } from '@domain/useCaseGeneratorWizard/registry';
import { getUseCaseGeneratorWizardStepConfig } from '@domain/useCaseGeneratorWizard/config';
import { serializeUseCaseListForWizardBaseline } from '@domain/useCaseGeneratorWizard/useCaseListBaseline';
import type {
  UseCaseGeneratorWizardPersistedState,
  UseCaseGeneratorWizardStepId,
} from '@domain/useCaseGeneratorWizard/types';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';

const LAST_STEP_INDEX = USE_CASE_GENERATOR_WIZARD_STEP_ORDER.length - 1;

export interface UseUseCaseGeneratorWizardParams {
  instanceId: string | undefined;
  useCases: readonly AIAgentUseCase[];
}

export interface UseCaseGeneratorWizardModel {
  /** Sempre true di default; il view generator non richiede opt-in manuale. */
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  stepIndex: number;
  stepCount: number;
  currentStepId: UseCaseGeneratorWizardStepId;
  title: string;
  instruction: string;
  tutorialIfNoChanges: string;
  showNoChangesTutorial: boolean;
  dismissNoChangesTutorial: () => void;
  /** Indice massimo selezionabile (0–4) in base ai passi completati. */
  unlockedMaxStepIndex: number;
  canSelectStep: (index: number) => boolean;
  selectStep: (index: number) => void;
  goToPreviousStep: () => void;
  advanceToNextStep: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
  hasEditsSinceLastAi: boolean;
  captureUseCaseListAiBaseline: (ucs?: readonly AIAgentUseCase[]) => void;
  dialogOpen: boolean;
  dialogMessage: string;
  confirmAdvanceDialog: () => void;
  cancelAdvanceDialog: () => void;
}

function storageKeyFor(instanceId: string | undefined): string | null {
  const id = instanceId?.trim();
  return id ? `omnia.useCaseGeneratorWizard.${id}` : null;
}

export function useUseCaseGeneratorWizard({
  instanceId,
  useCases,
}: UseUseCaseGeneratorWizardParams): UseCaseGeneratorWizardModel {
  const key = React.useMemo(() => storageKeyFor(instanceId), [instanceId]);

  const [enabled, setEnabledState] = React.useState(true);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [unlockedMaxStepIndex, setUnlockedMaxStepIndex] = React.useState(0);
  const [baselineEpoch, setBaselineEpoch] = React.useState(0);
  const [showNoChangesTutorial, setShowNoChangesTutorial] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const baselineRef = React.useRef<Partial<Record<UseCaseGeneratorWizardStepId, string>>>({});

  React.useEffect(() => {
    if (!key) return;
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return;
      const v = JSON.parse(raw) as UseCaseGeneratorWizardPersistedState;
      if (typeof v.enabled === 'boolean') setEnabledState(v.enabled);
      let um =
        typeof v.unlockedMaxStepIndex === 'number' &&
        v.unlockedMaxStepIndex >= 0 &&
        v.unlockedMaxStepIndex <= LAST_STEP_INDEX
          ? v.unlockedMaxStepIndex
          : 0;
      let si =
        typeof v.stepIndex === 'number' &&
        v.stepIndex >= 0 &&
        v.stepIndex < USE_CASE_GENERATOR_WIZARD_STEP_ORDER.length
          ? v.stepIndex
          : 0;
      if (si > um) si = um;
      setStepIndex(si);
      setUnlockedMaxStepIndex(um);
    } catch {
      /* ignore */
    }
  }, [key]);

  React.useEffect(() => {
    if (!key) return;
    try {
      const payload: UseCaseGeneratorWizardPersistedState = {
        enabled,
        stepIndex,
        unlockedMaxStepIndex,
      };
      sessionStorage.setItem(key, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }, [key, enabled, stepIndex, unlockedMaxStepIndex]);

  /** Passo 1 «completato» quando esiste almeno uno use case (creato o generato). */
  React.useEffect(() => {
    if (useCases.length > 0) {
      setUnlockedMaxStepIndex((prev) => Math.min(Math.max(prev, 1), LAST_STEP_INDEX));
    }
  }, [useCases.length]);

  /**
   * Snapshot lista quando compare il primo use case senza `captureUseCaseListAiBaseline` esplicito
   * (es. creazione manuale): così «nessuna modifica» vs baseline non è sempre vero.
   */
  React.useEffect(() => {
    if (useCases.length === 0) return;
    if (baselineRef.current.use_case_list !== undefined) return;
    baselineRef.current.use_case_list = serializeUseCaseListForWizardBaseline(useCases);
    setBaselineEpoch((n) => n + 1);
  }, [useCases]);

  const setEnabled = React.useCallback((value: boolean) => {
    setEnabledState(value);
    if (!value) {
      setShowNoChangesTutorial(false);
      setDialogOpen(false);
    }
  }, []);

  const currentStepId = USE_CASE_GENERATOR_WIZARD_STEP_ORDER[stepIndex] ?? 'use_case_list';
  const stepCfg = getUseCaseGeneratorWizardStepConfig(currentStepId);

  const snapshotForStep = React.useCallback(
    (id: UseCaseGeneratorWizardStepId): string => {
      switch (id) {
        case 'use_case_list':
          return serializeUseCaseListForWizardBaseline(useCases);
        default:
          return '';
      }
    },
    [useCases]
  );

  const hasEditsSinceLastAi = React.useMemo(() => {
    const id = currentStepId;
    const baseline = baselineRef.current[id];
    const snap = snapshotForStep(id);
    if (baseline === undefined) return true;
    return snap !== baseline;
  }, [currentStepId, snapshotForStep, useCases, baselineEpoch]);

  const captureUseCaseListAiBaseline = React.useCallback((ucs?: readonly AIAgentUseCase[]) => {
    const list = ucs ?? useCases;
    baselineRef.current.use_case_list = serializeUseCaseListForWizardBaseline(list);
    setBaselineEpoch((n) => n + 1);
    setShowNoChangesTutorial(false);
  }, [useCases]);

  const dismissNoChangesTutorial = React.useCallback(() => setShowNoChangesTutorial(false), []);

  const canSelectStep = React.useCallback(
    (index: number) => index >= 0 && index <= unlockedMaxStepIndex,
    [unlockedMaxStepIndex]
  );

  const advanceStep = React.useCallback(() => {
    setStepIndex((i) => {
      const next = Math.min(i + 1, LAST_STEP_INDEX);
      setUnlockedMaxStepIndex((u) => Math.min(Math.max(u, next + 1), LAST_STEP_INDEX));
      return next;
    });
    setShowNoChangesTutorial(false);
    setDialogOpen(false);
  }, []);

  const goToPreviousStep = React.useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
    setShowNoChangesTutorial(false);
    setDialogOpen(false);
  }, []);

  const requestAdvanceToNextStep = React.useCallback(() => {
    if (stepIndex >= LAST_STEP_INDEX) return;
    if (hasEditsSinceLastAi) {
      advanceStep();
      return;
    }
    setDialogOpen(true);
  }, [advanceStep, hasEditsSinceLastAi, stepIndex]);

  const confirmAdvanceDialog = React.useCallback(() => {
    advanceStep();
  }, [advanceStep]);

  const cancelAdvanceDialog = React.useCallback(() => {
    setDialogOpen(false);
    setShowNoChangesTutorial(true);
  }, []);

  const selectStep = React.useCallback(
    (index: number) => {
      if (index < 0 || index >= USE_CASE_GENERATOR_WIZARD_STEP_ORDER.length) return;
      if (index > unlockedMaxStepIndex) return;
      setStepIndex(index);
      setShowNoChangesTutorial(false);
      setDialogOpen(false);
    },
    [unlockedMaxStepIndex]
  );

  const canGoPrevious = stepIndex > 0;
  const canGoNext = stepIndex < LAST_STEP_INDEX;

  return {
    enabled,
    setEnabled,
    stepIndex,
    stepCount: USE_CASE_GENERATOR_WIZARD_STEP_ORDER.length,
    currentStepId,
    title: stepCfg.title,
    instruction: stepCfg.instructionPlain,
    tutorialIfNoChanges: stepCfg.tutorialIfNoChanges,
    showNoChangesTutorial,
    dismissNoChangesTutorial,
    unlockedMaxStepIndex,
    canSelectStep,
    selectStep,
    goToPreviousStep,
    advanceToNextStep: requestAdvanceToNextStep,
    canGoPrevious,
    canGoNext,
    hasEditsSinceLastAi,
    captureUseCaseListAiBaseline,
    dialogOpen,
    dialogMessage: stepCfg.confirmNoEditsMessage,
    confirmAdvanceDialog,
    cancelAdvanceDialog,
  };
}
