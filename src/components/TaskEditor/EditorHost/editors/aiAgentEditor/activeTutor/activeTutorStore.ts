/**
 * Active Tutor — store Zustand: conversazioni strutturate per tab, routing, sync fase.
 */

import { createWithEqualityFn } from 'zustand/traditional';
import type { TutorPhaseId, TutorBackendSubView } from '@domain/activeTutor/tutorPhase';
import {
  applyTutorTransition,
  createInitialPhaseStateMap,
  type TutorPhaseStateMap,
  type TutorTransitionEvent,
} from '@domain/activeTutor/tutorStateMachine';
import {
  TUTOR_CONTINUE_STRUCTURED,
  TUTOR_OUT_OF_MANUAL_STRUCTURED,
  TUTOR_WELCOME_STRUCTURED,
} from '@domain/activeTutor/tutorScripts';
import {
  tutorStructuredPlainText,
  type TutorStructuredMessage,
} from '@domain/activeTutor/tutorStructuredMessage';
import { tutorStructuredFromScriptMessage } from '@domain/activeTutor/tutorStructuredFromScript';
import { mainUiIdForPhase } from '@domain/activeTutor/tutorPhaseAttention';
import {
  EMPTY_TUTOR_SCRIPT_CONTEXT,
  type TutorScriptContext,
} from '@domain/activeTutor/tutorScriptContext';
import {
  createEmptyConversations,
  tutorPhaseKeyFromId,
  tutorPhaseIdFromKey,
  type TutorPhaseKey,
} from '@domain/activeTutor/tutorPhaseKey';
import { resolveTutorStickyPanelContent } from '@domain/activeTutor/tutorStickyPanel';
import { routeTutorQuestion } from '@domain/activeTutor/tutorQuestionRouter';
import { TUTOR_PHASE_LABELS } from '@domain/activeTutor/tutorPhase';
import { openWizardStepForPhase } from './applyPhaseAttention';
import { applyTutorStructuredAttention } from './applyTutorStructuredAttention';
import { attentionDismiss } from './attentionModule';

export type TutorChatRole = 'tutor' | 'designer';

export interface TutorChatMessage {
  readonly id: string;
  readonly role: TutorChatRole;
  /** Domande designer (testo libero). */
  readonly text?: string;
  /** Risposte tutor (schema ufficiale). */
  readonly structured?: TutorStructuredMessage;
  readonly timestamp: number;
}

export type TutorConversations = Record<TutorPhaseKey, TutorChatMessage[]>;

export interface ActiveTutorStore {
  activePhase: TutorPhaseId;
  phaseStates: TutorPhaseStateMap;
  backendSubView: TutorBackendSubView;
  scriptContext: TutorScriptContext;
  conversations: TutorConversations;
  phaseCompletion: readonly boolean[];
  qaBusy: boolean;
  sessionTaskId: string | null;

  setSessionTaskId: (taskId: string | null) => void;
  setScriptContext: (context: TutorScriptContext) => void;
  setPhaseCompletion: (completion: readonly boolean[]) => void;
  setBackendSubView: (subView: TutorBackendSubView) => void;
  dispatchTransition: (phase: TutorPhaseId, event: TutorTransitionEvent) => void;
  enterPhase: (phase: TutorPhaseId, opts?: { applyAttention?: boolean }) => void;
  onTutorTabClick: (phase: TutorPhaseId) => void;
  appendDesignerMessage: (phaseKey: TutorPhaseKey, text: string) => void;
  appendStructuredTutorMessage: (
    phaseKey: TutorPhaseKey,
    message: TutorStructuredMessage,
    opts?: { applyAttention?: boolean }
  ) => void;
  submitUserQuestion: (
    question: string,
    answerHandler: (
      targetPhaseKey: TutorPhaseKey,
      question: string,
      detectedPhaseKey: TutorPhaseKey
    ) => Promise<TutorStructuredMessage | null>
  ) => Promise<void>;
  appendPostAiMessage: (phase: TutorPhaseId, text: string) => void;
  setQaBusy: (busy: boolean) => void;
  resetForTask: (taskId: string) => void;
  hydrateFromSession: (taskId: string) => void;
  persistToSession: () => void;
  appendWelcomeIfNeeded: (alreadyAcknowledged: boolean) => void;
}

let messageCounter = 0;

function nextMessageId(): string {
  messageCounter += 1;
  return `tutor-msg-${messageCounter}-${Date.now()}`;
}

function sessionKey(taskId: string): string {
  return `omnia.activeTutor.v4:${taskId}`;
}

interface PersistedTutorSessionV3 {
  phaseStates: TutorPhaseStateMap;
  activePhase: TutorPhaseId;
  conversations: TutorConversations;
}

function emptyConversations(): TutorConversations {
  return createEmptyConversations() as TutorConversations;
}

function loadSession(taskId: string): PersistedTutorSessionV3 | null {
  try {
    const raw = sessionStorage.getItem(sessionKey(taskId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedTutorSessionV3;
    if (!parsed.conversations || typeof parsed.activePhase !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveSession(taskId: string, data: PersistedTutorSessionV3): void {
  try {
    sessionStorage.setItem(sessionKey(taskId), JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

function appendDesigner(
  conversations: TutorConversations,
  phaseKey: TutorPhaseKey,
  text: string
): TutorConversations {
  const trimmed = text.trim();
  if (!trimmed) return conversations;
  return {
    ...conversations,
    [phaseKey]: [
      ...conversations[phaseKey],
      { id: nextMessageId(), role: 'designer', text: trimmed, timestamp: Date.now() },
    ],
  };
}

function appendStructured(
  conversations: TutorConversations,
  phaseKey: TutorPhaseKey,
  message: TutorStructuredMessage
): TutorConversations {
  return {
    ...conversations,
    [phaseKey]: [
      ...conversations[phaseKey],
      { id: nextMessageId(), role: 'tutor', structured: message, timestamp: Date.now() },
    ],
  };
}

export const useActiveTutorStore = createWithEqualityFn<ActiveTutorStore>((set, get) => ({
  activePhase: 0,
  phaseStates: createInitialPhaseStateMap(),
  backendSubView: 'main',
  scriptContext: EMPTY_TUTOR_SCRIPT_CONTEXT,
  conversations: emptyConversations(),
  phaseCompletion: [false, false, false, false, false, false, false],
  qaBusy: false,
  sessionTaskId: null,

  setSessionTaskId: (taskId) => set({ sessionTaskId: taskId }),

  setScriptContext: (context) => set({ scriptContext: context }),

  setPhaseCompletion: (completion) => set({ phaseCompletion: completion }),

  setBackendSubView: (subView) => set({ backendSubView: subView }),

  dispatchTransition: (phase, event) => {
    set((s) => {
      const current = s.phaseStates[phase];
      const next = applyTutorTransition(current, event);
      if (next === current) return s;
      return { phaseStates: { ...s.phaseStates, [phase]: next } };
    });
    get().persistToSession();

    if (event === 'ai_action_completed' && phase === get().activePhase) {
      const { phaseStates, backendSubView, scriptContext, phaseCompletion } = get();
      const sticky = resolveTutorStickyPanelContent({
        phase,
        phaseKey: tutorPhaseKeyFromId(phase),
        phaseState: phaseStates[phase],
        backendSubView,
        scriptContext,
        phaseComplete: phaseCompletion[phase] === true,
      });
      if (sticky.stateMessage) {
        applyTutorStructuredAttention(sticky.stateMessage, tutorPhaseKeyFromId(phase));
      }
    }
  },

  enterPhase: (phase, opts = {}) => {
    attentionDismiss();
    const phaseKey = tutorPhaseKeyFromId(phase);
    const { phaseStates, scriptContext, phaseCompletion, backendSubView } = get();
    const sticky = resolveTutorStickyPanelContent({
      phase,
      phaseKey,
      phaseState: phaseStates[phase],
      backendSubView,
      scriptContext,
      phaseComplete: phaseCompletion[phase] === true,
    });

    set({ activePhase: phase });
    get().persistToSession();

    if (opts.applyAttention !== false && sticky.stateMessage) {
      applyTutorStructuredAttention(sticky.stateMessage, phaseKey);
    }
  },

  onTutorTabClick: (phase) => {
    get().enterPhase(phase);
  },

  appendDesignerMessage: (phaseKey, text) => {
    set((s) => ({
      conversations: appendDesigner(s.conversations, phaseKey, text),
    }));
    get().persistToSession();
  },

  appendStructuredTutorMessage: (phaseKey, message, opts = {}) => {
    attentionDismiss();
    set((s) => ({
      conversations: appendStructured(s.conversations, phaseKey, message),
    }));
    get().persistToSession();
    if (opts.applyAttention !== false) {
      applyTutorStructuredAttention(message, phaseKey);
    }
  },

  submitUserQuestion: async (question, answerHandler) => {
    const trimmed = question.trim();
    if (!trimmed) return;

    const activeKeyAtSubmit = tutorPhaseKeyFromId(get().activePhase);
    const route = routeTutorQuestion(trimmed, activeKeyAtSubmit);
    const targetKey = route.detectedPhase;
    const targetPhase = tutorPhaseIdFromKey(targetKey);

    if (!route.belongsToActivePhase && get().activePhase !== targetPhase) {
      set({ activePhase: targetPhase });
      openWizardStepForPhase(targetKey);
    }

    get().appendDesignerMessage(targetKey, trimmed);

    get().setQaBusy(true);
    try {
      const structured = await answerHandler(targetKey, trimmed, route.detectedPhase);
      if (structured) {
        get().appendStructuredTutorMessage(targetKey, structured, { applyAttention: true });
        get().appendStructuredTutorMessage(targetKey, TUTOR_CONTINUE_STRUCTURED, {
          applyAttention: false,
        });
      } else {
        get().appendStructuredTutorMessage(targetKey, TUTOR_OUT_OF_MANUAL_STRUCTURED, {
          applyAttention: false,
        });
      }
    } finally {
      get().setQaBusy(false);
    }
  },

  appendPostAiMessage: (phase, text) => {
    const phaseKey = tutorPhaseKeyFromId(phase);
    const structured = tutorStructuredFromScriptMessage(
      { text, attentionTargetId: mainUiIdForPhase(phaseKey), attentionType: 'blink' },
      TUTOR_PHASE_LABELS[phase]
    );
    get().appendStructuredTutorMessage(phaseKey, structured, { applyAttention: true });
  },

  appendWelcomeIfNeeded: (alreadyAcknowledged) => {
    if (alreadyAcknowledged) return;
    const taskKey = tutorPhaseKeyFromId(0);
    const existing = get().conversations[taskKey];
    const hasWelcome = existing.some(
      (m) => m.role === 'tutor' && m.structured?.title === TUTOR_WELCOME_STRUCTURED.title
    );
    if (hasWelcome) return;
    get().appendStructuredTutorMessage(taskKey, TUTOR_WELCOME_STRUCTURED, { applyAttention: true });
  },

  setQaBusy: (busy) => set({ qaBusy: busy }),

  resetForTask: (taskId) => {
    set({
      activePhase: 0,
      phaseStates: createInitialPhaseStateMap(),
      backendSubView: 'main',
      scriptContext: EMPTY_TUTOR_SCRIPT_CONTEXT,
      conversations: emptyConversations(),
      phaseCompletion: [false, false, false, false, false, false, false],
      qaBusy: false,
      sessionTaskId: taskId,
    });
  },

  hydrateFromSession: (taskId) => {
    const saved = loadSession(taskId);
    if (saved) {
      set({
        sessionTaskId: taskId,
        phaseStates: saved.phaseStates,
        activePhase: saved.activePhase,
        conversations: saved.conversations,
      });
      return;
    }
    get().resetForTask(taskId);
  },

  persistToSession: () => {
    const { sessionTaskId, phaseStates, activePhase, conversations } = get();
    if (!sessionTaskId) return;
    saveSession(sessionTaskId, { phaseStates, activePhase, conversations });
  },
}));

/** @deprecated Usare appendStructuredTutorMessage con TUTOR_OUT_OF_MANUAL_STRUCTURED */
export function appendOutOfManualReply(_phaseKey: TutorPhaseKey): void {
  /* no-op: gestito in submitUserQuestion */
}

/** @deprecated Usare appendStructuredTutorMessage con TUTOR_CONTINUE_STRUCTURED */
export function appendContinuePrompt(_phaseKey: TutorPhaseKey): void {
  /* no-op */
}

export function messageDisplayText(m: TutorChatMessage): string {
  if (m.role === 'designer') return m.text ?? '';
  if (m.structured) return tutorStructuredPlainText(m.structured);
  return '';
}
