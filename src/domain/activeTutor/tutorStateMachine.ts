/**
 * Active Tutor — macchina a stati per ogni fase del Construction Wizard.
 */

import type { TutorPhaseId } from './tutorPhase';

/** Stati conmotionati per ogni fase. */
export type TutorPhaseState =
  | 'idle'
  | 'waiting_for_ai'
  | 'ai_completed'
  | 'iterating'
  | 'awaiting_confirmation'
  | 'completed';

export type TutorPhaseStateMap = Readonly<Record<TutorPhaseId, TutorPhaseState>>;

export const TUTOR_INITIAL_PHASE_STATE: TutorPhaseState = 'idle';

export function createInitialPhaseStateMap(): TutorPhaseStateMap {
  return { 0: 'idle', 1: 'idle', 2: 'idle', 3: 'idle', 4: 'idle', 5: 'idle', 6: 'idle' };
}

export type TutorTransitionEvent =
  | 'ai_action_started'
  | 'ai_action_completed'
  | 'user_edit'
  | 'phase_confirm_clicked'
  | 'wizard_step_advanced';

/** Transizioni ufficiali (tabella spec v1). */
export function applyTutorTransition(
  current: TutorPhaseState,
  event: TutorTransitionEvent
): TutorPhaseState {
  switch (event) {
    case 'ai_action_started':
      if (current === 'idle' || current === 'ai_completed' || current === 'iterating') {
        return 'waiting_for_ai';
      }
      return current;

    case 'ai_action_completed':
      if (current === 'waiting_for_ai') return 'ai_completed';
      return current;

    case 'user_edit':
      if (
        current === 'ai_completed' ||
        current === 'iterating' ||
        current === 'awaiting_confirmation'
      ) {
        return 'iterating';
      }
      return current;

    case 'phase_confirm_clicked':
      if (current === 'ai_completed' || current === 'iterating') {
        return 'awaiting_confirmation';
      }
      return current;

    case 'wizard_step_advanced':
      if (current === 'awaiting_confirmation') return 'completed';
      return current;

    default:
      return current;
  }
}

/** True se il tutor deve tacere (no messaggi, no attenzione, no uiControl). */
export function tutorShouldBeSilent(state: TutorPhaseState): boolean {
  return state === 'waiting_for_ai';
}

/** True se attention.trigger è consentito. */
export function tutorAttentionAllowed(state: TutorPhaseState): boolean {
  return state === 'ai_completed' || state === 'iterating';
}

/** True se uiControl.perform è consentito (eccetto guidance in idle). */
export function tutorUiControlAllowed(state: TutorPhaseState): boolean {
  return state === 'ai_completed' || state === 'iterating' || state === 'completed';
}

/** True se focus/glow (guidance, non attention) è consentito in idle. */
export function tutorIdleGuidanceAllowed(state: TutorPhaseState): boolean {
  return state === 'idle';
}
