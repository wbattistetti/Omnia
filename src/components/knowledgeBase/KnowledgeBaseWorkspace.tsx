/**

 * KB workspace: list | reader (center) | analysis dock (pills, rules, chat).

 */



import React from 'react';

import type { StagedKbDocument, KbDocumentPatch } from '@domain/knowledgeBase/kbDocumentTypes';

import type { AiCallMeta } from '@services/aiAgentDesignApi';

import type { KbSemanticTaskContext } from '@services/kbSemanticAnalysisApi';

import type { AIAgentUseCase } from '@types/aiAgentUseCases';

import { estimateKbListWidthPx } from '@domain/knowledgeBase/kbDocumentListDnD';

import {

  KnowledgeBaseFileDropZone,

  type KnowledgeBaseFileDropZoneHandle,

} from './KnowledgeBaseFileDropZone';

import { KbDocumentList } from './KbDocumentList';

import { KnowledgeBaseDocumentDetail } from './KnowledgeBaseDocumentDetail';

import { KbAnalysisDock } from './KbAnalysisDock';

import { useKbDocumentActions } from './useKbDocumentActions';

import { KB_DOCUMENT_ACCEPT } from '@domain/knowledgeBase/kbFileKinds';

import { KB_WORKSPACE_ROOT, kbType } from './kbTypography';
import { useKbDocumentContent } from './useKbDocumentContent';
import { kbDocumentPatchOnSelect } from '@domain/knowledgeBase/kbAnalysisSession';



const SPLIT_COL = '6px';

const DEFAULT_LIST_WIDTH_PX = 220;

const MIN_LIST_WIDTH_PX = 140;

const MAX_LIST_WIDTH_RATIO = 0.45;



export type KnowledgeBaseWorkspaceProps = {

  documents: readonly StagedKbDocument[];

  projectId?: string;

  callMeta?: AiCallMeta;

  taskContext?: KbSemanticTaskContext;

  existingUseCaseCount?: number;

  onMergePromotedUseCases?: (useCases: AIAgentUseCase[]) => void;

  existingBundleUseCases?: readonly AIAgentUseCase[];

  regeneratePromotedUseCase?: (skeleton: AIAgentUseCase) => Promise<AIAgentUseCase | null>;

  onAddFiles: (files: File[]) => void;

  onRemoveDocument?: (docId: string) => void;

  onReorderDocuments?: (next: readonly StagedKbDocument[]) => void;

  onUpdateDocument: (docId: string, patch: KbDocumentPatch) => void;

  disabled?: boolean;

  emptyHint?: string;

  className?: string;

};



function buildGridColumns(

  hasDoc: boolean,

  listWidthPx: number,

  dockShare: number,

  readerExpanded: boolean

): string {

  const listCol = `${Math.round(listWidthPx)}px`;

  if (!hasDoc) {

    return `${listCol} ${SPLIT_COL} minmax(0, 1fr)`;

  }

  if (readerExpanded) {

    return `${listCol} ${SPLIT_COL} minmax(0, 1fr)`;

  }

  const dockCol = `minmax(160px, ${Math.round(dockShare * 100)}%)`;

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

  taskContext,

  existingUseCaseCount = 0,

  onMergePromotedUseCases,

  existingBundleUseCases = [],

  regeneratePromotedUseCase,

  onAddFiles,

  onRemoveDocument,

  onReorderDocuments,

  onUpdateDocument,

  disabled = false,

  emptyHint = 'Trascina documenti (.txt, .md, .csv, .json, .xlsx, .pdf, .docx, .jpg, .png…)',

  className = '',

}: KnowledgeBaseWorkspaceProps): React.ReactElement {

  const dropRef = React.useRef<KnowledgeBaseFileDropZoneHandle>(null);

  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const [readerExpanded, setReaderExpanded] = React.useState(false);
  const [dockExpanded, setDockExpanded] = React.useState(false);

  const [listWidthPx, setListWidthPx] = React.useState(DEFAULT_LIST_WIDTH_PX);

  const [dockShare, setDockShare] = React.useState(0.34);

  const resizeRef = React.useRef<KbResizeState | null>(null);

  const bodyRef = React.useRef<HTMLDivElement>(null);

  const userResizedListRef = React.useRef(false);



  const canEdit = !disabled;



  React.useEffect(() => {

    if (documents.length === 0) {

      setSelectedId(null);

      setReaderExpanded(false);
      setDockExpanded(false);

      return;

    }

    if (!selectedId || !documents.some((d) => d.id === selectedId)) {

      setSelectedId(documents[documents.length - 1]!.id);

    }

  }, [documents, selectedId]);

  React.useEffect(() => {
    setDockExpanded(false);
  }, [selectedId]);

  const onToggleReaderExpanded = React.useCallback(() => {
    setReaderExpanded((prev) => {
      const next = !prev;
      if (next) setDockExpanded(false);
      return next;
    });
  }, []);

  const onToggleDockExpanded = React.useCallback(() => {
    setDockExpanded((prev) => {
      const next = !prev;
      if (next) setReaderExpanded(false);
      return next;
    });
  }, []);

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

  React.useEffect(() => {

    if (!selectedId) return;

    const doc = documents.find((d) => d.id === selectedId);

    if (!doc) return;

    const patch = kbDocumentPatchOnSelect(doc);

    if (patch) onUpdateDocument(selectedId, patch);

  }, [selectedId, documents, onUpdateDocument]);



  const imageDocIds = React.useMemo(

    () => documents.filter((d) => d.format === 'image').map((d) => d.id),

    [documents]

  );



  const selectedRepoId = selectedDoc?.repositoryDocumentId?.trim();
  const selectedContent = useKbDocumentContent(projectId, selectedRepoId);

  const dockActions = useKbDocumentActions({
    doc: selectedDoc,
    projectId,
    disabled,
    callMeta,
    taskContext,
    existingUseCaseCount,
    onMergePromotedUseCases,
    existingBundleUseCases,
    regeneratePromotedUseCase,
    onUpdateDoc: onUpdateDocument,
  });



  const gridColumns = buildGridColumns(

    Boolean(selectedDoc),

    listWidthPx,

    dockShare,

    readerExpanded

  );



  const onListResizePointerDown = React.useCallback(

    (e: React.PointerEvent) => {

      e.preventDefault();

      userResizedListRef.current = true;

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



  const handleReorder = React.useCallback(

    (next: StagedKbDocument[]) => {

      onReorderDocuments?.(next);

    },

    [onReorderDocuments]

  );



  return (

    <div

      className={'flex min-h-0 flex-1 flex-col ' + KB_WORKSPACE_ROOT + ' ' + className}

      data-kb-workspace="v3-guided"

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

            />

          </KnowledgeBaseFileDropZone>

        </aside>



        <KbColumnSplitter

          ariaLabel="Ridimensiona lista documenti"

          onPointerDown={onListResizePointerDown}

          onPointerMove={onResizePointerMove}

          onPointerEnd={finishResize}

        />



        <main className="relative flex min-h-0 min-w-0 flex-col overflow-hidden bg-slate-950/40">

          {selectedDoc ? (

            <KnowledgeBaseDocumentDetail

              doc={selectedDoc}

              projectId={projectId}

              disabled={disabled}
              readerExpanded={readerExpanded}

              onToggleReaderExpanded={onToggleReaderExpanded}

              imageDocIds={imageDocIds}

              onSelectDocumentId={setSelectedId}

              onUpdateDoc={(patch) => onUpdateDocument(selectedDoc.id, patch)}

            />

          ) : (

            <p className="flex flex-1 items-center justify-center px-4 text-center text-slate-500">

              {emptyHint}

            </p>

          )}

        </main>



        {selectedDoc && !readerExpanded ? (

          <>

            {!dockExpanded ? (
              <KbColumnSplitter
                ariaLabel="Ridimensiona pannello analisi"
                onPointerDown={onDockResizePointerDown}
                onPointerMove={onResizePointerMove}
                onPointerEnd={finishResize}
              />
            ) : null}

            <aside
              className={
                'flex min-h-0 min-w-0 flex-col overflow-hidden ' +
                (dockExpanded
                  ? 'absolute z-30 border-l border-violet-800/50 bg-slate-950 shadow-2xl shadow-black/40'
                  : 'bg-slate-950/80')
              }
              style={
                dockExpanded
                  ? {
                      left: listWidthPx + 6,
                      top: 0,
                      right: 0,
                      bottom: 0,
                    }
                  : undefined
              }
            >
              <KbAnalysisDock
                doc={selectedDoc}
                disabled={disabled}
                actions={dockActions}
                dockExpanded={dockExpanded}
                onToggleDockExpanded={onToggleDockExpanded}
                readerError={selectedContent.error}
                onUpdateDoc={(patch) => onUpdateDocument(selectedDoc.id, patch)}
              />
            </aside>

          </>

        ) : null}

      </div>

    </div>

  );

}

