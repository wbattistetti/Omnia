/**
 * Active Tutor — applica attenzione UI per fase (blink×2 + bordo persistente).
 */

import type { TutorAttentionEffectType } from '@domain/activeTutor/tutorQuestionAttention';
import { dispatchTutorEnsureView } from '@domain/activeTutor/tutorEnsureView';
import { tutorDomSelector, wizardStepUiId } from '@domain/activeTutor/tutorUiIds';
import type { TutorPhaseKey } from '@domain/activeTutor/tutorPhaseKey';
import { tutorPhaseIdFromKey } from '@domain/activeTutor/tutorPhaseKey';
import { mainUiIdForPhase } from '@domain/activeTutor/tutorPhaseAttention';
import { attentionDismiss, attentionExplainElement } from './attentionModule';
import { uiControl, TUTOR_UI_CONTROL_EVENT } from './uiControlModule';

const RETRY_MS = 150;
const VIEW_OPEN_MS = 320;

export function openWizardStepForPhase(phaseKey: TutorPhaseKey): void {
  const stepId = wizardStepUiId(tutorPhaseIdFromKey(phaseKey));
  uiControl.perform({ action: 'openTab', targetId: stepId });
}

function explainWithRetry(
  elementId: string,
  type: TutorAttentionEffectType = 'blink'
): void {
  const attempt = (): boolean => {
    uiControl.perform({ action: 'scrollTo', targetId: elementId });
    return attentionExplainElement(elementId, type === 'pulse' ? 'pulse' : type === 'glow' ? 'glow' : 'blink');
  };
  window.requestAnimationFrame(() => {
    if (attempt()) return;
    window.setTimeout(() => {
      attempt();
    }, RETRY_MS);
  });
}

export function applyPhaseMainAttention(phaseKey: TutorPhaseKey): void {
  const elementId = mainUiIdForPhase(phaseKey);
  attentionDismiss();
  openWizardStepForPhase(phaseKey);
  explainWithRetry(elementId, 'blink');
}

export function scrollToPhaseMainElement(phaseKey: TutorPhaseKey): void {
  const elementId = mainUiIdForPhase(phaseKey);
  uiControl.perform({ action: 'scrollTo', targetId: elementId });
}

/** Post-AI: attenzione unificata explainElement. */
export function applyPostAiAttention(
  phaseKey: TutorPhaseKey,
  targetId: string,
  type: TutorAttentionEffectType = 'blink'
): void {
  attentionDismiss();
  openWizardStepForPhase(phaseKey);
  explainWithRetry(targetId, type);
}

export { TUTOR_UI_CONTROL_EVENT, tutorDomSelector };
