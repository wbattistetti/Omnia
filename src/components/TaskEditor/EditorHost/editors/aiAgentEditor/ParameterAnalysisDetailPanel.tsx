/**
 * Livello 2: pannello laterale read-only con analisi parametro da documento V2.
 */

import React from 'react';
import { X } from 'lucide-react';
import { KbMarkdownMonaco } from '@components/workspaces/elevenlabs/kb/KbMarkdownMonaco';
import { useOptionalAgentBackendAnalysis } from './AgentBackendAnalysisContext';

export function ParameterAnalysisDetailPanel(): React.ReactElement | null {
  const ctx = useOptionalAgentBackendAnalysis();
  if (!ctx?.parameterPanel) return null;

  const { catalogEntryId, paramKey, displayLabel } = ctx.parameterPanel;
  const record = ctx.resolveParam(catalogEntryId, paramKey);
  const markdown =
    record?.analysisDetailMarkdown?.trim() ||
    '_Nessuna analisi definita per questo parametro. Compilala nel tab Analisi backend (Livello 1)._';

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 flex w-[min(420px,92vw)] flex-col border-l border-violet-800/60 bg-slate-950 shadow-2xl"
      role="dialog"
      aria-label={`Analisi parametro ${paramKey}`}
    >
      <header className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-800 px-4 py-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-violet-300/90">Parametro</p>
          <h2 className="font-mono text-sm font-semibold text-slate-100">{paramKey}</h2>
          <p className="text-xs text-slate-500">
            Backend: {displayLabel}
            <span className="ml-2 text-slate-600">(sola lettura — modifica da Analisi backend)</span>
          </p>
        </div>
        <button
          type="button"
          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          onClick={ctx.closeParameterPanel}
          aria-label="Chiudi"
        >
          <X className="h-5 w-5" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden p-3">
        {record?.analysisSummary ? (
          <p className="mb-2 text-sm text-violet-100/90">{record.analysisSummary}</p>
        ) : null}
        <KbMarkdownMonaco
          value={markdown}
          readOnly
          fillHeight
          appearance="plain"
          ariaLabel={`Analisi dettaglio ${paramKey}`}
        />
      </div>
    </div>
  );
}
