/**
 * Lightweight pipeline state for the guided use-case generator: step index, IA baselines, sequential unlock.
 * Stato pipeline + baseline persistiti sul Task (`agentUseCaseWizardStateJson`).
 */

import React from 'react';
import { USE_CASE_GENERATOR_WIZARD_STEP_ORDER } from '@domain/useCaseGeneratorWizard/registry';
import { getUseCaseGeneratorWizardStepConfig } from '@domain/useCaseGeneratorWizard/config';
import { serializeUseCaseListForWizardBaseline } from '@domain/useCaseGeneratorWizard/useCaseListBaseline';
import {
  computeExamplePhraseStylePlan,
  snapshotAssistantContentByUseCaseId,
  type ExamplePhraseStylePlan,
} from '@domain/useCaseGeneratorWizard/examplePhraseStyleDiff';
import {
  parseUseCaseWizardPersistedState,
  serializeUseCaseWizardPersistedState,
  type UseCaseWizardPersistedStateV1,
} from '@domain/useCaseGeneratorWizard/useCaseWizardPersistedState';
import type { UseCaseGeneratorWizardStepId } from '@domain/useCaseGeneratorWizard/types';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';

const LAST_STEP_INDEX = USE_CASE_GENERATOR_WIZARD_STEP_ORDER.length - 1;
const USE_CASE_LIST_STEP_INDEX = USE_CASE_GENERATOR_WIZARD_STEP_ORDER.indexOf('use_case_list');
const EXAMPLE_PHRASES_STEP_INDEX = USE_CASE_GENERATOR_WIZARD_STEP_ORDER.indexOf('example_phrases');

/** Passi in cui si confrontano le frasi assistente con la baseline (lista + frasi esempio). */
function isExamplePhraseStyleStep(stepIndex: number): boolean {
  return stepIndex === USE_CASE_LIST_STEP_INDEX || stepIndex === EXAMPLE_PHRASES_STEP_INDEX;
}

const EMPTY_EXAMPLE_PHRASE_PLAN: ExamplePhraseStylePlan = {
  modifiedIds: [],
  unmodifiedIds: [],
  targetIds: [],
  showStyleCta: false,
};

export interface UseUseCaseGeneratorWizardParams {
  instanceId: string | undefined;
  useCases: readonly AIAgentUseCase[];
  /** JSON dal Task — ripristino dopo salvataggio progetto. */
  taskPersistedWizardJson?: string | null;
  /** Persistenza sul Task (debounced via controller `dirty`). */
  onWizardPersist?: (json: string) => void;
  onConfirmAdvanceWithoutEdits?: (stepId: UseCaseGeneratorWizardStepId) => void;
}

export interface UseCaseGeneratorWizardModel {
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
  unlockedMaxStepIndex: number;
  canSelectStep: (index: number) => boolean;
  selectStep: (index: number) => void;
  goToPreviousStep: () => void;
  advanceToNextStep: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
  hasEditsSinceLastAi: boolean;
  captureUseCaseListAiBaseline: (ucs?: readonly AIAgentUseCase[]) => void;
  captureExamplePhrasesBaseline: (ucs?: readonly AIAgentUseCase[]) => void;
  examplePhraseStylePlan: ExamplePhraseStylePlan;
  dialogOpen: boolean;
  dialogMessage: string;
  confirmAdvanceDialog: () => void;
  cancelAdvanceDialog: () => void;
}

function storageKeyFor(instanceId: string | undefined): string | null {
  const id = instanceId?.trim();
  return id ? `omnia.useCaseGeneratorWizard.${id}` : null;
}

function buildWizardPayload(
  enabled: boolean,
  stepIndex: number,
  unlockedMaxStepIndex: number,
  baselineRef: React.MutableRefObject<Partial<Record<UseCaseGeneratorWizardStepId, string>>>,
  phraseBaselineRef: React.MutableRefObject<Record<string, string>>
): UseCaseWizardPersistedStateV1 {
  const listBl = baselineRef.current.use_case_list;
  const phrase = phraseBaselineRef.current;
  return {
    schemaVersion: 1,
    enabled,
    stepIndex,
    unlockedMaxStepIndex,
    ...(listBl !== undefined ? { useCaseListBaseline: listBl } : {}),
    ...(Object.keys(phrase).length > 0 ? { examplePhraseBaselineById: { ...phrase } } : {}),
  };
}

export function useUseCaseGeneratorWizard({
  instanceId,
  useCases,
  taskPersistedWizardJson,
  onWizardPersist,
  onConfirmAdvanceWithoutEdits,
}: UseUseCaseGeneratorWizardParams): UseCaseGeneratorWizardModel {
  const key = React.useMemo(() => storageKeyFor(instanceId), [instanceId]);

  const [enabled, setEnabledState] = React.useState(true);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [unlockedMaxStepIndex, setUnlockedMaxStepIndex] = React.useState(0);
  const [baselineEpoch, setBaselineEpoch] = React.useState(0);
  const [showNoChangesTutorial, setShowNoChangesTutorial] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [examplePhraseBaselineEpoch, setExamplePhraseBaselineEpoch] = React.useState(0);

  const baselineRef = React.useRef<Partial<Record<UseCaseGeneratorWizardStepId, string>>>({});
  const examplePhraseBaselineByIdRef = React.useRef<Record<string, string>>({});
  const prevStepIndexForPhraseRef = React.useRef<number>(-1);
  const lastEmittedJsonRef = React.useRef<string>('');
  const prevInstanceIdRef = React.useRef<string | undefined>(undefined);

  const applyHydratedParsed = React.useCallback((parsed: UseCaseWizardPersistedStateV1) => {
    const si = Math.min(Math.max(0, Math.floor(parsed.stepIndex)), LAST_STEP_INDEX);
    let um =
      typeof parsed.unlockedMaxStepIndex === 'number'
        ? Math.floor(parsed.unlockedMaxStepIndex)
        : si;
    um = Math.min(Math.max(um, si), LAST_STEP_INDEX);
    setStepIndex(si);
    setUnlockedMaxStepIndex(um);
    if (typeof parsed.enabled === 'boolean') setEnabledState(parsed.enabled);
    if (parsed.useCaseListBaseline !== undefined) {
      baselineRef.current.use_case_list = parsed.useCaseListBaseline;
    }
    if (parsed.examplePhraseBaselineById && Object.keys(parsed.examplePhraseBaselineById).length > 0) {
      examplePhraseBaselineByIdRef.current = { ...parsed.examplePhraseBaselineById };
    }
    prevStepIndexForPhraseRef.current = si;
    setBaselineEpoch((n) => n + 1);
    setExamplePhraseBaselineEpoch((n) => n + 1);
  }, []);

  React.useLayoutEffect(() => {
    if (prevInstanceIdRef.current !== instanceId) {
      prevInstanceIdRef.current = instanceId;
      lastEmittedJsonRef.current = '';
    }

    const raw = (taskPersistedWizardJson ?? '').trim();
    if (raw === lastEmittedJsonRef.current && raw !== '') return;

    if (raw) {
      const parsed = parseUseCaseWizardPersistedState(raw);
      if (parsed) {
        applyHydratedParsed(parsed);
        lastEmittedJsonRef.current = serializeUseCaseWizardPersistedState(
          buildWizardPayload(
            typeof parsed.enabled === 'boolean' ? parsed.enabled : true,
            Math.min(parsed.stepIndex, LAST_STEP_INDEX),
            Math.min(
              typeof parsed.unlockedMaxStepIndex === 'number' ? parsed.unlockedMaxStepIndex : parsed.stepIndex,
              LAST_STEP_INDEX
            ),
            baselineRef,
            examplePhraseBaselineByIdRef
          )
        );
        return;
      }
    }

    if (!key) return;
    try {
      const legacyRaw = sessionStorage.getItem(key);
      if (!legacyRaw?.trim()) return;
      const legacyParsed = parseUseCaseWizardPersistedState(legacyRaw);
      if (!legacyParsed) return;
      applyHydratedParsed(legacyParsed);
      lastEmittedJsonRef.current = serializeUseCaseWizardPersistedState(
        buildWizardPayload(
          typeof legacyParsed.enabled === 'boolean' ? legacyParsed.enabled : true,
          Math.min(legacyParsed.stepIndex, LAST_STEP_INDEX),
          Math.min(
            typeof legacyParsed.unlockedMaxStepIndex === 'number'
              ? legacyParsed.unlockedMaxStepIndex
              : legacyParsed.stepIndex,
            LAST_STEP_INDEX
          ),
          baselineRef,
          examplePhraseBaselineByIdRef
        )
      );
    } catch {
      /* ignore */
    }
  }, [instanceId, taskPersistedWizardJson, key, applyHydratedParsed]);

  React.useEffect(() => {
    if (!onWizardPersist) return;
    const payload = buildWizardPayload(
      enabled,
      stepIndex,
      unlockedMaxStepIndex,
      baselineRef,
      examplePhraseBaselineByIdRef
    );
    const json = serializeUseCaseWizardPersistedState(payload);
    if (json === lastEmittedJsonRef.current) return;
    lastEmittedJsonRef.current = json;
    onWizardPersist(json);
    if (key) {
      try {
        sessionStorage.setItem(key, json);
      } catch {
        /* ignore */
      }
    }
  }, [
    enabled,
    stepIndex,
    unlockedMaxStepIndex,
    baselineEpoch,
    examplePhraseBaselineEpoch,
    onWizardPersist,
    key,
  ]);

  React.useEffect(() => {
    if (useCases.length > 0) {
      setUnlockedMaxStepIndex((prev) => Math.min(Math.max(prev, 1), LAST_STEP_INDEX));
    }
  }, [useCases.length]);

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

  const captureExamplePhrasesBaseline = React.useCallback((ucs?: readonly AIAgentUseCase[]) => {
    const list = ucs ?? useCases;
    examplePhraseBaselineByIdRef.current = snapshotAssistantContentByUseCaseId(list);
    setExamplePhraseBaselineEpoch((n) => n + 1);
  }, [useCases]);

  React.useEffect(() => {
    const prev = prevStepIndexForPhraseRef.current;
    if (stepIndex === EXAMPLE_PHRASES_STEP_INDEX && prev !== EXAMPLE_PHRASES_STEP_INDEX) {
      examplePhraseBaselineByIdRef.current = snapshotAssistantContentByUseCaseId(useCases);
      setExamplePhraseBaselineEpoch((n) => n + 1);
    }
    prevStepIndexForPhraseRef.current = stepIndex;
  }, [stepIndex, useCases]);

  /** Baseline frase assistente per id mancanti (lista use case o passo frasi): primo snapshot del testo corrente. */
  React.useEffect(() => {
    if (!isExamplePhraseStyleStep(stepIndex)) return;
    let changed = false;
    const base = examplePhraseBaselineByIdRef.current;
    for (const u of useCases) {
      if (base[u.id] === undefined) {
        const snap = snapshotAssistantContentByUseCaseId([u]);
        base[u.id] = snap[u.id] ?? '';
        changed = true;
      }
    }
    if (changed) setExamplePhraseBaselineEpoch((n) => n + 1);
  }, [stepIndex, useCases]);

  const examplePhraseStylePlan = React.useMemo((): ExamplePhraseStylePlan => {
    if (!isExamplePhraseStyleStep(stepIndex)) {
      return EMPTY_EXAMPLE_PHRASE_PLAN;
    }
    return computeExamplePhraseStylePlan(useCases, examplePhraseBaselineByIdRef.current);
  }, [stepIndex, useCases, examplePhraseBaselineEpoch]);

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
    onConfirmAdvanceWithoutEdits?.(currentStepId);
    advanceStep();
  }, [advanceStep, currentStepId, onConfirmAdvanceWithoutEdits]);

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
    captureExamplePhrasesBaseline,
    examplePhraseStylePlan,
    dialogOpen,
    dialogMessage: stepCfg.confirmNoEditsMessage,
    confirmAdvanceDialog,
    cancelAdvanceDialog,
  };
}
