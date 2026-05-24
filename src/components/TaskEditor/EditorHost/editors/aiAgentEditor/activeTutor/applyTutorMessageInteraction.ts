/**
 * Active Tutor — handler unificato per chip uiRefs e actions[] cliccabili.
 */

import type {
  TutorStructuredAction,
  TutorStructuredMessage,
  TutorStructuredUiRef,
} from '@domain/activeTutor/tutorStructuredMessage';
import type { TutorPhaseKey } from '@domain/activeTutor/tutorPhaseKey';
import { tutorPhaseIdFromKey } from '@domain/activeTutor/tutorPhaseKey';
import type { AgentWizardStepIndex } from '@domain/aiAgentConstruction/agentConstructionPhase';
import { applyUiRefChipClick } from './applyTutorStructuredAttention';
import { applyTutorStructuredAttention } from './applyTutorStructuredAttention';
import { attentionDismiss } from './attentionModule';
import { uiControl } from './uiControlModule';

export interface TutorMessageInteractionContext {
  readonly phaseKey: TutorPhaseKey;
  readonly onSelectWizardStep: (index: AgentWizardStepIndex) => void;
  readonly onContinue?: () => void;
}

export function applyTutorUiRefInteraction(
  ref: TutorStructuredUiRef,
  ctx: TutorMessageInteractionContext
): void {
  ctx.onSelectWizardStep(tutorPhaseIdFromKey(ctx.phaseKey) as AgentWizardStepIndex);
  applyUiRefChipClick(ref.elementId, ref.type, ctx.phaseKey);
}

export function applyTutorActionInteraction(
  action: TutorStructuredAction,
  ctx: TutorMessageInteractionContext
): void {
  if (action.kind === 'continue' || action.kind === 'dismiss') {
    attentionDismiss();
    ctx.onContinue?.();
    return;
  }

  if (action.elementId) {
    const type = action.type ?? 'glow';
    ctx.onSelectWizardStep(tutorPhaseIdFromKey(ctx.phaseKey) as AgentWizardStepIndex);
    applyUiRefChipClick(action.elementId, type, ctx.phaseKey);
    return;
  }

  attentionDismiss();
}

/** Applica attenzione da messaggio strutturato (blink×2 + persistente). */
export function applyTutorMessageAttention(
  message: TutorStructuredMessage,
  phaseKey: TutorPhaseKey
): void {
  applyTutorStructuredAttention(message, phaseKey);
}

/** Scroll/focus primario da uiActions script (post-append opzionale). */
export function runScriptUiActions(
  targetIds: readonly string[]
): void {
  for (const id of targetIds) {
    uiControl.perform({ action: 'scrollTo', targetId: id });
  }
}
