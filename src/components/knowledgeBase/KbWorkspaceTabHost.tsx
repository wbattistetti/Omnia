/**
 * Center column: tabbed Focus + Documento (draggable tabs, optional split view).
 */

import React from 'react';
import type { StagedKbDocument, KbDocumentPatch } from '@domain/knowledgeBase/kbDocumentTypes';
import { KbFocusPanel } from './KbFocusPanel';
import { KnowledgeBaseDocumentDetail } from './KnowledgeBaseDocumentDetail';
import type { useKbDocumentActions } from './useKbDocumentActions';
import { Columns2, FileText, Maximize2, Minimize2, Target } from 'lucide-react';

export type KbWorkspaceTabId = 'focus' | 'document';

export type KbWorkspaceTabHostProps = {
  doc: StagedKbDocument;
  projectId?: string;
  disabled?: boolean;
  actions: ReturnType<typeof useKbDocumentActions>;
  imageDocIds: readonly string[];
  readerError?: string | null;
  readerExpanded: boolean;
  onToggleReaderExpanded: () => void;
  /** Focus tab a tutta larghezza workspace (nasconde chat). */
  focusTabExpanded: boolean;
  onToggleFocusTabExpanded: () => void;
  onSelectDocumentId: (docId: string) => void;
  onUpdateDoc: (patch: KbDocumentPatch) => void;
};

const TAB_DEFS: { id: KbWorkspaceTabId; label: string; Icon: typeof Target }[] = [
  { id: 'focus', label: 'Analisi', Icon: Target },
  { id: 'document', label: 'Documento', Icon: FileText },
];

type KbTabChromeProps = {
  tabId: KbWorkspaceTabId;
  def: (typeof TAB_DEFS)[number];
  active: boolean;
  expanded: boolean;
  showExpand: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  expandExpandTitle: string;
  expandCollapseTitle: string;
  expandAriaExpand: string;
  expandAriaCollapse: string;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
};

function KbWorkspaceTabChrome({
  def,
  active,
  expanded,
  showExpand,
  onSelect,
  onToggleExpand,
  expandExpandTitle,
  expandCollapseTitle,
  expandAriaExpand,
  expandAriaCollapse,
  onDragStart,
  onDragOver,
  onDrop,
}: KbTabChromeProps): React.ReactElement {
  return (
    <div
      role="presentation"
      className={
        'inline-flex items-center rounded-t border text-xs font-medium ' +
        (active
          ? 'border-violet-500/50 bg-slate-800 text-violet-100 ' +
            (expanded ? 'ring-1 ring-violet-400/40' : '')
          : 'border-transparent text-slate-400')
      }
    >
      <button
        type="button"
        role="tab"
        aria-selected={active}
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onClick={onSelect}
        className={
          'inline-flex cursor-grab items-center gap-1 py-1 pl-2.5 pr-1 active:cursor-grabbing ' +
          (active ? '' : 'rounded-t hover:bg-slate-900 hover:text-slate-200')
        }
      >
        <def.Icon className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
        {def.label}
      </button>
      {showExpand ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          title={expanded ? expandCollapseTitle : expandExpandTitle}
          aria-label={expanded ? expandAriaCollapse : expandAriaExpand}
          aria-pressed={expanded}
          className="mr-1 inline-flex shrink-0 items-center justify-center rounded p-0.5 text-violet-200/90 hover:bg-slate-700/80 hover:text-violet-50"
        >
          {expanded ? (
            <Minimize2 className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>
      ) : null}
    </div>
  );
}

export function KbWorkspaceTabHost({
  doc,
  projectId,
  disabled = false,
  actions,
  imageDocIds,
  readerError = null,
  readerExpanded,
  onToggleReaderExpanded,
  focusTabExpanded,
  onToggleFocusTabExpanded,
  onSelectDocumentId,
  onUpdateDoc,
}: KbWorkspaceTabHostProps): React.ReactElement {
  const { hasAnalyzed } = actions;
  const [tabOrder, setTabOrder] = React.useState<readonly KbWorkspaceTabId[]>(['focus', 'document']);
  const [activeTab, setActiveTab] = React.useState<KbWorkspaceTabId>('document');
  const [splitView, setSplitView] = React.useState(false);
  const dragTabRef = React.useRef<KbWorkspaceTabId | null>(null);

  React.useEffect(() => {
    if (hasAnalyzed) {
      setActiveTab('focus');
      setSplitView(false);
    }
  }, [doc.id, hasAnalyzed]);

  React.useEffect(() => {
    setActiveTab('document');
    setSplitView(false);
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
    if (dragged === 'document' || dragged === 'focus') {
      setSplitView(true);
      setActiveTab('focus');
    }
    dragTabRef.current = null;
  };

  const focusPane = (
    <KbFocusPanel
      doc={doc}
      disabled={disabled}
      actions={actions}
      readerError={readerError}
      opaqueSurface
    />
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

  const selectTab = (tabId: KbWorkspaceTabId) => {
    setActiveTab(tabId);
    setSplitView(false);
    if (tabId === 'focus' && readerExpanded) onToggleReaderExpanded();
    if (tabId === 'document' && focusTabExpanded) onToggleFocusTabExpanded();
  };

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
          const isFocus = tabId === 'focus';
          return (
            <KbWorkspaceTabChrome
              key={tabId}
              tabId={tabId}
              def={def}
              active={active}
              expanded={isFocus ? focusTabExpanded : readerExpanded}
              showExpand={active && !splitView}
              onSelect={() => selectTab(tabId)}
              onToggleExpand={isFocus ? onToggleFocusTabExpanded : onToggleReaderExpanded}
              expandExpandTitle={
                isFocus
                  ? 'Espandi Analisi a tutta larghezza (nasconde la chat)'
                  : 'Espandi Documento a tutta larghezza (nasconde la chat)'
              }
              expandCollapseTitle="Riduci: mostra di nuovo la chat"
              expandAriaExpand={isFocus ? 'Espandi tab Analisi' : 'Espandi tab Documento'}
              expandAriaCollapse={isFocus ? 'Riduci tab Analisi' : 'Riduci tab Documento'}
              onDragStart={onTabDragStart(tabId)}
              onDragOver={onTabDragOver}
              onDrop={onTabDropOnBar(tabId)}
            />
          );
        })}
        <div className="ml-auto flex items-center gap-1 pr-1">
          <button
            type="button"
            title={splitView ? 'Una sola tab' : 'Affianca Analisi e Documento'}
            aria-pressed={splitView}
            onClick={() => {
              setSplitView((v) => {
                const next = !v;
                if (next) {
                  if (focusTabExpanded) onToggleFocusTabExpanded();
                  if (readerExpanded) onToggleReaderExpanded();
                }
                return next;
              });
            }}
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
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{focusPane}</div>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{documentPane}</div>
          </div>
        ) : activeTab === 'focus' ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{focusPane}</div>
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{documentPane}</div>
        )}
      </div>
    </main>
  );
}
