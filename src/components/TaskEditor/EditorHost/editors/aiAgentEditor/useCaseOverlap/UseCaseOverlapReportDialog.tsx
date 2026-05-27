/**
 * Report verifica sovrapposizioni globali sul catalogo use case.
 */

import React from 'react';
import { X } from 'lucide-react';
import type { UseCaseOverlapReport } from '@domain/useCaseOverlap/useCaseOverlapApi';
import { overlapClassificationLabel } from '@domain/useCaseOverlap/useCaseOverlapApi';

export type UseCaseOverlapReportDialogProps = {
  readonly open: boolean;
  readonly report: UseCaseOverlapReport | null;
  readonly busy?: boolean;
  readonly error?: string | null;
  readonly onClose: () => void;
  /** Stub: fusione cluster. */
  readonly onMergeCluster?: (clusterId: string) => void;
  /** Stub: apri use case correlato. */
  readonly onSelectUseCase?: (useCaseId: string) => void;
};

export function UseCaseOverlapReportDialog({
  open,
  report,
  busy = false,
  error = null,
  onClose,
  onMergeCluster,
  onSelectUseCase,
}: UseCaseOverlapReportDialogProps): React.ReactElement | null {
  if (!open) return null;

  const handleMergeCluster = (clusterId: string): void => {
    onMergeCluster?.(clusterId);
  };

  const handleSelectUseCase = (useCaseId: string): void => {
    onSelectUseCase?.(useCaseId);
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="uc-overlap-report-title"
    >
      <div className="flex max-h-[min(85vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-violet-500/35 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between gap-2 border-b border-slate-700/60 px-3 py-2">
          <h2 id="uc-overlap-report-title" className="text-sm font-semibold text-slate-100">
            Sovrapposizioni catalogo
          </h2>
          <button
            type="button"
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            onClick={onClose}
            aria-label="Chiudi"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 text-xs text-slate-300">
          {busy ? (
            <p className="text-slate-500">Analisi in corso…</p>
          ) : error ? (
            <p className="text-red-300">{error}</p>
          ) : !report || report.clusters.length === 0 ? (
            <p className="text-slate-500">
              Nessun cluster sopra soglia ({report?.threshold ?? 0.8}). Il catalogo è sufficientemente
              distinto.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-slate-400">
                {report.pairCount} coppie · soglia {Math.round(report.threshold * 100)}%
              </p>
              {report.clusters.map((cluster) => (
                <div
                  key={cluster.clusterId}
                  className="rounded-md border border-slate-700/60 bg-slate-900/50 p-2"
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="rounded bg-violet-900/50 px-1.5 py-px text-[10px] font-semibold uppercase text-violet-200">
                      {overlapClassificationLabel(cluster.classification)}
                    </span>
                    <span className="min-w-0 flex-1 font-medium text-slate-200">
                      {cluster.headline || cluster.clusterId}
                    </span>
                    <button
                      type="button"
                      className="shrink-0 text-[10px] text-violet-300 underline hover:text-violet-100"
                      onClick={() => handleMergeCluster(cluster.clusterId)}
                    >
                      Suggerisci fusione
                    </button>
                  </div>
                  <ul className="space-y-1 pl-1">
                    {cluster.pairs.map((pair, i) => (
                      <li key={`${pair.useCaseAId}-${pair.useCaseBId}-${i}`} className="text-[11px]">
                        <button
                          type="button"
                          className="text-sky-300 underline hover:text-sky-100"
                          onClick={() => handleSelectUseCase(pair.useCaseAId)}
                        >
                          {pair.useCaseAId.slice(0, 8)}…
                        </button>
                        {' ↔ '}
                        <button
                          type="button"
                          className="text-sky-300 underline hover:text-sky-100"
                          onClick={() => handleSelectUseCase(pair.useCaseBId)}
                        >
                          {pair.useCaseBId.slice(0, 8)}…
                        </button>
                        <span className="text-slate-500">
                          {' '}
                          ({Math.round(pair.score * 100)}%) {pair.summary}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
