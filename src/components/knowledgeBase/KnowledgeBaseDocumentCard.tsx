/**
 * KB document row: icon, filename, hover trash; drag handle is on parent wrapper.
 */

import React from 'react';
import type { StagedKbDocument } from '@domain/knowledgeBase/kbDocumentTypes';
import { Loader2, Trash2 } from 'lucide-react';
import { KbFormatIcon } from '@domain/knowledgeBase/kbFileKindIcons';

export type KnowledgeBaseDocumentCardProps = {
  doc: StagedKbDocument;
  selected?: boolean;
  disabled?: boolean;
  onSelect: () => void;
  onRemove?: () => void;
};

export function KnowledgeBaseDocumentCard({
  doc,
  selected = false,
  disabled = false,
  onSelect,
  onRemove,
}: KnowledgeBaseDocumentCardProps): React.ReactElement {
  const ruleCount = doc.rules.filter((r) => r.included && !r.deleted).length;

  return (
    <div
      className={
        'group flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1.5 transition-colors ' +
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
        ) : (
          <KbFormatIcon format={doc.format} fileName={doc.name} mimeType={doc.mimeType} />
        )}
        <span className="min-w-0 whitespace-nowrap font-medium text-slate-100" title={doc.name}>
          {doc.name}
        </span>
        {ruleCount > 0 ? (
          <span className="shrink-0 rounded bg-violet-950/80 px-1.5 py-0.5 text-violet-300">
            {ruleCount}
          </span>
        ) : null}
      </button>
      {onRemove ? (
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="shrink-0 rounded p-0.5 text-slate-500 opacity-0 transition-opacity hover:bg-rose-950/50 hover:text-rose-300 group-hover:opacity-100 focus:opacity-100"
          aria-label={`Rimuovi ${doc.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
