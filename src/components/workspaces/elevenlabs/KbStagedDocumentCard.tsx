/**
 * KB file accordion: icon + name; expanded chips + How to use + Markdown snippet editor.
 */

import React from 'react';
import type { StagedKbDocument } from '@workspaces/elevenlabs/elevenLabsStagedNodeFiles';
import { analyzeKbDocumentSnippet } from '@workspaces/elevenlabs/api/kbPromptApi';
import { useAIProvider } from '@context/AIProviderContext';
import { useAiBusyLabel } from '@hooks/useAiBusyLabel';
import { ChevronDown, ChevronRight, FileSpreadsheet, FileText, Loader2, Sparkles } from 'lucide-react';
import { KbMarkdownMonaco } from './kb/KbMarkdownMonaco';

export type KbStagedDocumentCardProps = {
  doc: StagedKbDocument;
  onRemove?: () => void;
  onUpdateDoc: (patch: Partial<Pick<StagedKbDocument, 'howToUseText' | 'markdownSnippet'>>) => void;
};

export function KbStagedDocumentCard({
  doc,
  onRemove,
  onUpdateDoc,
}: KbStagedDocumentCardProps): React.ReactElement {
  const { provider, model } = useAIProvider();
  const { hasModel } = useAiBusyLabel();
  const [listExpanded, setListExpanded] = React.useState(false);
  const [howToOpen, setHowToOpen] = React.useState(false);
  const [analyzeBusy, setAnalyzeBusy] = React.useState(false);
  const [analyzeError, setAnalyzeError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);

  const Icon = doc.format === 'xlsx' ? FileSpreadsheet : FileText;
  const canListExpand =
    doc.parseStatus === 'ready' ||
    doc.parseStatus === 'error' ||
    doc.parseStatus === 'unsupported';
  const howToTrim = doc.howToUseText.trim();
  const showAnalyze = howToOpen && howToTrim.length > 0;

  React.useEffect(() => {
    if (canListExpand) {
      setListExpanded(true);
    }
  }, [doc.id, canListExpand, doc.parseStatus]);

  const toggleList = React.useCallback(() => {
    if (!canListExpand) return;
    setListExpanded((v) => !v);
  }, [canListExpand]);

  const handleChipClick = React.useCallback(async (placeholder: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(placeholder);
        setCopied(placeholder);
        window.setTimeout(() => setCopied(null), 1400);
      }
    } catch {
      setCopied(null);
    }
  }, []);

  const handleAnalyze = React.useCallback(async () => {
    if (!hasModel || !model.trim()) {
      setAnalyzeError('Seleziona un modello IA in Impostazioni (Omnia Tutor).');
      return;
    }
    setAnalyzeBusy(true);
    setAnalyzeError(null);
    try {
      const markdown = await analyzeKbDocumentSnippet({
        documentName: doc.name,
        howToUse: doc.howToUseText,
        variables: doc.variables,
        existingMarkdown: doc.markdownSnippet,
        provider,
        model,
        outputLanguage: 'it-IT',
        callMeta: { purpose: 'EL_KB_SNIPPET' },
      });
      onUpdateDoc({ markdownSnippet: markdown });
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : String(e));
    } finally {
      setAnalyzeBusy(false);
    }
  }, [hasModel, model, provider, doc, onUpdateDoc]);

  return (
    <li className="rounded-md border border-slate-700/60 bg-slate-900/50 text-xs text-slate-300">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button
          type="button"
          onClick={toggleList}
          disabled={!canListExpand}
          aria-expanded={listExpanded}
          className={
            'flex min-w-0 flex-1 items-center gap-2 rounded py-0.5 text-left ' +
            (canListExpand ? 'hover:bg-slate-800/60' : 'cursor-default')
          }
        >
          {canListExpand ? (
            listExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
            )
          ) : (
            <span className="inline-block w-3.5 shrink-0" aria-hidden />
          )}
          {doc.parseStatus === 'parsing' ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-400" aria-hidden />
          ) : (
            <Icon className="h-4 w-4 shrink-0 text-violet-400" aria-hidden />
          )}
          <span className="min-w-0 truncate font-medium text-slate-100" title={doc.name}>
            {doc.name}
          </span>
        </button>
        {onRemove ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-slate-800 hover:text-rose-300"
            aria-label={`Rimuovi ${doc.name}`}
          >
            Rimuovi
          </button>
        ) : null}
      </div>

      {listExpanded && canListExpand ? (
        <div className="border-t border-slate-800/80 px-2.5 pb-2 pt-1.5 space-y-2">
          {doc.parseStatus === 'error' ? (
            <p className="text-[10px] text-rose-300">{doc.parseError ?? 'Errore analisi file'}</p>
          ) : null}
          {doc.parseStatus === 'unsupported' ? (
            <p className="text-[10px] text-slate-500">Solo .txt e .xlsx tabellari</p>
          ) : null}

          {doc.parseStatus === 'ready' && doc.variables.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {doc.variables.map((v) => (
                <button
                  key={`${v.internalName}-${v.sourceColumn}`}
                  type="button"
                  title={`Colonna «${v.sourceColumn}» — clic per copiare ${v.placeholder}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleChipClick(v.placeholder);
                  }}
                  className={
                    'rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-all ' +
                    (copied === v.placeholder
                      ? 'bg-sky-200 text-sky-950 shadow-[0_0_10px_rgba(125,211,252,0.5)]'
                      : 'bg-sky-300/90 text-sky-950 hover:bg-sky-200')
                  }
                >
                  {v.internalName}
                </button>
              ))}
            </div>
          ) : null}

          {doc.parseStatus === 'ready' ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  aria-pressed={howToOpen}
                  onClick={() => setHowToOpen((v) => !v)}
                  className={
                    'rounded-full px-3 py-1 text-[11px] font-semibold transition-all ' +
                    (howToOpen
                      ? 'border border-sky-400 bg-sky-500/30 text-sky-50 shadow-[0_0_14px_rgba(56,189,248,0.55)] ring-1 ring-sky-300/60'
                      : 'border border-slate-600/50 bg-slate-800/40 text-slate-500 opacity-60 hover:opacity-80')
                  }
                >
                  How to use
                </button>
                {showAnalyze ? (
                  <button
                    type="button"
                    disabled={analyzeBusy || !hasModel}
                    onClick={() => void handleAnalyze()}
                    className="inline-flex items-center gap-1 rounded-md border border-violet-600/70 bg-violet-950/50 px-2 py-0.5 text-[11px] font-semibold text-violet-100 hover:bg-violet-900/40 disabled:opacity-50"
                  >
                    {analyzeBusy ? (
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    ) : (
                      <Sparkles className="h-3 w-3" aria-hidden />
                    )}
                    Analyze
                  </button>
                ) : null}
              </div>

              {howToOpen ? (
                <div className="space-y-2">
                  {!doc.howToUseText.trim() ? (
                    <p className="text-[10px] text-slate-500">
                      Descrivi a cosa serve questo documento e come l&apos;agente deve usarlo…
                    </p>
                  ) : null}
                  <KbMarkdownMonaco
                    appearance="plain"
                    language="markdown"
                    value={doc.howToUseText}
                    onChange={(howToUseText) => onUpdateDoc({ howToUseText })}
                    heightPx={96}
                    ariaLabel={`How to use ${doc.name}`}
                  />
                  {analyzeError ? <p className="text-[10px] text-rose-300">{analyzeError}</p> : null}
                  {doc.markdownSnippet.trim() ? (
                    <>
                      <p className="text-[10px] font-medium text-slate-500">Snippet Markdown</p>
                      <KbMarkdownMonaco
                        appearance="plain"
                        value={doc.markdownSnippet}
                        onChange={(markdownSnippet) => onUpdateDoc({ markdownSnippet })}
                        heightPx={140}
                        ariaLabel={`Snippet Markdown ${doc.name}`}
                      />
                    </>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
