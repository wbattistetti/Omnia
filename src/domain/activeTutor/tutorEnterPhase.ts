/**
 * Active Tutor — messaggi e attenzione all'ingresso di una tab/fase.
 */

import type { TutorPhaseKey } from './tutorPhaseKey';
import { tutorPhaseIdFromKey } from './tutorPhaseKey';
import {
  TASK_DESCRIPTION_MIN_CHARS,
  TASK_GUIDANCE_EMPTY,
  TASK_GUIDANCE_FILLED,
  TUTOR_INCOMPLETE_PHASE_WARNING,
  TUTOR_PHASE_INTRO,
} from './tutorPhaseIntro';
import type { TutorScriptContext } from './tutorScriptContext';
import { mainUiIdForPhase, tutorPhaseAttentionAllowed } from './tutorPhaseAttention';
import type { TutorPhaseState } from './tutorStateMachine';
import { wizardStepUiId } from './tutorUiIds';

export interface TutorChatMessageLike {
  readonly role: 'tutor' | 'designer';
  readonly text?: string;
  readonly structured?: { readonly body?: string };
}

export interface PhaseEnterPayload {
  readonly introText: string;
  readonly guidanceText?: string;
  readonly warningText?: string;
  readonly attentionTargetId?: string;
  readonly scrollToWizardStep?: boolean;
}

export function buildPhaseEnterPayload(
  phaseKey: TutorPhaseKey,
  phaseState: TutorPhaseState,
  scriptContext: TutorScriptContext,
  phaseComplete: boolean
): PhaseEnterPayload {
  const introText = TUTOR_PHASE_INTRO[phaseKey];
  let guidanceText: string | undefined;
  if (phaseKey === 'task') {
    guidanceText =
      scriptContext.designDescriptionTrimmed.length < TASK_DESCRIPTION_MIN_CHARS
        ? TASK_GUIDANCE_EMPTY
        : TASK_GUIDANCE_FILLED;
  }

  const warningText = phaseComplete ? undefined : TUTOR_INCOMPLETE_PHASE_WARNING;

  const attentionTargetId = tutorPhaseAttentionAllowed(phaseState)
    ? mainUiIdForPhase(phaseKey)
    : undefined;

  return {
    introText,
    guidanceText,
    warningText,
    attentionTargetId,
    scrollToWizardStep: true,
  };
}

export function shouldAppendIntro(
  messages: readonly TutorChatMessageLike[],
  introText: string
): boolean {
  const last = messages[messages.length - 1];
  if (last?.role !== 'tutor') return true;
  const lastBody = (last.text ?? last.structured?.body ?? '').trim();
  return lastBody !== introText.trim();
}

export function wizardStepIdForPhaseKey(phaseKey: TutorPhaseKey): string {
  return wizardStepUiId(tutorPhaseIdFromKey(phaseKey));
}
