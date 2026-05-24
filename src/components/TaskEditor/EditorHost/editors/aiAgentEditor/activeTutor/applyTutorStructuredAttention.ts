/**
 * Active Tutor — applica ensureView + uiRefs da messaggio strutturato LLM/script.
 */

import type { TutorStructuredMessage } from '@domain/activeTutor/tutorStructuredMessage';
import { dispatchTutorEnsureView } from '@domain/activeTutor/tutorEnsureView';
import type { TutorPhaseKey } from '@domain/activeTutor/tutorPhaseKey';
import { openWizardStepForPhase } from './applyPhaseAttention';
import { attentionDismiss, attentionExplainElement } from './attentionModule';
import { uiControl } from './uiControlModule';

const VIEW_OPEN_MS = 320;

export function applyTutorStructuredAttention(
  message: TutorStructuredMessage,
  phaseKey: TutorPhaseKey
): void {
  attentionDismiss();
  openWizardStepForPhase(phaseKey);

  const runRefs = (): void => {
    for (const ref of message.uiRefs) {
      uiControl.perform({ action: 'scrollTo', targetId: ref.elementId });
      attentionExplainElement(ref.elementId, ref.type === 'pulse' ? 'pulse' : ref.type);
    }
  };

  if (message.ensureView) {
    dispatchTutorEnsureView(message.ensureView);
    window.setTimeout(runRefs, VIEW_OPEN_MS);
  } else {
    window.requestAnimationFrame(() => {
      runRefs();
    });
  }
}

export function applyUiRefChipClick(
  elementId: string,
  type: 'glow' | 'blink' | 'pulse',
  phaseKey: TutorPhaseKey
): void {
  attentionDismiss();
  openWizardStepForPhase(phaseKey);
  uiControl.perform({ action: 'scrollTo', targetId: elementId });
  uiControl.perform({ action: 'focus', targetId: elementId });
  attentionExplainElement(elementId, type);
}
