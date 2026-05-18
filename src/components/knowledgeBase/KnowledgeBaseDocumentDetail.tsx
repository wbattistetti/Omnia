/**
 * Center column: document title, Analyze, reader (full text).
 */

import React from 'react';
import type { StagedKbDocument, KbDocumentPatch } from '@domain/knowledgeBase/kbDocumentTypes';
import type { useKbDocumentActions } from './useKbDocumentActions';
import { useKbDocumentContent } from './useKbDocumentContent';
import { KnowledgeBaseDocumentReader } from './KnowledgeBaseDocumentReader';
import { Loader2, Sparkles } from 'lucide-react';

export type KnowledgeBaseDocumentDetailProps = {
  doc: StagedKbDocument;
  projectId?: string;
  disabled?: boolean;
  actions: ReturnType<typeof useKbDocumentActions>;
  onUpdateDoc: (patch: KbDocumentPatch) => void;
};

export function KnowledgeBaseDocumentDetail({
  doc,
  projectId,
  disabled = false,
  actions,
  onUpdateDoc,
}: KnowledgeBaseDocumentDetailProps): React.ReactElement {
  const repoId = doc.repositoryDocumentId?.trim();
  const content = useKbDocumentContent(projectId, repoId);

  const { canAnalyze, hasModel, analyzeBusy, actionError, runAnalyze } = actions;

  const [chipCopied, setChipCopied] = React.useState<string | null>(null);

  const handleChipClick = React.useCallback(async (placeholder: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(placeholder);
        setChipCopied(placeholder);
        window.setTimeout(() => setChipCopied(null), 1400);
      }
    } catch {
      setChipCopied(null);
    }
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 space-y-2 border-b border-slate-800 px-3 py-2">
        <h3 className="truncate font-semibold text-slate-100" title={doc.name}>
          {doc.name}
        </h3>
        {doc.parseStatus === 'error' ? (
          <p className="text-inherit text-rose-300">{doc.parseError}</p>
        ) : null}
        {doc.parseStatus === 'parsing' ? (
          <p className="flex items-center gap-2 text-inherit text-slate-400">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Caricamento repository…
          </p>
        ) : null}
        {!repoId && doc.parseStatus !== 'parsing' ? (
          <p className="text-inherit text-amber-300/90">Salvataggio repository in corso…</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!canAnalyze || analyzeBusy}
            onClick={() => void runAnalyze()}
            className="inline-flex items-center gap-1 rounded-md border border-violet-600/70 bg-violet-950/50 px-2 py-0.5 text-inherit font-semibold text-violet-100 hover:bg-violet-900/40 disabled:opacity-50"
          >
            {analyzeBusy ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-3 w-3" aria-hidden />
            )}
            Analyze
          </button>
          {doc.analysisNote ? (
            <span className="text-inherit text-slate-500">{doc.analysisNote}</span>
          ) : null}
        </div>
        {actionError ? <p className="text-inherit text-rose-300">{actionError}</p> : null}
        {!hasModel ? (
          <p className="text-inherit text-slate-500">Seleziona un modello IA in Impostazioni.</p>
        ) : null}
        {doc.variables.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {doc.variables.map((v) => (
              <button
                key={`${v.internalName}-${v.sourceColumn}`}
                type="button"
                title={`Colonna «${v.sourceColumn}»`}
                onClick={() => void handleChipClick(v.placeholder)}
                className={
                  'rounded-full px-2 py-0.5 text-inherit font-medium ' +
                  (chipCopied === v.placeholder
                    ? 'bg-sky-200 text-sky-950'
                    : 'bg-sky-300/90 text-sky-950 hover:bg-sky-200')
                }
              >
                {v.internalName}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <KnowledgeBaseDocumentReader
        documentName={doc.name}
        format={doc.format}
        projectId={projectId}
        repositoryDocumentId={repoId}
        knownColumnHeaders={doc.variables.map((v) => v.sourceColumn)}
        text={content.text}
        loading={content.loading}
        error={content.error}
        truncated={content.truncated}
        totalChars={content.totalChars}
        className="min-h-0 flex-1 border-0 bg-transparent"
      />
    </div>
  );
}
