/**
 * KB document list with HTML5 reorder (preview line + placement like Response sidebar).
 */

import React from 'react';
import type { StagedKbDocument } from '@domain/knowledgeBase/kbDocumentTypes';
import { reorderKbDocuments } from '@domain/knowledgeBase/kbDocumentListDnD';
import { DropPreviewLine } from '@components/FlowMappingPanel/backendMappingTreeDnD';
import { dropPlacementFromEvent } from '@components/TaskEditor/ResponseEditor/Sidebar/useSidebarDropIndicator';
import { KnowledgeBaseDocumentCard } from './KnowledgeBaseDocumentCard';

export type KbDocumentListProps = {
  documents: readonly StagedKbDocument[];
  selectedId: string | null;
  disabled?: boolean;
  onSelect: (docId: string) => void;
  onReorder: (next: StagedKbDocument[]) => void;
  onRemove?: (docId: string) => void;
  /** Elenco formati ammessi (empty state a workspace vuoto). */
  emptyFormatsHint?: string;
  /** Active Tutor — data-tutor-id lista documenti. */
  tutorListId?: string;
};

type DropIndicator = {
  targetIndex: number;
  placement: 'before' | 'after';
};

export function KbDocumentList({
  documents,
  selectedId,
  disabled = false,
  onSelect,
  onReorder,
  onRemove,
  emptyFormatsHint,
  tutorListId,
}: KbDocumentListProps): React.ReactElement {
  const dragRef = React.useRef<{ fromIdx: number | null }>({ fromIdx: null });
  const [dropIndicator, setDropIndicator] = React.useState<DropIndicator | null>(null);

  const applyReorder = React.useCallback(
    (fromIdx: number, targetIdx: number, placement: 'before' | 'after') => {
      onReorder(reorderKbDocuments(documents, fromIdx, targetIdx, placement));
    },
    [documents, onReorder]
  );

  if (documents.length === 0) {
    const formats = emptyFormatsHint?.trim();
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
        <p className="text-sm font-medium text-slate-300">Nessun documento.</p>
        <p className="text-sm text-slate-400">Trascina file qui.</p>
        {formats ? (
          <p className="max-w-md text-xs leading-relaxed text-slate-500">{formats}</p>
        ) : null}
      </div>
    );
  }

  return (
    <ul
      className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1.5"
      {...(tutorListId ? { 'data-tutor-id': tutorListId } : {})}
    >
      {documents.map((doc, i) => {
        const showBefore =
          dropIndicator?.targetIndex === i && dropIndicator.placement === 'before';
        const showAfter =
          dropIndicator?.targetIndex === i && dropIndicator.placement === 'after';

        return (
          <li key={doc.id} className="list-none">
            {showBefore ? <DropPreviewLine indentPx={4} tone="teal" /> : null}
            <div
              draggable={!disabled}
              onDragStart={(e) => {
                dragRef.current = { fromIdx: i };
                try {
                  e.dataTransfer.setData('text/plain', doc.id);
                  e.dataTransfer.effectAllowed = 'move';
                } catch {
                  /* ignore */
                }
              }}
              onDragOver={(e) => {
                if (dragRef.current.fromIdx === null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const placement = dropPlacementFromEvent(e, e.currentTarget as HTMLElement);
                setDropIndicator({ targetIndex: i, placement });
              }}
              onDragLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                if (!el.contains(e.relatedTarget as Node)) setDropIndicator(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const fromIdx = dragRef.current.fromIdx;
                const placement =
                  dropIndicator?.targetIndex === i
                    ? dropIndicator.placement
                    : dropPlacementFromEvent(e, e.currentTarget as HTMLElement);
                if (fromIdx !== null && fromIdx !== i) {
                  applyReorder(fromIdx, i, placement);
                }
                dragRef.current = { fromIdx: null };
                setDropIndicator(null);
              }}
              onDragEnd={() => {
                dragRef.current = { fromIdx: null };
                setDropIndicator(null);
              }}
            >
              <KnowledgeBaseDocumentCard
                doc={doc}
                selected={doc.id === selectedId}
                disabled={disabled}
                onSelect={() => onSelect(doc.id)}
                onRemove={onRemove ? () => onRemove(doc.id) : undefined}
              />
            </div>
            {showAfter ? <DropPreviewLine indentPx={4} tone="teal" /> : null}
          </li>
        );
      })}
    </ul>
  );
}
