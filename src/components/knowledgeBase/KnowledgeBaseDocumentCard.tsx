/**
 * KB document row in the list: select, focus (maximize detail), remove.
 */

import React from 'react';
import type { StagedKbDocument } from '@domain/knowledgeBase/kbDocumentTypes';
import { Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { KbFormatIcon } from '@domain/knowledgeBase/kbFileKindIcons';

export type KnowledgeBaseDocumentCardProps = {
  doc: StagedKbDocument;
  selected?: boolean;
  focusMode?: boolean;
  disabled?: boolean;
  onSelect: () => void;
  onToggleFocus: () => void;
  onRemove?: () => void;
};

export function KnowledgeBaseDocumentCard({
  doc,
  selected = false,
  focusMode = false,
  disabled = false,
  onSelect,
  onToggleFocus,
  onRemove,
}: KnowledgeBaseDocumentCardProps): React.ReactElement {
  const ruleCount = doc.rules.filter((r) => r.included && !r.deleted).length;

  return (
    <li>
      <div
        className={
          'flex items-center gap-1 rounded-md border px-2 py-1.5 transition-colors ' +
          (selected
            ? 'border-violet-500/50 bg-violet-950/50 text-slate-200'
            : 'border-slate-700/60 bg-slate-900/50 text-slate-300 hover:border-slate-600')
        }
      >
        <button
          type="button"
          disabled={disabled}
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-center gap-2 rounded py-0.5 text-left"
        >
          {doc.parseStatus === 'parsing' ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-400" aria-hidden />
          ) : doc.parseStatus === 'error' ? (
            <KbFormatIcon
              format={doc.format}
              fileName={doc.name}
              mimeType={doc.mimeType}
              className="h-4 w-4 shrink-0 opacity-60"
            />
          ) : (
            <KbFormatIcon format={doc.format} fileName={doc.name} mimeType={doc.mimeType} />
          )}
          <span className="min-w-0 truncate font-medium text-slate-100" title={doc.name}>
            {doc.name}
          </span>
          {ruleCount > 0 ? (
            <span className="shrink-0 rounded bg-violet-950/80 px-1.5 py-0.5 text-violet-300">
              {ruleCount}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          disabled={disabled || !selected}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFocus();
          }}
          title={focusMode ? 'Mostra lista documenti' : 'Espandi nel contenitore'}
          aria-label={focusMode ? 'Comprimi' : 'Espandi'}
          aria-pressed={focusMode}
          className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-violet-200 disabled:opacity-40"
        >
          {focusMode ? (
            <Minimize2 className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>
        {onRemove ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="shrink-0 rounded px-1 py-0.5 text-slate-400 hover:text-rose-300"
            aria-label={`Rimuovi ${doc.name}`}
          >
            Rimuovi
          </button>
        ) : null}
      </div>
    </li>
  );
}
