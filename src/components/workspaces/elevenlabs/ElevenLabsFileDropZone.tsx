/**
 * File picker + drag-and-drop zone for ElevenLabs workspace panels (KB documents, tool defs).
 * Re-exports shared {@link KnowledgeBaseFileDropZone}.
 */

export {
  KnowledgeBaseFileDropZone as ElevenLabsFileDropZone,
  type KnowledgeBaseFileDropZoneHandle as ElevenLabsFileDropZoneHandle,
  type KnowledgeBaseFileDropZoneProps as ElevenLabsFileDropZoneProps,
} from '@components/knowledgeBase/KnowledgeBaseFileDropZone';

export { formatKbFileSize as formatStagedFileSize } from '@domain/knowledgeBase/kbDocumentTypes';

export type StagedFileListRowProps = {
  name: string;
  size: number;
  badge?: string;
  onRemove?: () => void;
  icon?: React.ReactNode;
};

import React from 'react';
import { formatKbFileSize } from '@domain/knowledgeBase/kbDocumentTypes';

export function StagedFileListRow({
  name,
  size,
  badge,
  onRemove,
  icon,
}: StagedFileListRowProps): React.ReactElement {
  return (
    <li className="flex items-start gap-2 rounded-md border border-slate-700/60 bg-slate-900/50 px-2.5 py-2 text-xs text-slate-300">
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{name}</span>
          {badge ? (
            <span className="rounded bg-violet-950/80 px-1.5 py-0.5 text-[10px] font-medium text-violet-300">
              {badge}
            </span>
          ) : null}
        </span>
        <span className="text-[10px] text-slate-500">{formatKbFileSize(size)}</span>
      </span>
      {onRemove ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-slate-800 hover:text-rose-300"
          aria-label={`Rimuovi ${name}`}
        >
          Rimuovi
        </button>
      ) : null}
    </li>
  );
}
