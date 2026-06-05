/**
 * Tab «Documento riformattato»: solo dati puliti; note meta in tab Analisi.
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { useAIProvider } from '@context/AIProviderContext';
import type { StagedKbDocument, KbDocumentPatch } from '@domain/knowledgeBase/kbDocumentTypes';
import type { AiCallMeta } from '@services/aiAgentDesignApi';
import type { KbDocumentAnalysisTaskContext } from '@domain/knowledgeBase/kbDocumentAnalysisApi';
import {
  proposeKbDocumentRestructure,
  refineKbDocumentRestructureWithFeedback,
  type KbRestructureClarificationQuestion,
} from '@domain/knowledgeBase/kbDocumentRestructureApi';
import {
  KB_RESTRUCTURE_APPROVE_RUNTIME_LABEL,
  KB_RESTRUCTURE_DESIGNER_FEEDBACK_LABEL,
  KB_RESTRUCTURE_DESIGNER_FEEDBACK_PLACEHOLDER,
  KB_RESTRUCTURE_EMPTY_HINT,
  KB_RESTRUCTURE_GUIDE,
  KB_RESTRUCTURE_PROPOSE_BUTTON,
  KB_RESTRUCTURE_TABLE_EDIT_HINT,
  KB_RESTRUCTURE_UPDATE_BUTTON,
  KB_RESTRUCTURE_UPDATE_DISABLED_HINT,
  KB_RESTRUCTURE_TAB_LABEL,
  KB_RESTRUCTURE_TAB_ANSWER_QUESTIONS_LABEL,
} from '@domain/knowledgeBase/kbDocumentRestructureGuide';
import {
  canApproveKbDocumentRestructureForRuntime,
  kbDocumentRestructureApprovalIssues,
} from '@domain/knowledgeBase/kbDocumentRestructureHelpers';
import type { KbDocumentSelectorSpec } from '@domain/knowledgeBase/kbSelectorSpec';
import {
  formatSelectorSpecForRefine,
  inferSelectorSpecFromGrid,
  mergeSelectorSpecFromAiAndGrid,
  mergeSelectorSpecWithGrid,
} from '@domain/knowledgeBase/kbSelectorSpec';
import { serializeParsedKbTabular } from '@domain/knowledgeBase/kbRestructuredGridMarkdown';
import {
  isLegacyCombinedRestructureMarkdown,
  splitLegacyRestructuredMarkdown,
  extractRestructuredDataForRuntime,
} from '@domain/knowledgeBase/kbDocumentRestructureSplit';
import { canonicalizeRestructuredTableMarkdown } from '@domain/knowledgeBase/kbRestructureTableCanonical';
import { parseMarkdownPipeTable } from '@domain/knowledgeBase/parseKbTabularText';
import {
  answeredRestructureQuestions,
  allRestructureQuestionsAnswered,
  buildRestructureFeedbackPayload,
  buildRestructureFeedbackSnapshot,
  formatColumnInstructionsForRefine,
  hasPendingRestructureFeedback,
  remapRestructureRowNotes,
  unansweredRestructureQuestions,
} from '@domain/knowledgeBase/kbDocumentRestructureWorkflow';
import { KbAnalysisEditableMonaco } from './KbAnalysisEditableMonaco';
import {
  KbRestructuredDocumentPreview,
  type KbRestructuredTableChangePayload,
} from './KbRestructuredDocumentPreview';
import { KbAutoGrowTextarea } from './KbAutoGrowTextarea';
import { KbRestructureQuestionsPanel, type KbRestructureQuestionsPanelHandle } from './KbRestructureQuestionsPanel';
import { KbSelectorSpecPanel } from './KbSelectorSpecPanel';
import { useKbDocumentContent } from './useKbDocumentContent';
import type { KbRestructureToolbarState } from '@domain/knowledgeBase/kbRestructureToolbarState';

export interface KbDocumentRestructuredTabProps {
  doc: StagedKbDocument;
  projectId?: string;
  disabled?: boolean;
  callMeta?: AiCallMeta;
  taskContext?: KbDocumentAnalysisTaskContext;
  onUpdateDoc: (patch: KbDocumentPatch) => void;
  onToolbarStateChange?: (state: KbRestructureToolbarState | null) => void;
}

type ViewMode = 'preview' | 'edit';

type AgentRestructureResult = {
  documentRestructuredMarkdown: string;
  documentRestructureNotesMarkdown: string;
  clarificationQuestions: KbRestructureClarificationQuestion[];
  selectorSpec?: KbDocumentSelectorSpec;
};

type GridSnapshot = {
  headers: readonly string[];
  rows: readonly (readonly string[])[];
};

function mergeQuestionsWithAnswers(
  incoming: readonly KbRestructureClarificationQuestion[],
  previous: readonly KbRestructureClarificationQuestion[] | undefined
): KbRestructureClarificationQuestion[] {
  const prevById = new Map((previous ?? []).map((q) => [q.id, q]));
  return incoming.map((q) => {
    const prev = prevById.get(q.id);
    return prev?.answer?.trim() ? { ...q, answer: prev.answer } : q;
  });
}

function parseDraftGridSnapshot(markdown: string): GridSnapshot | null {
  const dataMd = extractRestructuredDataForRuntime(markdown);
  const parsed = parseMarkdownPipeTable(dataMd, { maxRows: 500 });
  if (!parsed?.grid) return null;
  return { headers: parsed.grid.headers, rows: parsed.grid.rows };
}

export function KbDocumentRestructuredTab({
  doc,
  projectId,
  disabled = false,
  callMeta,
  taskContext,
  onUpdateDoc,
  onToolbarStateChange,
}: KbDocumentRestructuredTabProps): React.ReactElement {
  const { provider, model } = useAIProvider();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<ViewMode>('preview');
  const [draft, setDraft] = React.useState(doc.documentRestructuredMarkdown);
  const [rowNotes, setRowNotes] = React.useState<Record<string, string>>(
    () => ({ ...(doc.documentRestructureRowNotes ?? {}) })
  );
  const [questions, setQuestions] = React.useState<KbRestructureClarificationQuestion[]>(
    () => [...(doc.documentRestructureQuestions ?? [])]
  );
  const [designerFeedback, setDesignerFeedback] = React.useState(
    doc.documentRestructureDesignerFeedback ?? ''
  );
  const [columnInstructions, setColumnInstructions] = React.useState<Record<string, string>>(
    () => ({ ...(doc.documentRestructureColumnInstructions ?? {}) })
  );
  const [started, setStarted] = React.useState(
    () => Boolean(doc.agentRestructuredBaselineMarkdown?.trim())
  );
  const [selectorSpec, setSelectorSpec] = React.useState<KbDocumentSelectorSpec | null>(
    () => doc.documentSelectorSpec ?? null
  );

  const gridSnapshotRef = React.useRef<GridSnapshot | null>(parseDraftGridSnapshot(doc.documentRestructuredMarkdown));
  const questionsPanelRef = React.useRef<KbRestructureQuestionsPanelHandle>(null);

  React.useEffect(() => {
    setDraft(doc.documentRestructuredMarkdown);
    setError(null);
    setStarted(Boolean(doc.agentRestructuredBaselineMarkdown?.trim()));
    gridSnapshotRef.current = parseDraftGridSnapshot(doc.documentRestructuredMarkdown);
  }, [doc.id, doc.documentRestructuredMarkdown, doc.agentRestructuredBaselineMarkdown]);

  React.useEffect(() => {
    setRowNotes({ ...(doc.documentRestructureRowNotes ?? {}) });
    setQuestions([...(doc.documentRestructureQuestions ?? [])]);
    setDesignerFeedback(doc.documentRestructureDesignerFeedback ?? '');
    setColumnInstructions({ ...(doc.documentRestructureColumnInstructions ?? {}) });
    setSelectorSpec(doc.documentSelectorSpec ?? null);
  }, [doc.id]);

  React.useEffect(() => {
    const snap = parseDraftGridSnapshot(draft);
    if (snap) gridSnapshotRef.current = snap;
  }, [draft]);

  React.useEffect(() => {
    const stored = doc.documentRestructuredMarkdown?.trim() ?? '';
    if (!stored) return;
    const canonical = canonicalizeRestructuredTableMarkdown(stored);
    if (canonical === stored) return;
    setDraft(canonical);
    gridSnapshotRef.current = parseDraftGridSnapshot(canonical);
    onUpdateDoc({ documentRestructuredMarkdown: canonical });
  }, [doc.id, doc.documentRestructuredMarkdown, onUpdateDoc]);

  React.useEffect(() => {
    if (!started || doc.documentSelectorSpec || !draft.trim()) return;
    const snap = parseDraftGridSnapshot(draft);
    if (!snap) return;
    const inferred = inferSelectorSpecFromGrid(snap);
    setSelectorSpec(inferred);
    onUpdateDoc({ documentSelectorSpec: inferred });
  }, [started, doc.documentSelectorSpec, doc.id, draft, onUpdateDoc]);

  React.useEffect(() => {
    const stored = doc.documentRestructuredMarkdown?.trim() ?? '';
    if (!stored || !isLegacyCombinedRestructureMarkdown(stored)) return;
    if (doc.documentRestructureNotesMarkdown?.trim()) return;
    const { dataMarkdown, notesMarkdown } = splitLegacyRestructuredMarkdown(stored);
    if (!notesMarkdown.trim()) return;
    onUpdateDoc({
      documentRestructuredMarkdown: dataMarkdown,
      agentRestructuredBaselineMarkdown: dataMarkdown,
      documentRestructureNotesMarkdown: notesMarkdown,
      agentRestructureNotesBaselineMarkdown: notesMarkdown,
    });
  }, [doc.id, doc.documentRestructuredMarkdown, doc.documentRestructureNotesMarkdown, onUpdateDoc]);

  const repoId = doc.id?.trim() || doc.repositoryDocumentId?.trim() || undefined;
  const content = useKbDocumentContent(projectId, repoId, {
    localFallbackText: String(doc.markdownSnippet ?? '').trim(),
  });

  const canEdit = !disabled && doc.parseStatus !== 'parsing';
  const hasModel = Boolean(provider?.trim() && model?.trim());
  const hasRepo = Boolean(repoId);
  const baseline = doc.agentRestructuredBaselineMarkdown;
  const hasDraft = Boolean(draft.trim());
  const canRun = canEdit && hasModel && Boolean(projectId?.trim()) && hasRepo && !busy;

  const feedbackPayload = React.useMemo(
    () =>
      buildRestructureFeedbackPayload({
        documentRestructureRowNotes: rowNotes,
        documentRestructureQuestions: questions,
        documentRestructureDesignerFeedback: designerFeedback,
      }),
    [rowNotes, questions, designerFeedback]
  );

  const pendingFeedback = hasPendingRestructureFeedback(
    feedbackPayload,
    doc.documentRestructureFeedbackAppliedSnapshot
  );

  const unansweredQuestions = React.useMemo(
    () => unansweredRestructureQuestions(questions),
    [questions]
  );

  const tabAwaitingAnswers = started && unansweredQuestions.length > 0;
  const tabLabel = tabAwaitingAnswers
    ? KB_RESTRUCTURE_TAB_ANSWER_QUESTIONS_LABEL
    : KB_RESTRUCTURE_TAB_LABEL;

  const apiBase = React.useMemo(
    () => ({
      projectId: projectId!.trim(),
      repositoryDocumentId: repoId!,
      documentName: doc.name,
      documentSampleText: content.text ?? '',
      taskContext,
      provider: provider!,
      model: model!,
      callMeta,
    }),
    [projectId, repoId, doc.name, content.text, taskContext, provider, model, callMeta]
  );

  const persistFeedback = React.useCallback(
    (patch: {
      rowNotes?: Record<string, string>;
      questions?: KbRestructureClarificationQuestion[];
      designerFeedback?: string;
      columnInstructions?: Record<string, string>;
    }) => {
      const docPatch: KbDocumentPatch = {};
      if (patch.rowNotes !== undefined) docPatch.documentRestructureRowNotes = patch.rowNotes;
      if (patch.questions !== undefined) docPatch.documentRestructureQuestions = patch.questions;
      if (patch.designerFeedback !== undefined) {
        docPatch.documentRestructureDesignerFeedback = patch.designerFeedback;
      }
      if (patch.columnInstructions !== undefined) {
        docPatch.documentRestructureColumnInstructions = patch.columnInstructions;
      }
      if (Object.keys(docPatch).length > 0) onUpdateDoc(docPatch);
    },
    [onUpdateDoc]
  );

  const resolveSelectorSpecForGrid = React.useCallback(
    (dataMarkdown: string, aiSpec?: KbDocumentSelectorSpec | null): KbDocumentSelectorSpec | null => {
      const snap = parseDraftGridSnapshot(dataMarkdown);
      if (!snap) return aiSpec ?? null;
      return mergeSelectorSpecFromAiAndGrid(aiSpec, snap);
    },
    []
  );

  const applyAgentResult = React.useCallback(
    (result: AgentRestructureResult, clearFeedback: boolean) => {
      const data = canonicalizeRestructuredTableMarkdown(
        result.documentRestructuredMarkdown.trim()
      );
      const notes = result.documentRestructureNotesMarkdown.trim();
      const nextQuestions = mergeQuestionsWithAnswers(result.clarificationQuestions, []);
      const nextSelectorSpec = resolveSelectorSpecForGrid(data, result.selectorSpec);

      setDraft(data);
      setStarted(true);
      setViewMode('preview');
      gridSnapshotRef.current = parseDraftGridSnapshot(data);
      setSelectorSpec(nextSelectorSpec);

      if (clearFeedback) {
        setRowNotes({});
        setQuestions(nextQuestions);
        setDesignerFeedback('');
        setColumnInstructions({});
        onUpdateDoc({
          documentRestructuredMarkdown: data,
          agentRestructuredBaselineMarkdown: data,
          documentRestructureRowNotes: {},
          documentRestructureQuestions: nextQuestions,
          documentRestructureDesignerFeedback: '',
          documentRestructureColumnInstructions: {},
          documentSelectorSpec: nextSelectorSpec ?? undefined,
          documentRestructureFeedbackAppliedSnapshot: buildRestructureFeedbackSnapshot({
            rowNotes: {},
            questions: nextQuestions,
            designerFeedback: '',
          }),
          ...(notes
            ? {
                documentRestructureNotesMarkdown: notes,
                agentRestructureNotesBaselineMarkdown: notes,
              }
            : {}),
        });
        return;
      }

      setQuestions(nextQuestions);
      onUpdateDoc({
        documentRestructuredMarkdown: data,
        agentRestructuredBaselineMarkdown: data,
        documentRestructureQuestions: nextQuestions,
        documentSelectorSpec: nextSelectorSpec ?? undefined,
        ...(notes
          ? {
              documentRestructureNotesMarkdown: notes,
              agentRestructureNotesBaselineMarkdown: notes,
            }
          : {}),
      });
    },
    [onUpdateDoc, resolveSelectorSpecForGrid]
  );

  const persistDraft = React.useCallback(
    (next: string) => {
      setDraft(next);
      if (next !== doc.documentRestructuredMarkdown) {
        onUpdateDoc({ documentRestructuredMarkdown: next });
      }
    },
    [doc.documentRestructuredMarkdown, onUpdateDoc]
  );

  const onGridChange = React.useCallback(
    (payload: KbRestructuredTableChangePayload) => {
      const prev = gridSnapshotRef.current;
      const md = serializeParsedKbTabular({
        preamble: payload.preamble,
        grid: payload.grid,
      });
      const remappedNotes =
        prev !== null
          ? remapRestructureRowNotes(
              prev.headers,
              prev.rows,
              payload.grid.headers,
              payload.grid.rows,
              payload.rowNotes
            )
          : payload.rowNotes;

      gridSnapshotRef.current = {
        headers: payload.grid.headers,
        rows: payload.grid.rows,
      };

      const nextSelectorSpec = selectorSpec
        ? mergeSelectorSpecWithGrid(selectorSpec, payload.grid)
        : inferSelectorSpecFromGrid(payload.grid);

      setDraft(md);
      setRowNotes(remappedNotes);
      setSelectorSpec(nextSelectorSpec);
      if (payload.columnInstructions) {
        setColumnInstructions(payload.columnInstructions);
      }

      onUpdateDoc({
        documentRestructuredMarkdown: md,
        documentRestructureRowNotes: remappedNotes,
        documentSelectorSpec: nextSelectorSpec,
        ...(payload.columnInstructions
          ? { documentRestructureColumnInstructions: payload.columnInstructions }
          : {}),
      });
    },
    [onUpdateDoc, selectorSpec]
  );

  const onColumnInstructionsChange = React.useCallback((next: Record<string, string>) => {
    setColumnInstructions(next);
    persistFeedback({ columnInstructions: next });
  }, [persistFeedback]);

  const applyRowNote = React.useCallback((rowKey: string, note: string) => {
    setRowNotes((prev) => {
      const next = { ...prev };
      const trimmed = note.trim();
      if (trimmed) next[rowKey] = note;
      else delete next[rowKey];
      return next;
    });
  }, []);

  const onRowNoteChange = React.useCallback(
    (rowKey: string, note: string) => {
      applyRowNote(rowKey, note);
    },
    [applyRowNote]
  );

  const onRowNoteBlur = React.useCallback(
    (rowKey: string, note: string) => {
      const stored = doc.documentRestructureRowNotes ?? {};
      if ((stored[rowKey] ?? '') === note) return;
      const next = { ...stored };
      const trimmed = note.trim();
      if (trimmed) next[rowKey] = note;
      else delete next[rowKey];
      applyRowNote(rowKey, note);
      persistFeedback({ rowNotes: next });
    },
    [applyRowNote, doc.documentRestructureRowNotes, persistFeedback]
  );

  const onQuestionAnswerChange = React.useCallback((questionId: string, answer: string) => {
    setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, answer } : q)));
  }, []);

  const onQuestionAnswerBlur = React.useCallback(
    (questionId: string, answer: string) => {
      const docQ = (doc.documentRestructureQuestions ?? []).find((q) => q.id === questionId);
      if ((docQ?.answer ?? '') === answer) return;
      setQuestions((prev) => {
        const next = prev.map((q) => (q.id === questionId ? { ...q, answer } : q));
        persistFeedback({ questions: next });
        return next;
      });
    },
    [doc.documentRestructureQuestions, persistFeedback]
  );

  const onDesignerFeedbackChange = React.useCallback((value: string) => {
    setDesignerFeedback(value);
  }, []);

  const onDesignerFeedbackBlur = React.useCallback(
    (value: string) => {
      if ((doc.documentRestructureDesignerFeedback ?? '') === value) return;
      setDesignerFeedback(value);
      persistFeedback({ designerFeedback: value });
    },
    [doc.documentRestructureDesignerFeedback, persistFeedback]
  );

  const onPropose = React.useCallback(async () => {
    if (!canRun) return;
    setBusy(true);
    setError(null);
    try {
      const result = await proposeKbDocumentRestructure(apiBase);
      applyAgentResult(result, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [apiBase, applyAgentResult, canRun]);

  const focusFirstUnansweredQuestion = React.useCallback(() => {
    const first = unansweredRestructureQuestions(questions)[0];
    if (!first) return;
    questionsPanelRef.current?.focusQuestion(first.id);
  }, [questions]);

  const onRefineWithFeedback = React.useCallback(async () => {
    if (!canRun || !draft.trim() || !pendingFeedback) return;
    if (!allRestructureQuestionsAnswered(questions)) {
      focusFirstUnansweredQuestion();
      return;
    }
    persistFeedback({
      rowNotes,
      questions,
      designerFeedback,
    });
    setBusy(true);
    setError(null);
    try {
      const answered = answeredRestructureQuestions(questions);
      const columnInstructionsText = formatColumnInstructionsForRefine(columnInstructions);
      const selectorSpecText = formatSelectorSpecForRefine(selectorSpec);
      const combinedDesignerFeedback = [
        feedbackPayload.designerFeedback,
        columnInstructionsText,
        selectorSpecText,
      ]
        .filter(Boolean)
        .join('\n\n');

      const result = await refineKbDocumentRestructureWithFeedback({
        ...apiBase,
        draftMarkdown: draft,
        feedback: {
          rowNotes: feedbackPayload.rowNotes,
          questionAnswers: answered.map((q) => ({
            id: q.id,
            question: q.text,
            answer: q.answer!.trim(),
          })),
          designerFeedback: combinedDesignerFeedback,
        },
      });
      applyAgentResult(result, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [
    apiBase,
    applyAgentResult,
    canRun,
    columnInstructions,
    draft,
    feedbackPayload.designerFeedback,
    feedbackPayload.rowNotes,
    pendingFeedback,
    questions,
    rowNotes,
    designerFeedback,
    persistFeedback,
    focusFirstUnansweredQuestion,
    selectorSpec,
  ]);

  const executeLabel = started ? KB_RESTRUCTURE_UPDATE_BUTTON : KB_RESTRUCTURE_PROPOSE_BUTTON;
  const executeEnabled = canRun && (started ? pendingFeedback && hasDraft : true);

  const onToolbarExecute = React.useCallback(() => {
    if (started) {
      void onRefineWithFeedback();
    } else {
      void onPropose();
    }
  }, [onPropose, onRefineWithFeedback, started]);

  React.useEffect(() => {
    onToolbarStateChange?.({
      executeVisible: true,
      executeLabel,
      executeEnabled,
      executeBusy: busy,
      tabLabel,
      tabAwaitingAnswers,
      onExecute: onToolbarExecute,
    });
    return () => onToolbarStateChange?.(null);
  }, [
    busy,
    executeEnabled,
    executeLabel,
    tabAwaitingAnswers,
    tabLabel,
    onToolbarExecute,
    onToolbarStateChange,
  ]);

  const draftGrid = React.useMemo(() => {
    const snap = parseDraftGridSnapshot(draft);
    return snap ? { headers: snap.headers, rows: snap.rows } : null;
  }, [draft]);

  const approvalIssues = React.useMemo(
    () =>
      kbDocumentRestructureApprovalIssues(
        { ...doc, documentSelectorSpec: selectorSpec ?? doc.documentSelectorSpec },
        draftGrid
      ),
    [doc, draftGrid, selectorSpec]
  );

  const approved = doc.documentRestructuredApprovedForRuntime === true;
  const canApprove = canApproveKbDocumentRestructureForRuntime(
    { ...doc, documentSelectorSpec: selectorSpec ?? doc.documentSelectorSpec },
    draftGrid
  );

  const onSelectorSpecChange = React.useCallback(
    (next: KbDocumentSelectorSpec) => {
      setSelectorSpec(next);
      onUpdateDoc({ documentSelectorSpec: next });
    },
    [onUpdateDoc]
  );

  const onRecalculateSelectorSpec = React.useCallback(() => {
    if (!draftGrid) return;
    const next = inferSelectorSpecFromGrid(draftGrid);
    onSelectorSpecChange(next);
  }, [draftGrid, onSelectorSpecChange]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-3 py-2">
      <p className="shrink-0 text-xs leading-snug text-slate-400">
        {KB_RESTRUCTURE_GUIDE} Le note su origine e ambiguità compaiono nella tab{' '}
        <strong className="font-medium text-slate-300">Analisi del documento</strong>.
        {started ? (
          <span className="mt-1 block text-slate-500">{KB_RESTRUCTURE_TABLE_EDIT_HINT}</span>
        ) : null}
        {started && !pendingFeedback ? (
          <span className="mt-1 block text-slate-500">{KB_RESTRUCTURE_UPDATE_DISABLED_HINT}</span>
        ) : null}
      </p>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <label className="flex cursor-pointer items-start gap-2 rounded border border-slate-700/70 bg-slate-950/40 px-2 py-1.5 text-xs text-slate-200">
          <input
            type="checkbox"
            className="mt-0.5 accent-violet-400"
            disabled={!canEdit || !canApprove}
            checked={approved}
            onChange={(e) =>
              onUpdateDoc({ documentRestructuredApprovedForRuntime: e.target.checked })
            }
          />
          <span>{KB_RESTRUCTURE_APPROVE_RUNTIME_LABEL}</span>
        </label>
        {!canApprove && approvalIssues.length > 0 ? (
          <ul className="text-[10px] text-amber-300/90">
            {approvalIssues.map((issue) => (
              <li key={`${issue.code}-${issue.message}`}>{issue.message}</li>
            ))}
          </ul>
        ) : null}
        {hasDraft ? (
          <div className="ml-auto flex rounded border border-slate-700/70 p-0.5 text-[10px]">
            <button
              type="button"
              className={
                viewMode === 'preview'
                  ? 'rounded bg-violet-900/50 px-2 py-0.5 font-semibold text-violet-100'
                  : 'rounded px-2 py-0.5 text-slate-400 hover:text-slate-200'
              }
              onClick={() => setViewMode('preview')}
            >
              Anteprima
            </button>
            <button
              type="button"
              className={
                viewMode === 'edit'
                  ? 'rounded bg-violet-900/50 px-2 py-0.5 font-semibold text-violet-100'
                  : 'rounded px-2 py-0.5 text-slate-400 hover:text-slate-200'
              }
              onClick={() => setViewMode('edit')}
            >
              Modifica
            </button>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="shrink-0 text-xs text-rose-400" role="alert">
          {error}
        </p>
      ) : null}

      {!started && !hasDraft ? (
        <p className="shrink-0 text-xs text-slate-500">{KB_RESTRUCTURE_EMPTY_HINT}</p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
        {started && questions.length > 0 ? (
          <KbRestructureQuestionsPanel
            ref={questionsPanelRef}
            questions={questions}
            disabled={!canEdit || busy}
            onAnswerChange={onQuestionAnswerChange}
            onAnswerBlur={onQuestionAnswerBlur}
          />
        ) : null}

        {started ? (
          <KbSelectorSpecPanel
            spec={selectorSpec}
            grid={draftGrid}
            issues={approvalIssues}
            disabled={!canEdit || busy}
            onChange={onSelectorSpecChange}
            onRecalculateFromGrid={onRecalculateSelectorSpec}
          />
        ) : null}

        {started ? (
          <label className="flex shrink-0 flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
              {KB_RESTRUCTURE_DESIGNER_FEEDBACK_LABEL}
            </span>
            <KbAutoGrowTextarea
              className="rounded border border-slate-700/80 bg-slate-950/60 px-2 py-1.5 text-xs leading-snug text-slate-200 placeholder:text-slate-600 focus:border-violet-600/60 focus:outline-none"
              placeholder={KB_RESTRUCTURE_DESIGNER_FEEDBACK_PLACEHOLDER}
              value={designerFeedback}
              disabled={!canEdit || busy}
              onChange={(e) => onDesignerFeedbackChange(e.target.value)}
              onBlur={(e) => onDesignerFeedbackBlur(e.target.value)}
            />
          </label>
        ) : null}

        {hasDraft ? (
          <div className="relative h-[min(50vh,520px)] min-h-72 shrink-0 overflow-hidden">
            {busy ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/60">
                <Loader2 className="h-6 w-6 animate-spin text-violet-300" aria-hidden />
              </div>
            ) : null}
            {viewMode === 'preview' ? (
              <KbRestructuredDocumentPreview
                markdown={draft}
                className="h-full"
                rowNotes={rowNotes}
                onRowNoteChange={started ? onRowNoteChange : undefined}
                onRowNoteBlur={started ? onRowNoteBlur : undefined}
                interactiveNotesDisabled={!canEdit || busy}
                editable={started && canEdit}
                columnInstructions={columnInstructions}
                onGridChange={started && canEdit ? onGridChange : undefined}
                onColumnInstructionsChange={
                  started && canEdit ? onColumnInstructionsChange : undefined
                }
              />
            ) : (
              <KbAnalysisEditableMonaco
                value={draft}
                agentBaseline={baseline}
                onChange={persistDraft}
                readOnly={!canEdit || busy}
                fillHeight
                ariaLabel="Documento KB riformattato — tabella dati"
              />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
