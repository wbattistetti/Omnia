/**
 * Review portal — Knowledge Base tab (read-only snapshot from publish).
 */

import React from 'react';
import type { AgentReviewKnowledgeBaseSnapshot } from '@omnia/domain-core/review/reviewSnapshots';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface ReviewKnowledgeBasePanelProps {
  snapshot: AgentReviewKnowledgeBaseSnapshot | null;
}

export function ReviewKnowledgeBasePanel({
  snapshot,
}: ReviewKnowledgeBasePanelProps): React.ReactElement {
  const documents = snapshot?.documents ?? [];

  if (documents.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-500">
        Nessun documento Knowledge Base in questa review. Aggiungi documenti in Omnia e ripubblica.
      </div>
    );
  }

  return (
    <ul className="h-full min-h-0 space-y-2 overflow-y-auto p-3">
      {documents.map((doc) => (
        <li
          key={doc.id}
          className="rounded-lg border border-slate-700/80 bg-slate-900/50 px-3 py-2.5"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium text-slate-100">{doc.name}</span>
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              {doc.parseStatus}
              {doc.format ? ` · ${doc.format}` : ''}
              {doc.size ? ` · ${formatSize(doc.size)}` : ''}
            </span>
          </div>
          {doc.howToUseText?.trim() ? (
            <p className="mt-2 text-xs leading-relaxed text-slate-400">{doc.howToUseText}</p>
          ) : null}
          {doc.markdownSnippet?.trim() ? (
            <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-slate-950/60 p-2 text-[11px] text-slate-400">
              {doc.markdownSnippet}
            </pre>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
