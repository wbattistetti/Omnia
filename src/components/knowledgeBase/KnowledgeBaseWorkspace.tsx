/**
 * KB workspace: lista documenti | tab host (Analisi del documento / Documento).
 */

import React from 'react';
import type { StagedKbDocument, KbDocumentPatch } from '@domain/knowledgeBase/kbDocumentTypes';
import type { AiCallMeta } from '@services/aiAgentDesignApi';
import type { KbDocumentAnalysisTaskContext } from '@domain/knowledgeBase/kbDocumentAnalysisApi';
import { estimateKbListWidthPx } from '@domain/knowledgeBase/kbDocumentListDnD';
import {
  KnowledgeBaseFileDropZone,
  type KnowledgeBaseFileDropZoneHandle,
} from './KnowledgeBaseFileDropZone';
import { KbDocumentList } from './KbDocumentList';
import { KbWorkspaceTabHost } from './KbWorkspaceTabHost';
import { KB_DOCUMENT_ACCEPT } from '@domain/knowledgeBase/kbFileKinds';
import { KB_WORKSPACE_ROOT, kbType } from './kbTypography';

const SPLIT_COL = '6px';
const DEFAULT_LIST_WIDTH_PX = 220;
const MIN_LIST_WIDTH_PX = 140;
const MAX_LIST_WIDTH_RATIO = 0.45;

export type KnowledgeBaseWorkspaceProps = {
  documents: readonly StagedKbDocument[];
  projectId?: string;
  callMeta?: AiCallMeta;
  taskContext?: KbDocumentAnalysisTaskContext;
  onAddFiles: (files: File[]) => void;
  onRemoveDocument?: (docId: string) => void;
  onReorderDocuments?: (next: readonly StagedKbDocument[]) => void;
  onUpdateDocument: (docId: string, patch: KbDocumentPatch) => void;
  disabled?: boolean;
  emptyHint?: string;
  className?: string;
  tutorDocumentListId?: string;
  tutorAnalysisResultId?: string;
};

type KbResizeState = {
  startX: number;
  startListWidth: number;
  width: number;
};

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
  taskContext,
  onAddFiles,
  onRemoveDocument,
  onReorderDocuments,
  onUpdateDocument,
  disabled = false,
  emptyHint = 'Trascina documenti (.txt, .md, .csv, .json, .xlsx, .pdf, .docx, .jpg, .png…)',
  className = '',
  tutorDocumentListId,
  tutorAnalysisResultId,
}: KnowledgeBaseWorkspaceProps): React.ReactElement {
  const dropRef = React.useRef<KnowledgeBaseFileDropZoneHandle>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [listWidthPx, setListWidthPx] = React.useState(DEFAULT_LIST_WIDTH_PX);
  const resizeRef = React.useRef<KbResizeState | null>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const userResizedListRef = React.useRef(false);

  const canEdit = !disabled;

  React.useEffect(() => {
    if (documents.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !documents.some((d) => d.id === selectedId)) {
      setSelectedId(documents[documents.length - 1]!.id);
    }
  }, [documents, selectedId]);

  React.useEffect(() => {
    if (userResizedListRef.current) return;
    const w = bodyRef.current?.clientWidth ?? 900;
    setListWidthPx(
      estimateKbListWidthPx(documents, MIN_LIST_WIDTH_PX, MAX_LIST_WIDTH_RATIO, w)
    );
  }, [documents]);

  const selectedDoc = React.useMemo(
    () => documents.find((d) => d.id === selectedId) ?? null,
    [documents, selectedId]
  );

  const imageDocIds = React.useMemo(
    () => documents.filter((d) => d.format === 'image').map((d) => d.id),
    [documents]
  );

  const isEmptyWorkspace = documents.length === 0;
  const gridColumns = isEmptyWorkspace
    ? 'minmax(0, 1fr)'
    : `${Math.round(listWidthPx)}px ${SPLIT_COL} minmax(0, 1fr)`;

  const onListResizePointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      userResizedListRef.current = true;
      const w = bodyRef.current?.clientWidth ?? 800;
      resizeRef.current = {
        startX: e.clientX,
        startListWidth: listWidthPx,
        width: w,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [listWidthPx]
  );

  const onResizePointerMove = React.useCallback((e: React.PointerEvent) => {
    const st = resizeRef.current;
    if (!st || st.width <= 0) return;
    const maxList = Math.floor(st.width * MAX_LIST_WIDTH_RATIO);
    const delta = e.clientX - st.startX;
    setListWidthPx(
      Math.min(maxList, Math.max(MIN_LIST_WIDTH_PX, st.startListWidth + delta))
    );
  }, []);

  const finishResize = React.useCallback(() => {
    resizeRef.current = null;
  }, []);

  const handleReorder = React.useCallback(
    (next: StagedKbDocument[]) => {
      onReorderDocuments?.(next);
    },
    [onReorderDocuments]
  );

  return (
    <div
      className={'flex min-h-0 flex-1 flex-col ' + KB_WORKSPACE_ROOT + ' ' + className}
      data-kb-workspace="v4-document-analysis"
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-violet-800/50 bg-violet-950/30 px-2 py-2">
        <p className={kbType.accent + ' font-medium'}>Documenti knowledge base</p>
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => dropRef.current?.openPicker()}
          className="rounded-md border border-violet-500/80 bg-violet-700/50 px-3 py-1 font-medium text-violet-50 hover:bg-violet-600/60 disabled:opacity-60"
        >
          Aggiungi documento
        </button>
      </header>

      <div
        ref={bodyRef}
        className="relative grid min-h-0 flex-1 overflow-hidden"
        style={{ gridTemplateColumns: gridColumns }}
      >
        {isEmptyWorkspace ? (
          <KnowledgeBaseFileDropZone
            ref={dropRef}
            accept={KB_DOCUMENT_ACCEPT}
            disabled={!canEdit}
            onFiles={(files) => onAddFiles(files)}
            className="min-h-0 min-w-0 flex-1"
          >
            <KbDocumentList
              documents={documents}
              selectedId={selectedId}
              disabled={disabled}
              onSelect={setSelectedId}
              onReorder={handleReorder}
              onRemove={onRemoveDocument}
              emptyFormatsHint={emptyHint}
              tutorListId={tutorDocumentListId}
            />
          </KnowledgeBaseFileDropZone>
        ) : (
          <>
            <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden">
              <KnowledgeBaseFileDropZone
                ref={dropRef}
                accept={KB_DOCUMENT_ACCEPT}
                disabled={!canEdit}
                onFiles={(files) => onAddFiles(files)}
                className="min-h-0 flex-1"
              >
                <KbDocumentList
                  documents={documents}
                  selectedId={selectedId}
                  disabled={disabled}
                  onSelect={setSelectedId}
                  onReorder={handleReorder}
                  onRemove={onRemoveDocument}
                  tutorListId={tutorDocumentListId}
                />
              </KnowledgeBaseFileDropZone>
            </aside>

            <KbColumnSplitter
              ariaLabel="Ridimensiona lista documenti"
              onPointerDown={onListResizePointerDown}
              onPointerMove={onResizePointerMove}
              onPointerEnd={finishResize}
            />

            {selectedDoc ? (
              <KbWorkspaceTabHost
                doc={selectedDoc}
                projectId={projectId}
                disabled={disabled}
                callMeta={callMeta}
                taskContext={taskContext}
                imageDocIds={imageDocIds}
                onSelectDocumentId={setSelectedId}
                onUpdateDoc={(patch) => onUpdateDocument(selectedDoc.id, patch)}
                tutorAnalysisResultId={tutorAnalysisResultId}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
