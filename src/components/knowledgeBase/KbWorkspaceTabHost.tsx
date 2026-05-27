/**
 * Colonna centrale: tab Analisi del documento + Documento (drag tab, split opzionale).
 */

import React from 'react';
import type { StagedKbDocument, KbDocumentPatch } from '@domain/knowledgeBase/kbDocumentTypes';
import type { AiCallMeta } from '@services/aiAgentDesignApi';
import type { KbDocumentAnalysisTaskContext } from '@domain/knowledgeBase/kbDocumentAnalysisApi';
import type { KbAnalysisToolbarState } from '@domain/knowledgeBase/kbAnalysisToolbarState';
import {
  KB_ANALYSIS_REVIEW_TOGGLE,
} from '@domain/knowledgeBase/kbDocumentAnalysisGuide';
import { KbDocumentAnalysisTab } from './KbDocumentAnalysisTab';
import { KnowledgeBaseDocumentDetail } from './KnowledgeBaseDocumentDetail';
import { Columns2, FileSearch, FileText, Loader2 } from 'lucide-react';

export type KbWorkspaceTabId = 'analysis' | 'document';

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
];

type KbTabChromeProps = {
  def: (typeof TAB_DEFS)[number];
  active: boolean;
  pendingUpdate?: boolean;
  toolbar?: KbAnalysisToolbarState | null;
  onSelect: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
};

function KbWorkspaceTabChrome({
  def,
  active,
  pendingUpdate = false,
  toolbar = null,
  onSelect,
  onDragStart,
  onDragOver,
  onDrop,
}: KbTabChromeProps): React.ReactElement {
  const showToolbar =
    def.id === 'analysis' &&
    toolbar &&
    (toolbar.executeVisible || toolbar.reviewToggleVisible);

  let shellClass =
    'inline-flex cursor-grab overflow-hidden rounded-t border text-xs font-medium transition-colors active:cursor-grabbing ';

  if (pendingUpdate) {
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
    (toolbar?.executeEmphasized
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
        <def.Icon className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
        {def.label}
      </button>
      {showToolbar && toolbar ? (
        <>
          {toolbar.reviewToggleVisible ? (
            <button
              type="button"
              aria-pressed={toolbar.reviewPanelOpen}
              onClick={(e) => {
                e.stopPropagation();
                toolbar.onToggleReviewPanel();
              }}
              className="border-l border-violet-400/30 px-2 py-1 text-[11px] font-medium text-violet-100/90 hover:bg-violet-900/40"
            >
              {KB_ANALYSIS_REVIEW_TOGGLE}
            </button>
          ) : null}
          {toolbar.executeVisible ? (
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
  const [tabOrder, setTabOrder] = React.useState<readonly KbWorkspaceTabId[]>(['document', 'analysis']);
  const [activeTab, setActiveTab] = React.useState<KbWorkspaceTabId>('document');
  const [splitView, setSplitView] = React.useState(true);
  const [analysisToolbar, setAnalysisToolbar] = React.useState<KbAnalysisToolbarState | null>(null);
  const [reviewPanelOpen, setReviewPanelOpen] = React.useState(true);
  const dragTabRef = React.useRef<KbWorkspaceTabId | null>(null);

  React.useEffect(() => {
    setActiveTab('analysis');
    setSplitView(true);
    setAnalysisToolbar(null);
    setReviewPanelOpen(true);
  }, [doc.id]);

  const orderedTabs = React.useMemo(() => {
    const known = new Set(tabOrder);
    const rest = TAB_DEFS.map((t) => t.id).filter((id) => !known.has(id));
    return [...tabOrder, ...rest];
  }, [tabOrder]);

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
    if (dragged === 'document' || dragged === 'analysis') {
      setSplitView(true);
      setActiveTab('analysis');
    }
    dragTabRef.current = null;
  };

  const showAnalysisToolbar =
    analysisToolbar !== null &&
    (analysisToolbar.executeVisible || analysisToolbar.reviewToggleVisible);

  const analysisTabPending = Boolean(analysisToolbar?.analysisTabHighlight);

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
        onToolbarStateChange={setAnalysisToolbar}
        reviewPanelOpen={reviewPanelOpen}
        onReviewPanelOpenChange={setReviewPanelOpen}
      />
    </div>
  );

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
        className="flex shrink-0 items-center gap-0.5 border-b border-slate-800 bg-slate-950/90 px-1 py-0.5"
        role="tablist"
        aria-label="Pannelli KB"
      >
        {orderedTabs.map((tabId) => {
          const def = TAB_DEFS.find((t) => t.id === tabId)!;
          const active = !splitView && activeTab === tabId;
          const isAnalysisTab = tabId === 'analysis';
          return (
            <React.Fragment key={tabId}>
              <KbWorkspaceTabChrome
                def={def}
                active={active}
                pendingUpdate={isAnalysisTab && analysisTabPending}
                toolbar={isAnalysisTab && showAnalysisToolbar ? analysisToolbar : null}
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
            title={splitView ? 'Una sola tab' : 'Affianca Analisi e Documento'}
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
        {splitView ? (
          <div className="flex min-h-0 flex-1 divide-x divide-slate-800">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              {documentPane}
            </div>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{analysisPane}</div>
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
          </>
        )}
      </div>
    </main>
  );
}
