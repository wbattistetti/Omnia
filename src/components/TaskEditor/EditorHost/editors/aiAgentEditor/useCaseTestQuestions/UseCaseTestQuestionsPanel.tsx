/**
 * Accordion «Domande di Test» per singolo use case (validazione designer).
 */

import React from 'react';
import {
  Check,
  ChevronDown,
  HelpCircle,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import type {
  UseCaseTestQuestion,
  UseCaseTestQuestionStatus,
} from '@domain/aiAgentUseCase/useCaseTestQuestions';
import {
  UC_TEST_QUESTION_TEXTAREA,
  UC_WIZARD_TEST_QUESTION_TEXT,
} from '../useCaseComposerPresentation';
import { formatUseCaseCatalogListLabel } from '@domain/aiAgentUseCase/useCaseCatalogNumber';
import {
  useUseCaseWizardListToolbarOptional,
  type TestQuestionLens,
} from '../useCaseGeneratorWizard/UseCaseWizardListToolbarContext';

const QUESTION_ICON_PX = 20;

const TOOL_BTN =
  'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-800/90 hover:text-slate-200 disabled:opacity-40';

const ROW_ACTIONS =
  'inline-flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/test-q-row:opacity-100 group-focus-within/test-q-row:opacity-100';

/** Chip Passed / Failed compatti in toolbar riga. */
const VALIDATION_CHIP_BASE =
  'inline-flex h-5 shrink-0 cursor-pointer items-center gap-0.5 rounded px-1.5 text-[9px] font-semibold leading-none text-white shadow-sm transition hover:brightness-110 focus:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-45';

const FAILURE_RADIO_CLS = 'h-3.5 w-3.5 shrink-0 accent-sky-400';

export type UseCaseCatalogEntry = {
  readonly id: string;
  readonly label: string;
  readonly catalogNumber?: number;
};

function catalogEntryDisplayLabel(entry: UseCaseCatalogEntry): string {
  return formatUseCaseCatalogListLabel(entry.catalogNumber, entry.label);
}

function questionHighlightClass(
  status: UseCaseTestQuestionStatus,
  lens: TestQuestionLens | null
): string {
  if (!lens || status !== lens) return 'border-slate-700/50 bg-slate-900/30';
  if (lens === 'ok') return 'border-emerald-500/70 bg-emerald-950/30 ring-1 ring-emerald-500/40';
  return 'border-red-500/70 bg-red-950/30 ring-1 ring-red-500/40';
}

function TestQuestionIcon(): React.ReactElement {
  return (
    <HelpCircle
      size={QUESTION_ICON_PX}
      strokeWidth={2}
      className="shrink-0 text-sky-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.55)] dark:text-sky-200"
      aria-hidden
    />
  );
}

function RowValidationChips({
  status,
  disabled,
  onPassedClick,
  onFailedClick,
}: {
  status: UseCaseTestQuestionStatus;
  disabled?: boolean;
  onPassedClick: () => void;
  onFailedClick: () => void;
}): React.ReactElement {
  return (
    <div
      className="inline-flex shrink-0 items-center gap-0.5"
      role="group"
      aria-label="Esito domanda"
    >
      <button
        type="button"
        disabled={disabled}
        aria-pressed={status === 'ok'}
        className={`${VALIDATION_CHIP_BASE} border-0 focus-visible:ring-[#81C784] ${
          status === 'ok' ? 'ring-1 ring-white/35' : ''
        }`}
        style={{ backgroundColor: '#4CAF50' }}
        onClick={onPassedClick}
        title="Passed"
      >
        <Check size={10} strokeWidth={2.5} className="shrink-0 text-white" aria-hidden />
        <span>Passed</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={status === 'ko'}
        className={`${VALIDATION_CHIP_BASE} border-0 focus-visible:ring-[#E57373] ${
          status === 'ko' ? 'ring-1 ring-white/35' : ''
        }`}
        style={{ backgroundColor: '#F44336' }}
        onClick={onFailedClick}
        title="Not passed"
      >
        <X size={10} strokeWidth={2.5} className="shrink-0 text-white" aria-hidden />
        <span>Failed</span>
      </button>
    </div>
  );
}

/** Stub — esito positivo (persistenza in arrivo). */
function handlePassedChipClick(): void {
  /* stub */
}

/** Stub — esito negativo / apertura flusso not passed (persistenza in arrivo). */
function handleFailedChipClick(): void {
  /* stub */
}

/** Stub — scelta use case interpretato erroneamente. */
function handleFailureUseCaseRadioClick(_useCaseId: string): void {
  /* stub */
}

/** Stub — motivo «Altro». */
function handleFailureAltroRadioClick(): void {
  /* stub */
}

/** Stub — testo motivo Altro. */
function handleFailureAltroTextChange(_value: string): void {
  /* stub */
}

type QuestionRowProps = {
  question: UseCaseTestQuestion;
  ownerUseCaseId: string;
  useCaseCatalog: readonly UseCaseCatalogEntry[];
  disabled?: boolean;
  lens: TestQuestionLens | null;
  onPatch: (id: string, patch: Partial<UseCaseTestQuestion>) => void;
  onDelete: (id: string) => void;
};

function formatInterpretedUseCaseList(
  catalog: readonly UseCaseCatalogEntry[],
  ownerUseCaseId: string
): string {
  const labels = catalog
    .filter((e) => e.id !== ownerUseCaseId)
    .map((e) => catalogEntryDisplayLabel(e));
  if (labels.length === 0) return '—';
  return labels.join(', ');
}

function TestQuestionRow({
  question,
  ownerUseCaseId,
  useCaseCatalog,
  disabled,
  lens,
  onPatch,
  onDelete,
}: QuestionRowProps): React.ReactElement {
  const [editing, setEditing] = React.useState(false);
  const [draftText, setDraftText] = React.useState(question.text);
  const [notPassedOpen, setNotPassedOpen] = React.useState(false);
  const [failureRadio, setFailureRadio] = React.useState<string | null>(null);
  const [altroDraft, setAltroDraft] = React.useState('');

  const radioGroupName = `test-q-failure-${question.id}`;
  const altroSelected = failureRadio === 'altro';
  const interpretedList = formatInterpretedUseCaseList(useCaseCatalog, ownerUseCaseId);

  React.useEffect(() => {
    if (!editing) setDraftText(question.text);
  }, [question.text, editing]);

  const commitEdit = () => {
    const text = draftText.trim();
    if (!text) return;
    onPatch(question.id, { text });
    setEditing(false);
  };

  const onPassedClick = (): void => {
    handlePassedChipClick();
    setNotPassedOpen(false);
    setFailureRadio(null);
    setAltroDraft('');
  };

  const onFailedClick = (): void => {
    handleFailedChipClick();
    setNotPassedOpen(true);
  };

  const onFailureRadioChange = (value: string): void => {
    setFailureRadio(value);
    if (value === 'altro') {
      handleFailureAltroRadioClick();
    } else {
      handleFailureUseCaseRadioClick(value);
    }
  };

  const onAltroDraftChange = (value: string): void => {
    setAltroDraft(value);
    handleFailureAltroTextChange(value);
  };

  return (
    <div
      data-test-question-id={question.id}
      className={[
        'group/test-q-row rounded-md border px-2 py-1 transition-colors',
        questionHighlightClass(question.status, lens),
      ].join(' ')}
    >
      {editing ? (
        <div className="flex items-center gap-2">
          <TestQuestionIcon />
          <textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            rows={2}
            autoFocus
            className={`${UC_TEST_QUESTION_TEXTAREA} min-h-[48px] min-w-0 flex-1`}
            placeholder="Domanda di test…"
          />
          <div className="flex shrink-0 items-center gap-0.5">
            <button type="button" className={TOOL_BTN} onClick={commitEdit} title="Salva">
              <Check size={14} aria-hidden />
            </button>
            <button
              type="button"
              className={TOOL_BTN}
              onClick={() => setEditing(false)}
              title="Annulla"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <TestQuestionIcon />
            <p
              className={`min-w-0 flex-1 whitespace-pre-wrap leading-snug ${UC_WIZARD_TEST_QUESTION_TEXT}`}
            >
              {question.text}
            </p>
            <div className={ROW_ACTIONS}>
              <button
                type="button"
                disabled={disabled}
                className={TOOL_BTN}
                title="Modifica"
                onClick={() => setEditing(true)}
              >
                <Pencil size={13} aria-hidden />
              </button>
              <button
                type="button"
                disabled={disabled}
                className={TOOL_BTN}
                title="Elimina"
                onClick={() => onDelete(question.id)}
              >
                <Trash2 size={13} aria-hidden />
              </button>
              <RowValidationChips
                status={question.status}
                disabled={disabled}
                onPassedClick={onPassedClick}
                onFailedClick={onFailedClick}
              />
            </div>
          </div>

          {notPassedOpen ? (
            <div className="mt-1.5 space-y-1.5 border-t border-slate-700/40 pt-1.5">
              <p
                className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-md border border-amber-500/35 bg-amber-950/40 px-2 py-0.5 text-[10px] leading-snug text-amber-100/95"
                role="status"
              >
                <span className="font-medium text-amber-200/90">Ha interpretato come usecase:</span>
                <span>{interpretedList}</span>
              </p>

              <fieldset className="space-y-1" disabled={disabled}>
                <legend className="sr-only">Use case interpretato</legend>
                {useCaseCatalog
                  .filter((e) => e.id !== ownerUseCaseId)
                  .map((entry) => (
                    <label
                      key={entry.id}
                      className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-300"
                    >
                      <input
                        type="radio"
                        name={radioGroupName}
                        className={FAILURE_RADIO_CLS}
                        checked={failureRadio === entry.id}
                        onChange={() => onFailureRadioChange(entry.id)}
                      />
                      <span className="min-w-0 truncate">{catalogEntryDisplayLabel(entry)}</span>
                    </label>
                  ))}
                <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-300">
                  <input
                    type="radio"
                    name={radioGroupName}
                    className={FAILURE_RADIO_CLS}
                    checked={altroSelected}
                    onChange={() => onFailureRadioChange('altro')}
                  />
                  <span>Altro</span>
                </label>
              </fieldset>

              {altroSelected ? (
                <textarea
                  value={altroDraft}
                  disabled={disabled}
                  onChange={(e) => onAltroDraftChange(e.target.value)}
                  rows={3}
                  placeholder="Scrivi perché non consideri passato il test"
                  className={`${UC_TEST_QUESTION_TEXTAREA} block w-full min-h-[72px] border-red-500/35 text-slate-100`}
                />
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export type UseCaseTestQuestionsPanelProps = {
  useCase: AIAgentUseCase;
  /** Catalogo per chip interpretazione e radio «use case». */
  useCaseCatalog?: readonly UseCaseCatalogEntry[];
  disabled?: boolean;
  onPatchUseCase: (updater: (uc: AIAgentUseCase) => AIAgentUseCase) => void;
};

export function UseCaseTestQuestionsPanel({
  useCase,
  useCaseCatalog = [],
  disabled,
  onPatchUseCase,
}: UseCaseTestQuestionsPanelProps): React.ReactElement {
  const ctx = useUseCaseWizardListToolbarOptional();
  const lens = ctx?.testQuestionLens ?? null;
  const questions = useCase.testQuestions ?? [];
  const forceOpen = Boolean(lens && questions.some((q) => q.status === lens));
  const [open, setOpen] = React.useState(questions.length > 0);

  React.useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  const patchQuestion = (id: string, patch: Partial<UseCaseTestQuestion>) => {
    onPatchUseCase((uc) => ({
      ...uc,
      testQuestions: (uc.testQuestions ?? []).map((q) =>
        q.id === id ? { ...q, ...patch } : q
      ),
    }));
  };

  const deleteQuestion = (id: string) => {
    onPatchUseCase((uc) => ({
      ...uc,
      testQuestions: (uc.testQuestions ?? []).filter((q) => q.id !== id),
    }));
  };

  const expanded = open || forceOpen;

  return (
    <div className="mt-2 overflow-hidden rounded-md border border-cyan-500/20 bg-cyan-950/10">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-xs font-semibold text-cyan-100/95 hover:bg-cyan-950/20"
      >
        <span>Domande di Test ({questions.length})</span>
        <ChevronDown
          size={14}
          className={['shrink-0 transition-transform', expanded ? 'rotate-180' : ''].join(' ')}
          aria-hidden
        />
      </button>
      {expanded ? (
        <div className="space-y-1.5 border-t border-cyan-500/15 px-2.5 pb-2 pt-1.5">
          {questions.length === 0 ? (
            <p className="text-[11px] text-slate-500">
              Nessuna domanda. Usa «Genera Domande di Test» nella toolbar.
            </p>
          ) : (
            questions.map((q) => (
              <TestQuestionRow
                key={q.id}
                question={q}
                ownerUseCaseId={useCase.id}
                useCaseCatalog={useCaseCatalog}
                disabled={disabled}
                lens={lens}
                onPatch={patchQuestion}
                onDelete={deleteQuestion}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
