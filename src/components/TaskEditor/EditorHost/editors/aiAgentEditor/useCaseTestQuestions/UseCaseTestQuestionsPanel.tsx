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
  appendUniqueTestQuestions,
  createManualTestQuestion,
  normalizeTestQuestionText,
  sortTestQuestionsByText,
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
  'inline-flex h-5 shrink-0 cursor-pointer items-center gap-0.5 rounded px-1.5 text-[9px] font-semibold leading-none transition focus:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-45';

const PASSED_CHIP_MUTED =
  'border border-emerald-800/25 bg-emerald-950/25 text-emerald-800/35 shadow-none hover:bg-emerald-950/40 dark:border-emerald-700/20 dark:bg-emerald-950/20 dark:text-emerald-600/35 dark:hover:bg-emerald-950/35';
const PASSED_CHIP_ACTIVE =
  'border-0 bg-[#4CAF50] text-white shadow-md hover:brightness-110 focus-visible:ring-[#81C784] ring-1 ring-white/40';

const FAILED_CHIP_MUTED =
  'border border-red-900/25 bg-red-950/25 text-red-900/35 shadow-none hover:bg-red-950/40 dark:border-red-800/20 dark:bg-red-950/20 dark:text-red-600/35 dark:hover:bg-red-950/35';
const FAILED_CHIP_ACTIVE =
  'border-0 bg-[#F44336] text-white shadow-md hover:brightness-110 focus-visible:ring-[#E57373] ring-1 ring-white/40';

const FAILURE_RADIO_CLS = 'h-3.5 w-3.5 shrink-0 accent-sky-400';

const ROW_JUST_ADDED_HIGHLIGHT =
  'ring-2 ring-amber-400/75 bg-amber-950/35 border-amber-500/50';

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
        className={`${VALIDATION_CHIP_BASE} ${
          status === 'ok' ? PASSED_CHIP_ACTIVE : PASSED_CHIP_MUTED
        }`}
        onClick={onPassedClick}
        title={status === 'ok' ? 'Annulla Passed' : 'Segna come Passed'}
      >
        <Check size={10} strokeWidth={2.5} className="shrink-0" aria-hidden />
        <span>Passed</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={status === 'ko'}
        className={`${VALIDATION_CHIP_BASE} ${
          status === 'ko' ? FAILED_CHIP_ACTIVE : FAILED_CHIP_MUTED
        }`}
        onClick={onFailedClick}
        title={status === 'ko' ? 'Annulla Failed' : 'Segna come Failed'}
      >
        <X size={10} strokeWidth={2.5} className="shrink-0" aria-hidden />
        <span>Failed</span>
      </button>
    </div>
  );
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

type FailureMode = 'misinterpreted' | 'altro' | null;

type QuestionRowProps = {
  question: UseCaseTestQuestion;
  ownerUseCaseId: string;
  useCaseCatalog: readonly UseCaseCatalogEntry[];
  disabled?: boolean;
  lens: TestQuestionLens | null;
  highlighted?: boolean;
  onPatch: (id: string, patch: Partial<UseCaseTestQuestion>) => void;
  onDelete: (id: string) => void;
};

function TestQuestionRow({
  question,
  ownerUseCaseId,
  useCaseCatalog,
  disabled,
  lens,
  highlighted = false,
  onPatch,
  onDelete,
}: QuestionRowProps): React.ReactElement {
  const [editing, setEditing] = React.useState(false);
  const [draftText, setDraftText] = React.useState(question.text);
  const [notPassedOpen, setNotPassedOpen] = React.useState(false);
  const [misinterpretedUseCaseId, setMisinterpretedUseCaseId] = React.useState<string | null>(
    null
  );
  const [useCasePickerOpen, setUseCasePickerOpen] = React.useState(false);
  const [failureMode, setFailureMode] = React.useState<FailureMode>(null);
  const [altroDraft, setAltroDraft] = React.useState('');

  const otherUseCases = React.useMemo(
    () => useCaseCatalog.filter((e) => e.id !== ownerUseCaseId),
    [useCaseCatalog, ownerUseCaseId]
  );
  const selectedMisinterpreted = otherUseCases.find((e) => e.id === misinterpretedUseCaseId);
  const misinterpretedLabel = selectedMisinterpreted
    ? catalogEntryDisplayLabel(selectedMisinterpreted)
    : null;

  React.useEffect(() => {
    if (!editing) setDraftText(question.text);
  }, [question.text, editing]);

  React.useEffect(() => {
    if (question.status === 'ko') {
      setNotPassedOpen(true);
    } else {
      setNotPassedOpen(false);
      setMisinterpretedUseCaseId(null);
      setUseCasePickerOpen(false);
      setFailureMode(null);
      setAltroDraft('');
    }
  }, [question.status]);

  const commitEdit = () => {
    const text = draftText.trim();
    if (!text) return;
    onPatch(question.id, { text });
    setEditing(false);
  };

  const resetNotPassedFlow = (): void => {
    setNotPassedOpen(false);
    setMisinterpretedUseCaseId(null);
    setUseCasePickerOpen(false);
    setFailureMode(null);
    setAltroDraft('');
  };

  const onPassedClick = (): void => {
    if (question.status === 'ok') {
      onPatch(question.id, { status: 'pending' });
      resetNotPassedFlow();
      return;
    }
    onPatch(question.id, { status: 'ok' });
    resetNotPassedFlow();
  };

  const onFailedClick = (): void => {
    if (question.status === 'ko') {
      onPatch(question.id, { status: 'pending' });
      resetNotPassedFlow();
      return;
    }
    onPatch(question.id, { status: 'ko' });
    setNotPassedOpen(true);
    setMisinterpretedUseCaseId(null);
    setUseCasePickerOpen(false);
    setFailureMode('misinterpreted');
    setAltroDraft('');
  };

  const onPickMisinterpretedUseCase = (useCaseId: string): void => {
    setMisinterpretedUseCaseId(useCaseId);
    setUseCasePickerOpen(false);
    setFailureMode('misinterpreted');
    setAltroDraft('');
    handleFailureUseCaseRadioClick(useCaseId);
  };

  const onAltroModeSelect = (): void => {
    setFailureMode('altro');
    setMisinterpretedUseCaseId(null);
    setUseCasePickerOpen(false);
    handleFailureAltroRadioClick();
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
        highlighted ? ROW_JUST_ADDED_HIGHLIGHT : questionHighlightClass(question.status, lens),
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
          <div className="flex min-w-0 w-full flex-wrap items-center gap-x-1.5 gap-y-1">
            <TestQuestionIcon />
            <span
              className={`inline whitespace-pre-wrap leading-snug ${UC_WIZARD_TEST_QUESTION_TEXT}`}
            >
              {question.text}
            </span>
            <span
              className={`${ROW_ACTIONS} ms-0.5 inline-flex items-center gap-0.5 align-middle`}
            >
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
            </span>
          </div>

          {notPassedOpen ? (
            <div className="mt-1.5 space-y-1.5 border-t border-slate-700/40 pt-1.5">
              <div
                className="flex max-w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-amber-500/35 bg-amber-950/40 px-2 py-1 text-[11px] leading-snug text-amber-100/95"
                role="status"
              >
                <span className="shrink-0 font-medium text-amber-200/90">Ha interpretato come</span>
                <label className="inline-flex min-w-0 max-w-[min(100%,14rem)] cursor-pointer items-center gap-1.5">
                  <input
                    type="radio"
                    name={`test-q-failure-mode-${question.id}`}
                    className={FAILURE_RADIO_CLS}
                    checked={failureMode === 'misinterpreted'}
                    disabled={disabled}
                    onChange={() => {
                      setFailureMode('misinterpreted');
                      setAltroDraft('');
                      setUseCasePickerOpen(true);
                    }}
                  />
                  <button
                    type="button"
                    disabled={disabled || failureMode === 'altro'}
                    onClick={(e) => {
                      e.preventDefault();
                      setFailureMode('misinterpreted');
                      setAltroDraft('');
                      setUseCasePickerOpen((open) => !open);
                    }}
                    className="min-w-0 truncate rounded border border-amber-400/45 bg-amber-900/50 px-1.5 py-px font-medium text-amber-50 underline-offset-2 hover:bg-amber-800/60 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    title={
                      misinterpretedLabel
                        ? 'Cambia use case interpretato'
                        : 'Scegli quale altro use case ha interpretato l’agente'
                    }
                  >
                    {misinterpretedLabel ?? 'Altro use case'}
                  </button>
                </label>
                <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5">
                  <input
                    type="radio"
                    name={`test-q-failure-mode-${question.id}`}
                    className={FAILURE_RADIO_CLS}
                    checked={failureMode === 'altro'}
                    disabled={disabled}
                    onChange={onAltroModeSelect}
                  />
                  <span>altro</span>
                </label>
              </div>

              {useCasePickerOpen && failureMode === 'misinterpreted' ? (
                <ul
                  className="max-h-40 space-y-0.5 overflow-y-auto rounded-md border border-slate-600/50 bg-slate-900/90 py-1"
                  role="listbox"
                  aria-label="Altri use case del catalogo"
                >
                  {otherUseCases.length === 0 ? (
                    <li className="px-2 py-1 text-[11px] text-slate-500">Nessun altro use case.</li>
                  ) : (
                    otherUseCases.map((entry) => (
                      <li key={entry.id}>
                        <button
                          type="button"
                          disabled={disabled}
                          role="option"
                          aria-selected={misinterpretedUseCaseId === entry.id}
                          className="block w-full truncate px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-violet-900/45 disabled:opacity-50"
                          onClick={() => onPickMisinterpretedUseCase(entry.id)}
                        >
                          {catalogEntryDisplayLabel(entry)}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}

              {failureMode === 'altro' ? (
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
  const sortedQuestions = React.useMemo(
    () => sortTestQuestionsByText(questions),
    [questions]
  );
  const forceOpen = Boolean(lens && questions.some((q) => q.status === lens));
  const [open, setOpen] = React.useState(questions.length > 0);
  const [manualComposerOpen, setManualComposerOpen] = React.useState(false);
  const [manualDraft, setManualDraft] = React.useState('');
  const [highlightedQuestionId, setHighlightedQuestionId] = React.useState<string | null>(
    null
  );
  const manualInputRef = React.useRef<HTMLInputElement>(null);
  const listBodyRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  React.useEffect(() => {
    if (!manualComposerOpen) return;
    const t = window.setTimeout(() => manualInputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [manualComposerOpen]);

  React.useEffect(() => {
    if (!highlightedQuestionId) return;
    const row = listBodyRef.current?.querySelector(
      `[data-test-question-id="${CSS.escape(highlightedQuestionId)}"]`
    );
    if (row instanceof HTMLElement) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    const clear = window.setTimeout(() => setHighlightedQuestionId(null), 3200);
    return () => window.clearTimeout(clear);
  }, [highlightedQuestionId, sortedQuestions]);

  const setSortedQuestions = (next: readonly UseCaseTestQuestion[]) => {
    onPatchUseCase((uc) => ({
      ...uc,
      testQuestions: sortTestQuestionsByText(next),
    }));
  };

  const patchQuestion = (id: string, patch: Partial<UseCaseTestQuestion>) => {
    onPatchUseCase((uc) => ({
      ...uc,
      testQuestions: sortTestQuestionsByText(
        (uc.testQuestions ?? []).map((q) => (q.id === id ? { ...q, ...patch } : q))
      ),
    }));
  };

  const deleteQuestion = (id: string) => {
    onPatchUseCase((uc) => ({
      ...uc,
      testQuestions: (uc.testQuestions ?? []).filter((q) => q.id !== id),
    }));
  };

  const openManualComposer = (): void => {
    setOpen(true);
    setManualComposerOpen(true);
  };

  const commitManualQuestion = (): void => {
    const created = createManualTestQuestion(manualDraft);
    if (!created) return;
    const beforeLen = questions.length;
    const merged = appendUniqueTestQuestions(questions, [created]);
    if (merged.length === beforeLen) return;
    const key = normalizeTestQuestionText(created.text);
    const hit = merged.find((q) => normalizeTestQuestionText(q.text) === key);
    setSortedQuestions(merged);
    setHighlightedQuestionId(hit?.id ?? created.id);
    setManualDraft('');
    setManualComposerOpen(false);
  };

  const expanded = open || forceOpen;

  return (
    <div className="mt-2 overflow-hidden rounded-md border border-cyan-500/20 bg-cyan-950/10">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2.5 py-2">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex shrink-0 items-center gap-1 text-left text-xs font-semibold text-cyan-100/95 hover:bg-cyan-950/20 rounded px-0.5 -mx-0.5"
        >
          <span>Domande di Test ({questions.length})</span>
          <ChevronDown
            size={14}
            className={['shrink-0 transition-transform', expanded ? 'rotate-180' : ''].join(' ')}
            aria-hidden
          />
        </button>
        <button
          type="button"
          disabled={disabled}
          title="Aggiungi una domanda di test"
          onClick={(e) => {
            e.stopPropagation();
            openManualComposer();
          }}
          className="inline-flex shrink-0 items-center rounded border border-cyan-500/35 bg-cyan-950/40 px-2 py-0.5 text-[10px] font-medium leading-snug text-cyan-100/95 hover:bg-cyan-900/55 disabled:opacity-40"
        >
          aggiungi domanda
        </button>
      </div>
      {expanded ? (
        <div
          ref={listBodyRef}
          className="space-y-1.5 border-t border-cyan-500/15 px-2.5 pb-2 pt-1.5"
        >
          {manualComposerOpen ? (
            <div className="flex items-center gap-2 rounded-md border border-cyan-500/30 bg-slate-900/50 px-2 py-1.5">
              <TestQuestionIcon />
              <input
                ref={manualInputRef}
                type="text"
                value={manualDraft}
                disabled={disabled}
                onChange={(e) => setManualDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitManualQuestion();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setManualComposerOpen(false);
                    setManualDraft('');
                  }
                }}
                placeholder="Inserisci la domanda di test"
                className={`min-w-0 flex-1 rounded-md border border-sky-500/40 bg-slate-950/90 px-2 py-1 ${UC_WIZARD_TEST_QUESTION_TEXT} placeholder:text-sky-400/45 focus:outline-none focus:ring-2 focus:ring-sky-500/45 disabled:opacity-60`}
              />
            </div>
          ) : null}

          {sortedQuestions.length === 0 ? (
            <p className="text-[11px] text-slate-500">
              Nessuna domanda. Usa «aggiungi domanda» qui o «Genera Domande di Test» nella toolbar.
            </p>
          ) : (
            sortedQuestions.map((q) => (
              <TestQuestionRow
                key={q.id}
                question={q}
                ownerUseCaseId={useCase.id}
                useCaseCatalog={useCaseCatalog}
                disabled={disabled}
                lens={lens}
                highlighted={highlightedQuestionId === q.id}
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
