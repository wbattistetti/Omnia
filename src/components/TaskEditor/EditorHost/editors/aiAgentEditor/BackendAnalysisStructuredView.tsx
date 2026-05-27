/**
 * Anteprima interattiva analisi backend: tabella parametri + cerchiolino «A» + payoff espandibile.
 */

import React from 'react';
import type {
  BackendAnalysisBackendSection,
  BackendAnalysisDocument,
} from '@domain/backendAnalysis/backendAnalysisDocumentTypes';
import {
  buildPayoffLookup,
  payoffLookupKey,
} from '@domain/backendAnalysis/parseBackendAnalysisDocument';

export type BackendAnalysisStructuredViewProps = {
  document: BackendAnalysisDocument;
  className?: string;
};

function AnalysisToggleButton({
  expanded,
  onClick,
  summary,
}: {
  expanded: boolean;
  onClick: () => void;
  summary: string;
}): React.ReactElement {
  return (
    <button
      type="button"
      title={summary || 'Mostra analisi parametro'}
      aria-expanded={expanded}
      aria-label="Analisi parametro"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={
        'ml-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition-colors ' +
        (expanded
          ? 'border-violet-400 bg-violet-800/80 text-violet-50'
          : 'border-violet-600/70 bg-violet-950/60 text-violet-200 hover:bg-violet-900/70')
      }
    >
      A
    </button>
  );
}

function ParameterTable({
  section,
  payoffMap,
}: {
  section: BackendAnalysisBackendSection;
  payoffMap: Map<string, { payoffSummary: string; payoffDetail: string }>;
}): React.ReactElement | null {
  if (section.parameters.length === 0) return null;
  const backendName = section.name;

  const [expandedParam, setExpandedParam] = React.useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded border border-slate-700/80">
      <table className="w-full min-w-[520px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-slate-700/80 bg-slate-900/80 text-slate-400">
            <th className="px-2 py-1.5 font-semibold">Parametro</th>
            <th className="px-2 py-1.5 font-semibold">Direzione</th>
            <th className="px-2 py-1.5 font-semibold">Tipo</th>
            <th className="px-2 py-1.5 font-semibold">Ruolo</th>
            <th className="px-2 py-1.5 font-semibold">Descrizione</th>
          </tr>
        </thead>
        <tbody>
          {section.parameters.map((row) => {
            const key = payoffLookupKey(backendName, row.name);
            const payoff = payoffMap.get(key);
            const isOpen = expandedParam === row.name;
            return (
              <React.Fragment key={row.name}>
                <tr className="border-b border-slate-800/80 text-slate-200">
                  <td className="px-2 py-1.5 align-top">
                    <span className="inline-flex items-center gap-0.5">
                      <code className="rounded bg-slate-800/90 px-1 py-0.5 text-[11px] text-violet-100">
                        {row.name}
                      </code>
                      {payoff ? (
                        <AnalysisToggleButton
                          expanded={isOpen}
                          summary={payoff.payoffSummary}
                          onClick={() =>
                            setExpandedParam(isOpen ? null : row.name)
                          }
                        />
                      ) : null}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-slate-400">
                    {row.direction === 'input' ? '→ input' : '← output'}
                  </td>
                  <td className="px-2 py-1.5">
                    <span className="rounded bg-slate-800/60 px-1 text-[10px] uppercase tracking-wide text-amber-100/90">
                      {row.kind}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-slate-300">{row.role}</td>
                  <td className="px-2 py-1.5 text-slate-400">{row.description}</td>
                </tr>
                {isOpen && payoff ? (
                  <tr className="bg-violet-950/30">
                    <td colSpan={5} className="px-3 py-2 text-slate-300">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-300/90">
                        Payoff
                      </p>
                      <p className="mt-0.5 text-sm text-violet-50/95">{payoff.payoffSummary}</p>
                      {payoff.payoffDetail && payoff.payoffDetail !== payoff.payoffSummary ? (
                        <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-300">
                          {payoff.payoffDetail}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function BackendAnalysisStructuredView({
  document,
  className = '',
}: BackendAnalysisStructuredViewProps): React.ReactElement {
  const payoffMap = React.useMemo(() => buildPayoffLookup(document), [document]);

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1 text-slate-200 ${className}`}
    >
      {document.summary.length > 0 ? (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-violet-300">
            Sintesi
          </h3>
          <ul className="list-inside list-disc space-y-0.5 text-sm text-slate-300">
            {document.summary.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {document.backends.map((section) => (
        <section key={section.name}>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-100">
            Backend: {section.name}
            <span className="rounded border border-slate-600/80 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
              chip
            </span>
          </h3>
          <ParameterTable section={section} payoffMap={payoffMap} />
        </section>
      ))}

      {document.generalRules.length > 0 ? (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-violet-300">
            Regole generali
          </h3>
          <ul className="list-inside list-disc space-y-0.5 text-sm text-slate-300">
            {document.generalRules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {document.missingBackends.length > 0 ? (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-300/90">
            Backend mancanti
          </h3>
          <ul className="space-y-1 text-sm text-slate-300">
            {document.missingBackends.map((mb) => (
              <li key={mb.name}>
                <span className="font-medium text-amber-100/90">{mb.name}</span>
                {mb.reason ? ` — ${mb.reason}` : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {document.systemPromptLines.length > 0 ? (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-300/90">
            System prompt sintetico
          </h3>
          <ul className="list-inside list-disc space-y-0.5 text-sm text-slate-300">
            {document.systemPromptLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
