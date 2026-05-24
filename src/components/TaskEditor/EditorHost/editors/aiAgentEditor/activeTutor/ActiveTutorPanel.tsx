/**
 * Active Tutor — pannello chat con messaggi JSON strutturati e chip uiRefs.
 */

import React from 'react';
import { Loader2, Send } from 'lucide-react';
import type { AgentWizardStepIndex } from '@domain/aiAgentConstruction/agentConstructionPhase';
import { TUTOR_PHASE_LABELS, type TutorPhaseId } from '@domain/activeTutor/tutorPhase';
import { tutorPhaseIdFromKey, tutorPhaseKeyFromId, type TutorPhaseKey } from '@domain/activeTutor/tutorPhaseKey';
import {
  askTutorQuestionApi,
  tutorErrorStructured,
  tutorMissingModelStructured,
} from '@services/tutorQuestionApi';
import { useAIProvider } from '@context/AIProviderContext';
import { useAiBusyLabel } from '@hooks/useAiBusyLabel';
import { AI_CALL_PURPOSE } from '@domain/aiCalls/purposes';
import type { TutorStructuredMessage } from '@domain/activeTutor/tutorStructuredMessage';
import {
  useActiveTutorStore,
} from './activeTutorStore';
import { tutorIdProps, UI_IDS } from './uiIds';
import { tutorNotifyPhaseConfirm } from './useActiveTutorSync';
import { TutorTabs } from './TutorTabs';
import { TutorStructuredMessageBubble } from './TutorStructuredMessageBubble';
import {
  applyTutorActionInteraction,
  applyTutorUiRefInteraction,
} from './applyTutorMessageInteraction';
import type { TutorStructuredAction } from '@domain/activeTutor/tutorStructuredMessage';
import { attentionDismiss } from './attentionModule';
import { TutorRobotIcon } from './TutorRobotIcon';

export interface ActiveTutorPanelProps {
  readonly taskId: string;
  readonly taskLabel?: string;
  readonly generating: boolean;
  readonly phaseCompletion: readonly boolean[];
  readonly onSelectWizardStep: (index: AgentWizardStepIndex) => void;
  readonly onAcknowledgeWelcome?: () => void;
}

export function ActiveTutorPanel({
  taskId,
  taskLabel,
  generating,
  phaseCompletion,
  onSelectWizardStep,
  onAcknowledgeWelcome,
}: ActiveTutorPanelProps): React.ReactElement {
  const { provider, model } = useAIProvider();
  const { hasModel } = useAiBusyLabel();

  const conversations = useActiveTutorStore((s) => s.conversations);
  const qaBusy = useActiveTutorStore((s) => s.qaBusy);
  const activePhase = useActiveTutorStore((s) => s.activePhase);
  const phaseStates = useActiveTutorStore((s) => s.phaseStates);
  const enterPhase = useActiveTutorStore((s) => s.enterPhase);
  const submitUserQuestion = useActiveTutorStore((s) => s.submitUserQuestion);
  const appendStructuredTutorMessage = useActiveTutorStore((s) => s.appendStructuredTutorMessage);

  const [draft, setDraft] = React.useState('');
  const panelRef = React.useRef<HTMLElement | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);

  const activeKey = tutorPhaseKeyFromId(activePhase);
  const messages = conversations[activeKey];
  const currentState = phaseStates[activePhase];
  const silent = generating || currentState === 'waiting_for_ai';
  const inputDisabled = silent || qaBusy;

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, qaBusy, activePhase]);

  React.useEffect(() => {
    const onDocPointerDown = (ev: PointerEvent): void => {
      const panel = panelRef.current;
      if (!panel) return;
      if (ev.target instanceof Node && !panel.contains(ev.target)) {
        attentionDismiss();
      }
    };
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, []);

  const onSelectPhase = React.useCallback(
    (phase: TutorPhaseId) => {
      attentionDismiss();
      onSelectWizardStep(phase as AgentWizardStepIndex);
      enterPhase(phase);
    },
    [enterPhase, onSelectWizardStep]
  );

  const interactionCtx = React.useMemo(
    () => ({
      onSelectWizardStep,
      onContinue: onAcknowledgeWelcome,
    }),
    [onAcknowledgeWelcome, onSelectWizardStep]
  );

  const onUiRefChipClick = React.useCallback(
    (phaseKey: TutorPhaseKey, ref: { elementId: string; type: 'glow' | 'blink' | 'pulse' }) => {
      applyTutorUiRefInteraction(ref, { phaseKey, ...interactionCtx });
    },
    [interactionCtx]
  );

  const onActionChipClick = React.useCallback(
    (phaseKey: TutorPhaseKey, action: TutorStructuredAction) => {
      applyTutorActionInteraction(action, { phaseKey, ...interactionCtx });
    },
    [interactionCtx]
  );

  const answerQuestion = React.useCallback(
    async (
      targetPhaseKey: TutorPhaseKey,
      question: string,
      detectedPhaseKey: TutorPhaseKey
    ): Promise<TutorStructuredMessage | null> => {
      const targetPhase = tutorPhaseIdFromKey(targetPhaseKey);
      const targetState = phaseStates[targetPhase];

      if (!hasModel || !model.trim()) {
        appendStructuredTutorMessage(targetPhaseKey, tutorMissingModelStructured(), {
          applyAttention: false,
        });
        return null;
      }

      try {
        const res = await askTutorQuestionApi({
          question,
          currentPhaseLabel: TUTOR_PHASE_LABELS[targetPhase],
          detectedPhaseLabel: TUTOR_PHASE_LABELS[tutorPhaseIdFromKey(detectedPhaseKey)],
          currentState: targetState,
          provider,
          model,
          callMeta: {
            purpose: AI_CALL_PURPOSE.TUTOR_FREE_QUESTION,
            taskId,
            taskLabel: taskLabel ?? '',
          },
        });
        return res.inManual && res.message ? res.message : null;
      } catch (e) {
        appendStructuredTutorMessage(
          targetPhaseKey,
          tutorErrorStructured(
            e instanceof Error ? e.message : 'Non riesco a rispondere in questo momento. Riprova tra poco.'
          ),
          { applyAttention: false }
        );
        return null;
      }
    },
    [appendStructuredTutorMessage, hasModel, model, phaseStates, provider, taskId, taskLabel]
  );

  const submitQuestion = React.useCallback(async () => {
    const q = draft.trim();
    if (!q || inputDisabled) return;
    setDraft('');
    await submitUserQuestion(q, answerQuestion);
  }, [answerQuestion, draft, inputDisabled, submitUserQuestion]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submitQuestion();
    }
  };

  return (
    <aside
      ref={panelRef}
      className="flex h-full min-h-0 w-full flex-col border-l border-slate-700/60 bg-slate-900/95 text-slate-100"
      aria-label="Tutor attivo"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-slate-700/60 px-3 py-2.5">
        <TutorRobotIcon size={22} className="drop-shadow-[0_0_6px_rgba(167,139,250,0.35)]" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-slate-100">Tutor</h3>
          <p className="truncate text-[11px] text-slate-400">
            {TUTOR_PHASE_LABELS[activePhase]} · {currentState.replace(/_/g, ' ')}
          </p>
        </div>
      </header>

      <TutorTabs
        activePhase={activePhase}
        phaseCompletion={phaseCompletion}
        onSelectPhase={onSelectPhase}
      />

      <div
        ref={listRef}
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3"
      >
        {messages.length === 0 ? (
          <p className="text-xs leading-relaxed text-slate-400">
            Sono qui per guidarti passo passo. Ogni tab ha la sua conversazione — chiedi pure su
            qualsiasi fase.
          </p>
        ) : (
          messages.map((m) => {
            if (m.role === 'designer') {
              return (
                <div
                  key={m.id}
                  className="max-w-[95%] self-end rounded-lg bg-slate-800 px-2.5 py-2 text-xs leading-relaxed whitespace-pre-wrap text-slate-100"
                >
                  {m.text}
                </div>
              );
            }
            if (!m.structured) return null;
            return (
              <TutorStructuredMessageBubble
                key={m.id}
                message={m.structured}
                onUiRefClick={(ref) => onUiRefChipClick(activeKey, ref)}
                onActionClick={(action) => onActionChipClick(activeKey, action)}
              />
            );
          })
        )}
        {qaBusy ? (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 size={14} className="animate-spin" aria-hidden />
            Sto cercando nel manuale…
          </div>
        ) : null}
        {silent && !qaBusy ? (
          <p className="text-[11px] italic text-slate-500">
            {generating ? 'Aspetto che l’AI finisca…' : 'In elaborazione…'}
          </p>
        ) : null}
      </div>

      <footer className="shrink-0 border-t border-slate-700/60 p-2">
        <div className="flex items-end gap-2">
          <textarea
            {...tutorIdProps(UI_IDS.tutorChatInput)}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={inputDisabled}
            rows={2}
            placeholder={silent ? 'Attendi…' : 'Fai una domanda…'}
            className="min-h-[2.5rem] flex-1 resize-none rounded-md border border-slate-600/70 bg-slate-950/80 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void submitQuestion()}
            disabled={inputDisabled || !draft.trim()}
            className="inline-flex shrink-0 items-center justify-center rounded-md bg-violet-600 px-2 py-2 text-white hover:bg-violet-500 disabled:opacity-40"
            aria-label="Invia domanda"
          >
            <Send size={14} />
          </button>
        </div>
        {(currentState === 'ai_completed' || currentState === 'iterating') && !silent ? (
          <button
            type="button"
            {...tutorIdProps(UI_IDS.confirmTaskButton)}
            onClick={() => tutorNotifyPhaseConfirm(activePhase)}
            className="mt-1 w-full rounded-md border border-violet-500/50 bg-violet-950/40 px-2 py-1.5 text-[11px] font-medium text-violet-100 hover:bg-violet-900/50"
          >
            Conferma fase {TUTOR_PHASE_LABELS[activePhase]}
          </button>
        ) : null}
      </footer>
    </aside>
  );
}
