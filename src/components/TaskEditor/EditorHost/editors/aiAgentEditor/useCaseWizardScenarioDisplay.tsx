/**
 * Scenario body in wizard use-case cards: optional Human + LLM blocks (toolbar-driven).
 */

import React from 'react';
import { Pencil } from 'lucide-react';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import {
  getScenarioDescrittivoText,
  getScenarioLlmText,
} from '@domain/aiAgentUseCase/scenarioText';
import { VoteThumbPair } from './VoteThumbPair';
import {
  UC_SCENARIO_BODY_TEXT,
  UC_SCENARIO_ROW_EDIT_BTN,
  UC_SCENARIO_VOTE_BTN,
  UC_WIZARD_SCENARIO_TEXT,
} from './useCaseComposerPresentation';

export type UseCaseWizardScenarioDisplayProps = {
  useCase: AIAgentUseCase;
  busy: boolean;
  showHuman: boolean;
  showLlm: boolean;
  scenarioFieldLabel: React.ReactNode;
  textClassName: string;
  onDoubleClickEdit: () => void;
  onVote: (choice: 'up' | 'down') => void;
  onEditClick: () => void;
};

export function UseCaseWizardScenarioDisplay({
  useCase,
  busy,
  showHuman,
  showLlm,
  scenarioFieldLabel,
  textClassName,
  onDoubleClickEdit,
  onVote,
  onEditClick,
}: UseCaseWizardScenarioDisplayProps): React.ReactElement {
  const humanText = getScenarioDescrittivoText(useCase);
  const llmText = getScenarioLlmText(useCase);
  const showBoth = showHuman && showLlm;
  const anyFormat = showHuman || showLlm;

  return (
    <div
      className={[
        'group/payoff-row flex w-full min-w-0 rounded px-0.5 py-0',
        showHuman ? 'cursor-pointer' : '',
      ].join(' ')}
      onDoubleClick={(e) => {
        if (!showHuman || busy) return;
        if ((e.target as HTMLElement).closest('button')) return;
        e.preventDefault();
        e.stopPropagation();
        onDoubleClickEdit();
      }}
    >
      <div className="flex min-w-0 w-full flex-wrap items-start gap-x-1.5 gap-y-1">
        {scenarioFieldLabel}
        <div className="min-w-0 flex-1 flex flex-col gap-y-2 text-sm leading-snug">
          {!anyFormat ? (
            <span className="text-slate-500">— seleziona Human o LLM nella toolbar</span>
          ) : null}
          {showHuman ? (
            <div className="min-w-0">
              {showBoth ? (
                <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-sky-300/80">
                  Human
                </span>
              ) : null}
              <span
                className={`inline whitespace-pre-wrap ${UC_SCENARIO_BODY_TEXT} ${UC_WIZARD_SCENARIO_TEXT}`}
              >
                {humanText.trim() ? (
                  humanText
                ) : (
                  <span className="text-slate-500">
                    — passa il mouse e usa la matita a destra
                  </span>
                )}
              </span>
              <span className="ms-1 inline-flex shrink-0 items-center gap-0.5 align-middle">
                <VoteThumbPair
                  vote={useCase.designer_payoff_vote}
                  disabled={busy}
                  outerBtnClass={UC_SCENARIO_VOTE_BTN}
                  onVote={onVote}
                />
                <button
                  type="button"
                  disabled={busy}
                  title="Modifica scenario"
                  className={UC_SCENARIO_ROW_EDIT_BTN}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditClick();
                  }}
                >
                  <Pencil size={12} aria-hidden />
                </button>
              </span>
            </div>
          ) : null}
          {showLlm ? (
            <div className="min-w-0">
              {showBoth ? (
                <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-violet-300/80">
                  LLM
                </span>
              ) : null}
              <span
                className={`inline whitespace-pre-wrap ${UC_SCENARIO_BODY_TEXT} ${UC_WIZARD_SCENARIO_TEXT} ${textClassName}`}
              >
                {llmText.trim() ? (
                  llmText
                ) : (
                  <span className="font-sans text-slate-500">— nessun testo LLM</span>
                )}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
