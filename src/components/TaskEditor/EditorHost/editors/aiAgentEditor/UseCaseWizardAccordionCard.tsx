/**
 * Card accordion use case (header + scenario + messaggio agente): stesso schema del passo Prompts,
 * riusabile in lista wizard e in Gap Analysis State Map.
 */

import React from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Loader2,
  MessageSquareText,
  Wand2,
  X,
} from 'lucide-react';
import { isUseCaseIncludedInConversations, type AIAgentUseCase } from '@types/aiAgentUseCases';
import { getScenarioText, withScenarioText } from '@domain/aiAgentUseCase/scenarioText';
import {
  LABEL_POLISH_USE_CASE_SCENARIO,
  LABEL_POLISH_USE_CASE_SCENARIO_PENDING,
  TOOLTIP_POLISH_USE_CASE_SCENARIO,
} from './constants';
import { UseCaseWizardScenarioDisplay } from './useCaseWizardScenarioDisplay';
import { UseCaseResponseEditor } from './UseCaseResponseEditor';
import type { PatchUseCaseResponseTasksFn } from './usePatchUseCaseResponseTasks';
import {
  applyDesignerFieldVoteToggle,
  type DesignerFieldVote,
  type DesignerVoteField,
} from './useCaseComposerDesignerVotes';
import {
  UC_CLASSIC_TEXTAREA_SCENARIO,
  UC_WIZARD_AGENT_MESSAGE_PANEL,
  UC_WIZARD_CARD_BODY,
  UC_WIZARD_SCENARIO_BLOCK,
  useCaseHeaderTitleTextClass,
} from './useCaseComposerPresentation';

export type UseCaseWizardAccordionCardProps = {
  useCase: AIAgentUseCase;
  busy?: boolean;
  defaultExpanded?: boolean;
  setUseCases: React.Dispatch<React.SetStateAction<AIAgentUseCase[]>>;
  onPatchResponseTasks: PatchUseCaseResponseTasksFn;
  onPolishUseCaseScenario?: (
    useCaseId: string,
    scenarioTextOverride?: string
  ) => void | Promise<void | AIAgentUseCase | null>;
  onAssistantPhraseDraftChange?: (useCaseId: string | null, draft: string | null) => void;
  /** Classi aggiuntive sul contenitore esterno (es. bordo Gap Analysis). */
  className?: string;
};

const scenarioFieldLabel = (
  <span
    title="Scenario"
    aria-label="Scenario"
    className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-violet-300"
  >
    <BookOpen size={15} aria-hidden />
  </span>
);

export function UseCaseWizardAccordionCard({
  useCase,
  busy = false,
  defaultExpanded = true,
  setUseCases,
  onPatchResponseTasks,
  onPolishUseCaseScenario,
  onAssistantPhraseDraftChange,
  className = '',
}: UseCaseWizardAccordionCardProps): React.ReactElement {
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const [payoffEditDraft, setPayoffEditDraft] = React.useState('');
  const [payoffEditing, setPayoffEditing] = React.useState(false);
  const [polishPending, setPolishPending] = React.useState(false);

  const useCaseId = useCase.id;
  const label = String(useCase.label ?? '').trim() || useCaseId;
  const hasAssistant = useCase.dialogue.some((t) => t.role === 'assistant');

  const toggleFieldVote = React.useCallback(
    (field: DesignerVoteField, choice: DesignerFieldVote) => {
      setUseCases((prev) => applyDesignerFieldVoteToggle(prev, useCaseId, field, choice));
    },
    [setUseCases, useCaseId]
  );

  const setPayoffForUseCase = React.useCallback(
    (value: string) => {
      setUseCases((prev) =>
        prev.map((u) =>
          u.id === useCaseId
            ? {
                ...withScenarioText(u, value),
                designer_edit_confirmed: true as const,
                designer_payoff_vote: 'up' as const,
              }
            : u
        )
      );
    },
    [setUseCases, useCaseId]
  );

  const beginPayoffEdit = React.useCallback(() => {
    setPayoffEditDraft(getScenarioText(useCase));
    setPayoffEditing(true);
  }, [useCase]);

  const commitPayoffEdit = React.useCallback(() => {
    setPayoffForUseCase(payoffEditDraft.trim());
    setPayoffEditing(false);
  }, [payoffEditDraft, setPayoffForUseCase]);

  const cancelPayoffEdit = React.useCallback(() => {
    setPayoffEditing(false);
  }, []);

  const scenarioTextForPolish = payoffEditing
    ? payoffEditDraft.trim()
    : getScenarioText(useCase).trim();

  const invokePolish = React.useCallback(async () => {
    if (!onPolishUseCaseScenario || scenarioTextForPolish.length < 8) return;
    setPolishPending(true);
    try {
      const merged = await Promise.resolve(
        onPolishUseCaseScenario(useCaseId, scenarioTextForPolish)
      );
      if (merged && payoffEditing) {
        setPayoffEditDraft(getScenarioText(merged));
      }
    } finally {
      setPolishPending(false);
    }
  }, [onPolishUseCaseScenario, scenarioTextForPolish, useCaseId, payoffEditing]);

  const seedUseCaseResponse = React.useCallback(
    (next: AIAgentUseCase) => {
      setUseCases((prev) => prev.map((x) => (x.id === next.id ? next : x)));
    },
    [setUseCases]
  );

  const titleClass = useCaseHeaderTitleTextClass(
    useCase.designer_label_vote,
    expanded,
    isUseCaseIncludedInConversations(useCase)
  );

  return (
    <div
      className={[
        'overflow-hidden rounded-md border border-slate-600/55 bg-slate-900/50',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        className="flex w-full items-start gap-1.5 px-2 py-1.5 text-left hover:bg-slate-800/70"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="mt-0.5 shrink-0 text-slate-500" aria-hidden>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <GitBranch size={12} className="mt-0.5 shrink-0 opacity-60 text-slate-400" aria-hidden />
        <span className={`min-w-0 flex-1 text-sm leading-snug ${titleClass}`}>{label}</span>
      </button>
      {expanded ? (
        <div
          className={`${UC_WIZARD_CARD_BODY} border-t border-slate-600/50`}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <div className={UC_WIZARD_SCENARIO_BLOCK}>
            {payoffEditing ? (
              <div className="flex flex-wrap items-start gap-2">
                {scenarioFieldLabel}
                <textarea
                  value={payoffEditDraft}
                  onChange={(e) => setPayoffEditDraft(e.target.value)}
                  disabled={busy}
                  rows={2}
                  autoFocus
                  placeholder="Descrizione sintetica dello scenario…"
                  className={`${UC_CLASSIC_TEXTAREA_SCENARIO} min-h-[52px] min-w-0 flex-1`}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      cancelPayoffEdit();
                    }
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      commitPayoffEdit();
                    }
                  }}
                />
                <div className="flex shrink-0 items-center gap-0.5 self-start pt-0.5">
                  {onPolishUseCaseScenario ? (
                    <button
                      type="button"
                      title={
                        polishPending
                          ? LABEL_POLISH_USE_CASE_SCENARIO_PENDING
                          : TOOLTIP_POLISH_USE_CASE_SCENARIO
                      }
                      disabled={busy || polishPending || scenarioTextForPolish.length < 8}
                      className="rounded p-0.5 text-sky-300 hover:bg-slate-800/90 disabled:opacity-40"
                      onClick={() => void invokePolish()}
                    >
                      {polishPending ? (
                        <Loader2 size={14} className="animate-spin" aria-hidden />
                      ) : (
                        <Wand2 size={14} aria-hidden />
                      )}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    title="Conferma"
                    disabled={busy}
                    className="rounded p-0.5 text-emerald-400 hover:bg-slate-800/90 disabled:opacity-40"
                    onClick={commitPayoffEdit}
                  >
                    <Check size={14} aria-hidden />
                  </button>
                  <button
                    type="button"
                    title="Annulla"
                    disabled={busy}
                    className="rounded p-0.5 text-slate-400 hover:bg-slate-800/90 disabled:opacity-40"
                    onClick={cancelPayoffEdit}
                  >
                    <X size={14} aria-hidden />
                  </button>
                </div>
              </div>
            ) : (
              <UseCaseWizardScenarioDisplay
                useCase={useCase}
                busy={busy}
                scenarioFieldLabel={scenarioFieldLabel}
                textClassName=""
                onDoubleClickEdit={beginPayoffEdit}
                onVote={(choice) => toggleFieldVote('payoff', choice)}
                onEditClick={beginPayoffEdit}
                onPolishClick={onPolishUseCaseScenario ? () => void invokePolish() : undefined}
                polishPending={polishPending}
                polishDisabled={scenarioTextForPolish.length < 8}
              />
            )}
          </div>
          <div className={UC_WIZARD_AGENT_MESSAGE_PANEL}>
            {hasAssistant ? (
              <UseCaseResponseEditor
                useCase={useCase}
                onPatchResponseTasks={onPatchResponseTasks}
                onPatchUseCase={(updater) =>
                  setUseCases((prev) => prev.map((x) => (x.id === useCaseId ? updater(x) : x)))
                }
                onSeedUseCase={seedUseCaseResponse}
                onAgentMessageVote={(choice) => toggleFieldVote('agentMessage', choice)}
                onAssistantPhraseDraftChange={onAssistantPhraseDraftChange}
                busy={busy}
              />
            ) : (
              <div className="flex flex-wrap items-center gap-2 px-1 py-1">
                <MessageSquareText
                  size={15}
                  className="shrink-0 text-emerald-300/80"
                  aria-hidden
                />
                <p className="text-xs text-slate-500">Nessun messaggio agente nel dialogo.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
