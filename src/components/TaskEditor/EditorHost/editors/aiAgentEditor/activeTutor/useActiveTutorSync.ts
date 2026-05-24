/**
 * Active Tutor — sincronizza store con Construction Wizard (AI busy, step, sub-viste).
 */

import React from 'react';
import type { AgentWizardStepIndex } from '@domain/aiAgentConstruction/agentConstructionPhase';
import type { TutorPhaseId, TutorBackendSubView } from '@domain/activeTutor/tutorPhase';
import { TASK_DESCRIPTION_MIN_CHARS } from '@domain/activeTutor/tutorPhaseIntro';
import { useActiveTutorStore } from './activeTutorStore';
import { TUTOR_UI_CONTROL_EVENT, type TutorUiControlEventDetail } from './uiControlModule';
import type { TutorScriptContext } from '@domain/activeTutor/tutorScriptContext';

export interface UseActiveTutorSyncOptions {
  readonly taskId: string;
  readonly wizardStep: AgentWizardStepIndex;
  readonly generating: boolean;
  readonly useCaseComposerBusy: boolean;
  readonly useCaseBundleGenerationBusy: boolean;
  readonly knowledgeBaseActive: boolean;
  readonly interfaceActive: boolean;
  readonly scriptContext: TutorScriptContext;
  readonly phaseCompletion: readonly boolean[];
  readonly onSelectWizardStep: (index: AgentWizardStepIndex) => void;
  /** Flag persistito: se false, append welcome nella tab Task. */
  readonly tutorWelcomeAcknowledged: boolean;
}

/** Hook da montare in `AIAgentEditor` (tutor sempre attivo nel layout). */
export function useActiveTutorSync({
  taskId,
  wizardStep,
  generating,
  useCaseComposerBusy,
  useCaseBundleGenerationBusy,
  knowledgeBaseActive,
  interfaceActive,
  scriptContext,
  phaseCompletion,
  onSelectWizardStep,
  tutorWelcomeAcknowledged,
}: UseActiveTutorSyncOptions): void {
  const hydrateFromSession = useActiveTutorStore((s) => s.hydrateFromSession);
  const enterPhase = useActiveTutorStore((s) => s.enterPhase);
  const dispatchTransition = useActiveTutorStore((s) => s.dispatchTransition);
  const setBackendSubView = useActiveTutorStore((s) => s.setBackendSubView);
  const setScriptContext = useActiveTutorStore((s) => s.setScriptContext);
  const setPhaseCompletion = useActiveTutorStore((s) => s.setPhaseCompletion);
  const appendWelcomeIfNeeded = useActiveTutorStore((s) => s.appendWelcomeIfNeeded);

  const prevStepRef = React.useRef<AgentWizardStepIndex>(wizardStep);
  const prevGeneratingRef = React.useRef(false);
  const hydratedRef = React.useRef(false);
  const initialEnterRef = React.useRef(false);
  const prevTaskDescFilledRef = React.useRef<boolean | null>(null);
  const welcomeAppendedRef = React.useRef(false);

  React.useEffect(() => {
    if (!hydratedRef.current) {
      hydrateFromSession(taskId);
      hydratedRef.current = true;
    }
  }, [hydrateFromSession, taskId]);

  React.useEffect(() => {
    if (!hydratedRef.current || welcomeAppendedRef.current) return;
    welcomeAppendedRef.current = true;
    appendWelcomeIfNeeded(tutorWelcomeAcknowledged);
  }, [appendWelcomeIfNeeded, tutorWelcomeAcknowledged]);

  React.useEffect(() => {
    setScriptContext(scriptContext);
  }, [scriptContext, setScriptContext]);

  React.useEffect(() => {
    setPhaseCompletion(phaseCompletion);
  }, [phaseCompletion, setPhaseCompletion]);

  React.useEffect(() => {
    if (wizardStep !== 0) return;
    const filled = scriptContext.designDescriptionTrimmed.length >= TASK_DESCRIPTION_MIN_CHARS;
    const prev = prevTaskDescFilledRef.current;
    prevTaskDescFilledRef.current = filled;
    if (prev === null) return;
    if (prev === filled) return;
    enterPhase(0);
  }, [enterPhase, scriptContext.designDescriptionTrimmed, wizardStep]);

  React.useEffect(() => {
    const subView: TutorBackendSubView = knowledgeBaseActive
      ? 'knowledgeBase'
      : interfaceActive
        ? 'interface'
        : 'main';
    setBackendSubView(subView);
  }, [interfaceActive, knowledgeBaseActive, setBackendSubView]);

  React.useEffect(() => {
    const prev = prevStepRef.current;
    if (prev !== wizardStep) {
      enterPhase(wizardStep as TutorPhaseId);
      prevStepRef.current = wizardStep;
    }
  }, [enterPhase, wizardStep]);

  React.useEffect(() => {
    const phase = wizardStep as TutorPhaseId;
    const aiBusy = generating || useCaseComposerBusy || useCaseBundleGenerationBusy;
    const wasBusy = prevGeneratingRef.current;
    if (aiBusy && !wasBusy) {
      dispatchTransition(phase, 'ai_action_started');
    } else if (!aiBusy && wasBusy) {
      dispatchTransition(phase, 'ai_action_completed');
    }
    prevGeneratingRef.current = aiBusy;
  }, [
    dispatchTransition,
    generating,
    useCaseBundleGenerationBusy,
    useCaseComposerBusy,
    wizardStep,
  ]);

  React.useEffect(() => {
    if (!hydratedRef.current || initialEnterRef.current) return;
    initialEnterRef.current = true;
    enterPhase(wizardStep as TutorPhaseId);
  }, [enterPhase, wizardStep]);

  React.useEffect(() => {
    const handler = (ev: Event): void => {
      const detail = (ev as CustomEvent<TutorUiControlEventDetail>).detail;
      if (!detail?.targetId.startsWith('wizard-step-')) return;
      const idx = parseInt(detail.targetId.replace('wizard-step-', ''), 10);
      if (Number.isInteger(idx) && idx >= 0 && idx <= 6) {
        onSelectWizardStep(idx as AgentWizardStepIndex);
      }
    };
    window.addEventListener(TUTOR_UI_CONTROL_EVENT, handler);
    return () => window.removeEventListener(TUTOR_UI_CONTROL_EVENT, handler);
  }, [onSelectWizardStep]);
}

/** Notifica modifica utente sulla fase corrente. */
export function tutorNotifyUserEdit(phase: TutorPhaseId): void {
  useActiveTutorStore.getState().dispatchTransition(phase, 'user_edit');
}

/** Conferma fase (bottone esplicito). */
export function tutorNotifyPhaseConfirm(phase: TutorPhaseId): void {
  useActiveTutorStore.getState().dispatchTransition(phase, 'phase_confirm_clicked');
}
