/**
 * Colonna centrale: tab Analisi del documento + Documento (drag tab, split opzionale).
 */

import React from 'react';
import type { StagedKbDocument, KbDocumentPatch } from '@domain/knowledgeBase/kbDocumentTypes';
import type { AiCallMeta } from '@services/aiAgentDesignApi';
import type { KbDocumentAnalysisTaskContext } from '@domain/knowledgeBase/kbDocumentAnalysisApi';
import {
  kbAnalysisToolbarStateSnapshot,
  type KbAnalysisToolbarState,
} from '@domain/knowledgeBase/kbAnalysisToolbarState';
import {
  KB_ANALYSIS_REVIEW_TOGGLE,
} from '@domain/knowledgeBase/kbDocumentAnalysisGuide';
import { KbDocumentAnalysisTab } from './KbDocumentAnalysisTab';
import { KbDocumentRestructuredTab } from './KbDocumentRestructuredTab';
import { KnowledgeBaseDocumentDetail } from './KnowledgeBaseDocumentDetail';
import { Columns2, FileSearch, FileStack, FileText, Loader2, AlertTriangle } from 'lucide-react';
import {
  kbRestructureToolbarStateSnapshot,
  type KbRestructureToolbarState,
} from '@domain/knowledgeBase/kbRestructureToolbarState';
import { kbDocumentRestructureStarted } from '@domain/knowledgeBase/kbDocumentRestructureHelpers';

export type KbWorkspaceTabId = 'analysis' | 'document' | 'restructured';

export type KbWorkspaceTabHostProps = {
  doc: StagedKbDocument;
  projectId?: string;
  disabled?: boolean;
  callMeta?: AiCallMeta;
  taskContext?: KbDocumentAnalysisTaskContext;
  imageDocIds: readonly string[];
  onSelectDocumentId: (docId: string) => void;
  onUpdateDoc: (patch: KbDocumentPatch) => void;
  tutorAnalysisResultId?: string;
};

const TAB_DEFS: { id: KbWorkspaceTabId; label: string; Icon: typeof FileSearch }[] = [
  { id: 'document', label: 'Documento', Icon: FileText },
  { id: 'analysis', label: 'Analisi del documento', Icon: FileSearch },
  { id: 'restructured', label: 'Documento riformattato', Icon: FileStack },
];

type KbTabChromeProps = {
  def: (typeof TAB_DEFS)[number];
  active: boolean;
  pendingUpdate?: boolean;
  /** Sostituisce def.label (es. «Rispondi alle domande»). */
  labelOverride?: string;
  /** Stile avviso sul tab (domande IA senza risposta). */
  awaitingAnswers?: boolean;
  toolbar?: KbAnalysisToolbarState | KbRestructureToolbarState | null;
  toolbarKind?: 'analysis' | 'restructured';
  onSelect: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
};

function KbWorkspaceTabChrome({
  def,
  active,
  pendingUpdate = false,
  labelOverride,
  awaitingAnswers = false,
  toolbar = null,
  toolbarKind = 'analysis',
  onSelect,
  onDragStart,
  onDragOver,
  onDrop,
}: KbTabChromeProps): React.ReactElement {
  const displayLabel = labelOverride ?? def.label;
  const showToolbar =
    (def.id === 'analysis' || def.id === 'restructured') &&
    toolbar &&
    toolbar.executeVisible;

  let shellClass =
    'inline-flex cursor-grab overflow-hidden rounded-t border text-xs font-medium transition-colors active:cursor-grabbing ';

  if (awaitingAnswers) {
    shellClass += active
      ? 'border-amber-500/80 bg-amber-950/90 text-amber-50'
      : 'border-amber-600/60 bg-amber-950/70 text-amber-100 hover:bg-amber-900/80';
  } else if (pendingUpdate) {
    shellClass += active
      ? 'border-amber-500/80 bg-amber-600 text-amber-50'
      : 'border-amber-600/60 bg-amber-700/90 text-amber-50 hover:bg-amber-600';
  } else if (active) {
    shellClass += 'border-violet-500/50 bg-slate-800 text-violet-100';
  } else {
    shellClass += 'border-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-200';
  }

  const tabBtnClass =
    'inline-flex items-center gap-1 py-1 pl-2.5 pr-2.5 ' +
    (showToolbar ? '' : 'rounded-t');

  const actionClass =
    'inline-flex items-center gap-1 border-l border-violet-400/30 px-2.5 py-1 text-[11px] font-semibold disabled:opacity-40 ' +
    ('executeEmphasized' in (toolbar ?? {}) && toolbar?.executeEmphasized
      ? 'bg-amber-950/70 text-amber-100'
      : 'bg-violet-900/40 text-violet-50');

  return (
    <div
      role="tab"
      aria-selected={active}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={shellClass}
    >
      <button type="button" onClick={onSelect} className={tabBtnClass}>
        {awaitingAnswers ? (
          <AlertTriangle className="h-3 w-3 shrink-0 text-amber-400" aria-hidden />
        ) : (
          <def.Icon className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
        )}
        {displayLabel}
      </button>
      {showToolbar && toolbar ? (
        <>
          {toolbarKind === 'analysis' &&
          'reviewToggleVisible' in toolbar &&
          toolbar.reviewToggleVisible ? (
            <button
              type="button"
              aria-pressed={'reviewPanelOpen' in toolbar ? toolbar.reviewPanelOpen : false}
              onClick={(e) => {
                e.stopPropagation();
                if ('onToggleReviewPanel' in toolbar) toolbar.onToggleReviewPanel();
              }}
              className="border-l border-violet-400/30 px-2 py-1 text-[11px] font-medium text-violet-100/90 hover:bg-violet-900/40"
            >
              {KB_ANALYSIS_REVIEW_TOGGLE}
            </button>
          ) : null}
          {toolbar.executeVisible ? (
            <>
              <button
                type="button"
                disabled={!toolbar.executeEnabled || toolbar.executeBusy}
                onClick={(e) => {
                  e.stopPropagation();
                  toolbar.onExecute();
                }}
                className={actionClass}
              >
                {toolbar.executeBusy ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                ) : null}
                {toolbar.executeLabel}
              </button>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function KbWorkspaceTabHost({
  doc,
  projectId,
  disabled = false,
  callMeta,
  taskContext,
  imageDocIds,
  onSelectDocumentId,
  onUpdateDoc,
  tutorAnalysisResultId,
}: KbWorkspaceTabHostProps): React.ReactElement {
  const [tabOrder, setTabOrder] = React.useState<readonly KbWorkspaceTabId[]>([
    'document',
    'analysis',
    'restructured',
  ]);
  const [activeTab, setActiveTab] = React.useState<KbWorkspaceTabId>('document');
  const [splitView, setSplitView] = React.useState(true);
  const [analysisToolbar, setAnalysisToolbar] = React.useState<KbAnalysisToolbarState | null>(null);
  const [restructureToolbar, setRestructureToolbar] =
    React.useState<KbRestructureToolbarState | null>(null);
  const [reviewPanelOpen, setReviewPanelOpen] = React.useState(true);
  const dragTabRef = React.useRef<KbWorkspaceTabId | null>(null);
  const lastAnalysisToolbarSigRef = React.useRef<string | null>(null);
  const lastRestructureToolbarSigRef = React.useRef<string | null>(null);

  const handleAnalysisToolbarChange = React.useCallback(
    (state: KbAnalysisToolbarState | null) => {
      if (state === null) {
        lastAnalysisToolbarSigRef.current = null;
        setAnalysisToolbar(null);
        return;
      }
      const sig = kbAnalysisToolbarStateSnapshot(state);
      if (lastAnalysisToolbarSigRef.current === sig) return;
      lastAnalysisToolbarSigRef.current = sig;
      setAnalysisToolbar(state);
    },
    []
  );

  const handleRestructureToolbarChange = React.useCallback(
    (state: KbRestructureToolbarState | null) => {
      if (state === null) {
        lastRestructureToolbarSigRef.current = null;
        setRestructureToolbar(null);
        return;
      }
      const sig = kbRestructureToolbarStateSnapshot(state);
      if (lastRestructureToolbarSigRef.current === sig) return;
      lastRestructureToolbarSigRef.current = sig;
      setRestructureToolbar(state);
    },
    []
  );

  const restructureStarted = kbDocumentRestructureStarted(doc);
  const prevRestructureStartedRef = React.useRef(restructureStarted);

  React.useEffect(() => {
    setActiveTab('analysis');
    setSplitView(true);
    lastAnalysisToolbarSigRef.current = null;
    lastRestructureToolbarSigRef.current = null;
    setAnalysisToolbar(null);
    setRestructureToolbar(null);
    setReviewPanelOpen(true);
    prevRestructureStartedRef.current = kbDocumentRestructureStarted(doc);
  }, [doc.id]);

  React.useEffect(() => {
    if (restructureStarted && !prevRestructureStartedRef.current) {
      setActiveTab('restructured');
      setSplitView(false);
    }
    prevRestructureStartedRef.current = restructureStarted;
  }, [restructureStarted]);

  React.useEffect(() => {
    if (!restructureStarted && activeTab === 'restructured') {
      setActiveTab('analysis');
    }
  }, [activeTab, restructureStarted]);

  const orderedTabs = React.useMemo(() => {
    const known = new Set(tabOrder);
    const rest = TAB_DEFS.map((t) => t.id).filter((id) => !known.has(id));
    return [...tabOrder, ...rest].filter((id) => id !== 'restructured' || restructureStarted);
  }, [tabOrder, restructureStarted]);

  const onTabDragStart = (id: KbWorkspaceTabId) => (e: React.DragEvent) => {
    dragTabRef.current = id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/kb-tab', id);
  };

  const onTabDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onTabDropOnBar = (targetId: KbWorkspaceTabId) => (e: React.DragEvent) => {
    e.preventDefault();
    const dragged = dragTabRef.current ?? (e.dataTransfer.getData('text/kb-tab') as KbWorkspaceTabId);
    if (!dragged || dragged === targetId) return;
    setTabOrder((prev) => {
      const next = prev.filter((t) => t !== dragged);
      const idx = next.indexOf(targetId);
      if (idx < 0) return [...next, dragged];
      const copy = [...next];
      copy.splice(idx, 0, dragged);
      return copy;
    });
    dragTabRef.current = null;
  };

  const onSplitDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dragged = dragTabRef.current ?? (e.dataTransfer.getData('text/kb-tab') as KbWorkspaceTabId);
    if (dragged === 'document' || dragged === 'analysis' || (dragged === 'restructured' && restructureStarted)) {
      setSplitView(true);
      setActiveTab(dragged === 'document' ? 'analysis' : dragged);
    }
    dragTabRef.current = null;
  };

  const showAnalysisToolbar =
    analysisToolbar !== null &&
    (analysisToolbar.executeVisible || analysisToolbar.reviewToggleVisible);

  const showRestructureToolbar =
    restructureToolbar !== null && restructureToolbar.executeVisible;

  const analysisTabPending = Boolean(analysisToolbar?.analysisTabHighlight);

  const splitSecondaryTab: KbWorkspaceTabId =
    activeTab === 'document'
      ? 'analysis'
      : activeTab === 'restructured' && restructureStarted
        ? 'restructured'
        : activeTab;

  const analysisPane = (
    <div
      className="min-h-0 flex-1 flex flex-col overflow-hidden"
      {...(tutorAnalysisResultId ? { 'data-tutor-id': tutorAnalysisResultId } : {})}
    >
      <KbDocumentAnalysisTab
        doc={doc}
        projectId={projectId}
        disabled={disabled}
        callMeta={callMeta}
        taskContext={taskContext}
        onUpdateDoc={onUpdateDoc}
        onToolbarStateChange={handleAnalysisToolbarChange}
        reviewPanelOpen={reviewPanelOpen}
        onReviewPanelOpenChange={setReviewPanelOpen}
      />
    </div>
  );

  const restructuredPane = (
    <div className="min-h-0 flex-1 flex flex-col overflow-hidden">
      <KbDocumentRestructuredTab
        doc={doc}
        projectId={projectId}
        disabled={disabled}
        callMeta={callMeta}
        taskContext={taskContext}
        onUpdateDoc={onUpdateDoc}
        onToolbarStateChange={handleRestructureToolbarChange}
      />
    </div>
  );

  const secondaryPane =
    splitSecondaryTab === 'restructured' ? restructuredPane : analysisPane;

  const documentPane = (
    <KnowledgeBaseDocumentDetail
      doc={doc}
      projectId={projectId}
      disabled={disabled}
      imageDocIds={imageDocIds}
      onSelectDocumentId={onSelectDocumentId}
      onUpdateDoc={onUpdateDoc}
    />
  );

  return (
    <main className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-slate-950/40">
      <div
        className="flex shrink-0 items-center gap-0.5 border-b border-slate-800 bg-slate-950/90 px-1 py-0.5 relative z-50"
        role="tablist"
        aria-label="Pannelli KB"
      >
        {orderedTabs.map((tabId) => {
          const def = TAB_DEFS.find((t) => t.id === tabId)!;
          const active = !splitView && activeTab === tabId;
          const isAnalysisTab = tabId === 'analysis';
          const isRestructuredTab = tabId === 'restructured';
          const tabToolbar = isAnalysisTab
            ? showAnalysisToolbar
              ? analysisToolbar
              : !restructureStarted && showRestructureToolbar
                ? restructureToolbar
                : null
            : isRestructuredTab
              ? showRestructureToolbar
                ? restructureToolbar
                : null
              : null;
          const toolbarKind: 'analysis' | 'restructured' =
            isRestructuredTab || (!restructureStarted && tabToolbar === restructureToolbar)
              ? 'restructured'
              : 'analysis';
          const restructureTabLabel =
            isRestructuredTab && restructureToolbar ? restructureToolbar.tabLabel : undefined;
          const restructureAwaitingAnswers =
            isRestructuredTab && restructureToolbar
              ? restructureToolbar.tabAwaitingAnswers
              : false;
          return (
            <React.Fragment key={tabId}>
              <KbWorkspaceTabChrome
                def={def}
                active={active}
                pendingUpdate={isAnalysisTab && analysisTabPending}
                labelOverride={restructureTabLabel}
                awaitingAnswers={restructureAwaitingAnswers}
                toolbar={tabToolbar}
                toolbarKind={toolbarKind}
                onSelect={() => {
                  setActiveTab(tabId);
                  setSplitView(false);
                }}
                onDragStart={onTabDragStart(tabId)}
                onDragOver={onTabDragOver}
                onDrop={onTabDropOnBar(tabId)}
              />
            </React.Fragment>
          );
        })}
        <div className="ml-auto flex items-center gap-1 pr-1">
          <button
            type="button"
            title={splitView ? 'Una sola tab' : 'Affianca Documento e pannello attivo'}
            aria-pressed={splitView}
            onClick={() => setSplitView((v) => !v)}
            className={
              'rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100 ' +
              (splitView ? 'bg-slate-800 text-violet-200' : '')
            }
          >
            <Columns2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>

      <div
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'link';
        }}
        onDrop={onSplitDrop}
      >
        {!restructureStarted ? (
          <div className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0" aria-hidden>
            {restructuredPane}
          </div>
        ) : null}
        {splitView ? (
          <div className="flex min-h-0 flex-1 divide-x divide-slate-800">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              {documentPane}
            </div>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{secondaryPane}</div>
          </div>
        ) : (
          <>
            <div
              className={
                'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ' +
                (activeTab === 'document' ? '' : 'hidden')
              }
            >
              {documentPane}
            </div>
            <div
              className={
                'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ' +
                (activeTab === 'analysis' ? '' : 'hidden')
              }
            >
              {analysisPane}
            </div>
            <div
              className={
                'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ' +
                (activeTab === 'restructured' && restructureStarted ? '' : 'hidden')
              }
            >
              {restructuredPane}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
