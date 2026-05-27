/**
 * Livello 1: editor Monaco per analisi dettaglio parametro con diff arancione e revisione.
 */

import React from 'react';
import { X } from 'lucide-react';
import { paramDetailSectionId } from '@domain/backendAnalysis/backendAnalysisSectionIds';
import { useAgentBackendAnalysis } from './AgentBackendAnalysisContext';
import { BackendAnalysisSectionWithReview } from './backendAnalysis/BackendAnalysisSectionWithReview';

export function BackendParameterL1EditorSheet(): React.ReactElement | null {
  const { editingParam, setEditingParam, document, persistDocument } = useAgentBackendAnalysis();
  if (!editingParam) return null;

  const backend = document.backends[editingParam.catalogEntryId];
  const param = backend?.parameters[editingParam.paramKey];
  if (!backend || !param) return null;

  const sectionId = paramDetailSectionId(backend.catalogEntryId, param.paramKey);

  const saveDetail = (analysisDetailMarkdown: string) => {
    persistDocument({
      ...document,
      backends: {
        ...document.backends,
        [backend.catalogEntryId]: {
          ...backend,
          parameters: {
            ...backend.parameters,
            [param.paramKey]: {
              ...param,
              analysisDetailMarkdown,
            },
          },
        },
      },
    });
  };

  return (
    <div
      className="fixed inset-y-0 right-0 z-[60] flex w-[min(480px,94vw)] flex-col border-l border-emerald-800/50 bg-slate-950 shadow-2xl"
      role="dialog"
      aria-label={`Modifica analisi ${param.paramKey}`}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-emerald-300/90">
            Analisi parametro (Livello 1)
          </p>
          <h2 className="font-mono text-sm font-semibold text-slate-100">{param.paramKey}</h2>
        </div>
        <button
          type="button"
          className="rounded p-1 text-slate-400 hover:bg-slate-800"
          onClick={() => setEditingParam(null)}
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <BackendAnalysisSectionWithReview
          sectionId={sectionId}
          value={param.analysisDetailMarkdown}
          onValueChange={saveDetail}
          minHeightPx={280}
          ariaLabel={`Analisi dettaglio ${param.paramKey}`}
        />
      </div>
    </div>
  );
}
