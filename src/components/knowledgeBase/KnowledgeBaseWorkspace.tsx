/**
 * KB workspace: list | reader (center) | analysis dock (pills, rules, chat).
 */

import React from 'react';
import type { StagedKbDocument, KbDocumentPatch } from '@domain/knowledgeBase/kbDocumentTypes';
import type { AiCallMeta } from '@services/aiAgentDesignApi';
import {
  KnowledgeBaseFileDropZone,
  type KnowledgeBaseFileDropZoneHandle,
} from './KnowledgeBaseFileDropZone';
import { KnowledgeBaseDocumentCard } from './KnowledgeBaseDocumentCard';
import { KnowledgeBaseDocumentDetail } from './KnowledgeBaseDocumentDetail';
import { KbAnalysisDock } from './KbAnalysisDock';
import { useKbDocumentActions } from './useKbDocumentActions';
import { KB_DOCUMENT_ACCEPT } from '@domain/knowledgeBase/kbFileKinds';
import { List } from 'lucide-react';
import { KB_WORKSPACE_ROOT } from './kbTypography';

const SPLIT_COL = '6px';
const DEFAULT_LIST_WIDTH_PX = 220;
const MIN_LIST_WIDTH_PX = 140;
const MAX_LIST_WIDTH_RATIO = 0.45;

export type KnowledgeBaseWorkspaceProps = {
  documents: readonly StagedKbDocument[];
  projectId?: string;
  callMeta?: AiCallMeta;
  onAddFiles: (files: File[]) => void;
  onRemoveDocument?: (docId: string) => void;
  onUpdateDocument: (docId: string, patch: KbDocumentPatch) => void;
  disabled?: boolean;
  emptyHint?: string;
  className?: string;
};

function buildGridColumns(
  listHidden: boolean,
  hasDoc: boolean,
  listWidthPx: number,
  dockShare: number
): string {
  const listCol = `${Math.round(listWidthPx)}px`;
  if (!hasDoc) {
    return listHidden ? 'minmax(0, 1fr)' : `${listCol} ${SPLIT_COL} minmax(0, 1fr)`;
  }
  const dockCol = `minmax(160px, ${Math.round(dockShare * 100)}%)`;
  if (listHidden) {
    return `minmax(0, 1fr) ${SPLIT_COL} ${dockCol}`;
  }
  return `${listCol} ${SPLIT_COL} minmax(0, 1fr) ${SPLIT_COL} ${dockCol}`;
}

type KbResizeState =
  | { edge: 'list'; startX: number; startListWidth: number; width: number }
  | { edge: 'dock'; startX: number; startDockShare: number; width: number };

function KbColumnSplitter({
  ariaLabel,
  onPointerDown,
  onPointerMove,
  onPointerEnd,
}: {
  ariaLabel: string;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerEnd: (e: React.PointerEvent) => void;
}): React.ReactElement {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      tabIndex={0}
      className="cursor-col-resize touch-none select-none bg-slate-900/80 hover:bg-violet-950/50"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    />
  );
}

export function KnowledgeBaseWorkspace({
  documents,
  projectId,
  callMeta,
  onAddFiles,
  onRemoveDocument,
  onUpdateDocument,
  disabled = false,
  emptyHint = 'Trascina documenti (.txt, .md, .csv, .json, .xlsx, .pdf, .docx…)',
  className = '',
}: KnowledgeBaseWorkspaceProps): React.ReactElement {
  const dropRef = React.useRef<KnowledgeBaseFileDropZoneHandle>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [focusDocId, setFocusDocId] = React.useState<string | null>(null);
  const [listWidthPx, setListWidthPx] = React.useState(DEFAULT_LIST_WIDTH_PX);
  const [dockShare, setDockShare] = React.useState(0.34);
  const resizeRef = React.useRef<KbResizeState | null>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);

  const canEdit = !disabled;

  React.useEffect(() => {
    if (documents.length === 0) {
      setSelectedId(null);
      setFocusDocId(null);
      return;
    }
    if (!selectedId || !documents.some((d) => d.id === selectedId)) {
      setSelectedId(documents[documents.length - 1]!.id);
    }
  }, [documents, selectedId]);

  const selectedDoc = React.useMemo(
    () => documents.find((d) => d.id === selectedId) ?? null,
    [documents, selectedId]
  );

  const dockActions = useKbDocumentActions({
    doc: selectedDoc,
    projectId,
    disabled,
    callMeta,
    onUpdateDoc: onUpdateDocument,
  });

  const listHidden = Boolean(focusDocId && focusDocId === selectedId);
  const gridColumns = buildGridColumns(
    listHidden,
    Boolean(selectedDoc),
    listWidthPx,
    dockShare
  );

  const onListResizePointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const w = bodyRef.current?.clientWidth ?? 800;
      resizeRef.current = {
        edge: 'list',
        startX: e.clientX,
        startListWidth: listWidthPx,
        width: w,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [listWidthPx]
  );

  const onDockResizePointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const w = bodyRef.current?.clientWidth ?? 800;
      resizeRef.current = {
        edge: 'dock',
        startX: e.clientX,
        startDockShare: dockShare,
        width: w,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [dockShare]
  );

  const onResizePointerMove = React.useCallback((e: React.PointerEvent) => {
    const st = resizeRef.current;
    if (!st || st.width <= 0) return;
    if (st.edge === 'list') {
      const maxList = Math.floor(st.width * MAX_LIST_WIDTH_RATIO);
      const delta = e.clientX - st.startX;
      setListWidthPx(
        Math.min(maxList, Math.max(MIN_LIST_WIDTH_PX, st.startListWidth + delta))
      );
      return;
    }
    const delta = st.startX - e.clientX;
    setDockShare(Math.min(0.5, Math.max(0.26, st.startDockShare + delta / st.width)));
  }, []);

  const finishResize = React.useCallback(() => {
    resizeRef.current = null;
  }, []);

  return (
    <div
      className={'flex min-h-0 flex-1 flex-col ' + KB_WORKSPACE_ROOT + ' ' + className}
      data-kb-workspace="v3-guided"
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-violet-800/50 bg-violet-950/30 px-2 py-2">
        <p className="font-medium text-violet-100">Documenti knowledge base</p>
        <div className="flex items-center gap-1.5">
          {listHidden ? (
            <button
              type="button"
              onClick={() => setFocusDocId(null)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-600 px-2 py-1 text-slate-200 hover:bg-slate-800"
            >
              <List className="h-3.5 w-3.5" aria-hidden />
              Lista
            </button>
          ) : null}
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => dropRef.current?.openPicker()}
            className="rounded-md border border-violet-500/80 bg-violet-700/50 px-3 py-1 font-medium text-violet-50 hover:bg-violet-600/60 disabled:opacity-60"
          >
            Aggiungi documento
          </button>
        </div>
      </header>

      <div
        ref={bodyRef}
        className="grid min-h-0 flex-1 overflow-hidden"
        style={{ gridTemplateColumns: gridColumns }}
      >
        {!listHidden ? (
          <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden">
            <KnowledgeBaseFileDropZone
              ref={dropRef}
              accept={KB_DOCUMENT_ACCEPT}
              disabled={!canEdit}
              onFiles={(files) => onAddFiles(files)}
              emptyHint={emptyHint}
              className="min-h-0 flex-1"
            >
              {documents.length > 0 ? (
                <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-1.5">
                  {documents.map((doc) => (
                    <KnowledgeBaseDocumentCard
                      key={doc.id}
                      doc={doc}
                      selected={doc.id === selectedId}
                      focusMode={focusDocId === doc.id}
                      disabled={disabled}
                      onSelect={() => setSelectedId(doc.id)}
                      onToggleFocus={() =>
                        setFocusDocId((prev) => (prev === doc.id ? null : doc.id))
                      }
                      onRemove={
                        onRemoveDocument ? () => onRemoveDocument(doc.id) : undefined
                      }
                    />
                  ))}
                </ul>
              ) : (
                <p className="py-6 text-center text-slate-500">Nessun documento.</p>
              )}
            </KnowledgeBaseFileDropZone>
          </aside>
        ) : null}

        {!listHidden ? (
          <KbColumnSplitter
            ariaLabel="Ridimensiona lista documenti"
            onPointerDown={onListResizePointerDown}
            onPointerMove={onResizePointerMove}
            onPointerEnd={finishResize}
          />
        ) : null}

        <main className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-slate-950/40">
          {selectedDoc ? (
            <KnowledgeBaseDocumentDetail
              doc={selectedDoc}
              projectId={projectId}
              disabled={disabled}
              actions={dockActions}
              onUpdateDoc={(patch) => onUpdateDocument(selectedDoc.id, patch)}
            />
          ) : (
            <p className="flex flex-1 items-center justify-center px-4 text-center text-slate-500">
              Seleziona un documento o caricane uno nuovo.
            </p>
          )}
        </main>

        {selectedDoc ? (
          <>
            <KbColumnSplitter
              ariaLabel="Ridimensiona pannello analisi"
              onPointerDown={onDockResizePointerDown}
              onPointerMove={onResizePointerMove}
              onPointerEnd={finishResize}
            />
            <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-slate-950/50">
              <KbAnalysisDock
                doc={selectedDoc}
                disabled={disabled}
                actions={dockActions}
                onUpdateDoc={(patch) => onUpdateDocument(selectedDoc.id, patch)}
              />
            </aside>
          </>
        ) : null}
      </div>
    </div>
  );
}
