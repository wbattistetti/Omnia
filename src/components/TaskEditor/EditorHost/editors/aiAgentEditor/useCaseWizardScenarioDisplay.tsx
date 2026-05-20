/**
 * Scenario body in wizard use-case cards: single synthetic scenario block (edit + vote + polish).
 */

import React from 'react';
import { Loader2, Pencil, Wand2 } from 'lucide-react';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { getScenarioText } from '@domain/aiAgentUseCase/scenarioText';
import { VoteThumbPair } from './VoteThumbPair';
import type { DesignerFieldVote } from './useCaseComposerDesignerVotes';
import {
  LABEL_POLISH_USE_CASE_SCENARIO,
  LABEL_POLISH_USE_CASE_SCENARIO_PENDING,
  TOOLTIP_POLISH_USE_CASE_SCENARIO,
} from './constants';
import {
  UC_SCENARIO_BODY_TEXT,
  UC_SCENARIO_ROW_EDIT_BTN,
  UC_SCENARIO_VOTE_BTN,
  UC_WIZARD_SCENARIO_TEXT,
} from './useCaseComposerPresentation';

export type UseCaseWizardScenarioDisplayProps = {
  useCase: AIAgentUseCase;
  busy: boolean;
  scenarioFieldLabel: React.ReactNode;
  textClassName: string;
  onDoubleClickEdit: () => void;
  onVote: (choice: DesignerFieldVote) => void;
  onEditClick: () => void;
  /** Rifinisce forma scenario (stesso significato). */
  onPolishClick?: () => void;
  polishPending?: boolean;
  polishDisabled?: boolean;
};

export function UseCaseWizardScenarioDisplay({
  useCase,
  busy,
  scenarioFieldLabel,
  textClassName,
  onDoubleClickEdit,
  onVote,
  onEditClick,
  onPolishClick,
  polishPending = false,
  polishDisabled = false,
}: UseCaseWizardScenarioDisplayProps): React.ReactElement {
  const scenarioText = getScenarioText(useCase);
  const polishBusy = polishPending;
  const canPolish =
    Boolean(onPolishClick) &&
    !busy &&
    !polishDisabled &&
    scenarioText.trim().length >= 8;

  return (
    <div
      className="group/payoff-row flex w-full min-w-0 cursor-pointer rounded px-0.5 py-0"
      onDoubleClick={(e) => {
        if (busy || polishBusy) return;
        if ((e.target as HTMLElement).closest('button')) return;
        e.preventDefault();
        e.stopPropagation();
        onDoubleClickEdit();
      }}
    >
      <div className="flex min-w-0 w-full flex-wrap items-start gap-x-1.5 gap-y-1">
        {scenarioFieldLabel}
        <div className="min-w-0 flex-1 text-sm leading-snug">
          <span
            className={`inline whitespace-pre-wrap ${UC_SCENARIO_BODY_TEXT} ${UC_WIZARD_SCENARIO_TEXT} ${textClassName}`}
          >
            {scenarioText.trim() ? (
              scenarioText
            ) : (
              <span className="text-slate-500">— passa il mouse e usa la matita a destra</span>
            )}
          </span>
          <span className="ms-1 inline-flex shrink-0 items-center gap-0.5 align-middle">
            <VoteThumbPair
              vote={useCase.designer_payoff_vote}
              disabled={busy || polishBusy}
              outerBtnClass={UC_SCENARIO_VOTE_BTN}
              onVote={onVote}
            />
            {onPolishClick ? (
              <button
                type="button"
                disabled={!canPolish || polishBusy}
                title={
                  polishBusy
                    ? LABEL_POLISH_USE_CASE_SCENARIO_PENDING
                    : TOOLTIP_POLISH_USE_CASE_SCENARIO
                }
                aria-label={LABEL_POLISH_USE_CASE_SCENARIO}
                className={UC_SCENARIO_ROW_EDIT_BTN}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!canPolish || polishBusy) return;
                  onPolishClick();
                }}
              >
                {polishBusy ? (
                  <Loader2 size={12} className="animate-spin" aria-hidden />
                ) : (
                  <Wand2 size={12} aria-hidden />
                )}
              </button>
            ) : null}
            <button
              type="button"
              disabled={busy || polishBusy}
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
      </div>
    </div>
  );
}
