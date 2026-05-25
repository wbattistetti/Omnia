/**
 * Active Tutor — contenuto fisso del pannello sticky per tab (non in cronologia chat).
 */

import type { TutorPhaseId, TutorBackendSubView } from './tutorPhase';
import { TUTOR_PHASE_LABELS } from './tutorPhase';
import type { TutorPhaseState } from './tutorStateMachine';
import type { TutorScriptContext } from './tutorScriptContext';
import { EMPTY_TUTOR_SCRIPT_CONTEXT } from './tutorScriptContext';
import { buildPhaseEnterPayload } from './tutorEnterPhase';
import { getTutorStructuredScript, getTutorScriptMessage } from './tutorScripts';
import {
  TUTOR_CONTINUE_STRUCTURED,
  TUTOR_OUT_OF_MANUAL_STRUCTURED,
  TUTOR_WELCOME_STRUCTURED,
} from './tutorScripts';
import type { TutorStructuredMessage } from './tutorStructuredMessage';
import { tutorPhaseIdFromKey, type TutorPhaseKey } from './tutorPhaseKey';
import {
  TASK_GUIDANCE_EMPTY,
  TASK_GUIDANCE_FILLED,
  TUTOR_INCOMPLETE_PHASE_WARNING,
  TUTOR_PHASE_INTRO,
} from './tutorPhaseIntro';

export interface TutorStickyPanelContent {
  readonly introText: string;
  readonly warningText?: string;
  readonly stateMessage: TutorStructuredMessage | null;
}

export interface TutorStickyPanelParams {
  readonly phase: TutorPhaseId;
  readonly phaseKey: TutorPhaseKey;
  readonly phaseState: TutorPhaseState;
  readonly backendSubView: TutorBackendSubView;
  readonly scriptContext: TutorScriptContext;
  readonly phaseComplete: boolean;
}

/** Contenuto sticky per la tab attiva (ricalcolato, non persistito in chat). */
export function resolveTutorStickyPanelContent(params: TutorStickyPanelParams): TutorStickyPanelContent {
  const payload = buildPhaseEnterPayload(
    params.phaseKey,
    params.phaseState,
    params.scriptContext,
    params.phaseComplete
  );
  const stateMessage = getTutorStructuredScript(
    params.phase,
    params.phaseState,
    params.backendSubView,
    params.scriptContext
  );
  return {
    introText: payload.introText,
    warningText: payload.warningText,
    stateMessage,
  };
}

const TASK_CONTEXT_VARIANTS: readonly TutorScriptContext[] = [
  { designDescriptionTrimmed: '', hasAgentGeneration: false },
  { designDescriptionTrimmed: 'Bozza esistente', hasAgentGeneration: false },
  { designDescriptionTrimmed: 'Bozza esistente', hasAgentGeneration: true },
];

const PHASE_STATES: readonly TutorPhaseState[] = [
  'idle',
  'waiting_for_ai',
  'ai_completed',
  'iterating',
  'awaiting_confirmation',
  'completed',
];

const BACKEND_SUB_VIEWS: readonly TutorBackendSubView[] = ['main', 'interface', 'knowledgeBase'];

/** Corpi testo mai messi in chat (intro, warning, script deterministici di fase). */
export function collectTutorPhaseContextBodies(phaseKey: TutorPhaseKey): ReadonlySet<string> {
  const bodies = new Set<string>();
  const add = (text: string | undefined | null): void => {
    const trimmed = text?.trim();
    if (trimmed) bodies.add(trimmed);
  };

  add(TUTOR_PHASE_INTRO[phaseKey]);
  add(TUTOR_INCOMPLETE_PHASE_WARNING);
  add(TASK_GUIDANCE_EMPTY);
  add(TASK_GUIDANCE_FILLED);

  const phase = tutorPhaseIdFromKey(phaseKey);
  for (const state of PHASE_STATES) {
    for (const subView of BACKEND_SUB_VIEWS) {
      if (phase === 0) {
        for (const ctx of TASK_CONTEXT_VARIANTS) {
          add(getTutorScriptMessage(phase, state, subView, ctx)?.text);
        }
      } else {
        add(getTutorScriptMessage(phase, state, subView, EMPTY_TUTOR_SCRIPT_CONTEXT)?.text);
      }
    }
  }

  return bodies;
}

export interface TutorChatMessageLike {
  readonly role: 'tutor' | 'designer';
  readonly structured?: {
    readonly title?: string;
    readonly body?: string;
  };
}

/** Esclude dalla chat i messaggi di contesto fissi (già mostrati nel pannello sticky). */
export function isTutorPhaseContextChatMessage(
  message: TutorChatMessageLike,
  phaseKey: TutorPhaseKey
): boolean {
  if (message.role !== 'tutor' || !message.structured) return false;

  const title = message.structured.title?.trim() ?? '';
  if (
    title === TUTOR_WELCOME_STRUCTURED.title ||
    title === TUTOR_OUT_OF_MANUAL_STRUCTURED.title ||
    title === TUTOR_CONTINUE_STRUCTURED.title
  ) {
    return false;
  }

  const body = message.structured.body?.trim() ?? '';
  if (!body) return false;

  return collectTutorPhaseContextBodies(phaseKey).has(body);
}

/** Messaggi tutor da mostrare nella chat (domande/risposte ed eventi, non contesto fisso). */
export function filterTutorConversationMessages<T extends TutorChatMessageLike>(
  messages: readonly T[],
  phaseKey: TutorPhaseKey
): readonly T[] {
  return messages.filter((m) => !isTutorPhaseContextChatMessage(m, phaseKey));
}

/** Titolo breve per il pannello sticky. */
export function tutorStickyPanelHeading(phase: TutorPhaseId): string {
  return TUTOR_PHASE_LABELS[phase];
}
