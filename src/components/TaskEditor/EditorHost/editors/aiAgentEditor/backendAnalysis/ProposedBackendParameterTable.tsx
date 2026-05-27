/**
 * Tabella interfaccia SEND/RECEIVE per backend proposti (non ancora in catalogo).
 */

import React from 'react';
import type { ProposedBackendParameterSpec } from '@domain/backendAnalysis/proposedBackendSpec';
import { BackendParameterKindIcon } from './BackendParameterKindIcon';

function ParameterDescriptionCell({ text }: { text: string }): React.ReactElement {
  const trimmed = text.trim();
  if (!trimmed) return <span className="text-slate-600">—</span>;
  return (
    <div className="max-w-md whitespace-pre-wrap text-sm leading-snug text-slate-300">
      {trimmed}
    </div>
  );
}

export type ProposedBackendParameterTableProps = {
  parameters: readonly ProposedBackendParameterSpec[];
};

/** Tabella parametri proposta: nomi, frecce input/output, tipo dato, ruolo, descrizione. */
export function ProposedBackendParameterTable({
  parameters,
}: ProposedBackendParameterTableProps): React.ReactElement {
  const rows = [...parameters].sort((a, b) => {
    if (a.direction !== b.direction) return a.direction === 'input' ? -1 : 1;
    return a.paramKey.localeCompare(b.paramKey);
  });

  if (rows.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        Nessun parametro proposto: completa l&apos;analisi o il testo «A cosa serve».
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded border border-slate-700/80">
      <table className="w-full min-w-[720px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-slate-700/80 bg-slate-900/80 text-slate-400">
            <th className="w-8 px-1 py-1.5" aria-label="Obbligo" />
            <th className="px-2 py-1.5 font-semibold">Parametro</th>
            <th className="px-2 py-1.5 font-semibold">Direzione</th>
            <th className="px-2 py-1.5 font-semibold">Tipo dato</th>
            <th className="px-2 py-1.5 font-semibold">Ruolo</th>
            <th className="px-2 py-1.5 font-semibold">Descrizione</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.paramKey} className="border-b border-slate-800/80 text-slate-200">
              <td className="px-1 py-1.5 text-center">
                <BackendParameterKindIcon kind={row.kind} />
              </td>
              <td className="px-2 py-1.5">
                <code className="rounded bg-slate-800/90 px-1 py-0.5 font-mono text-[11px] text-violet-100">
                  {row.paramKey}
                </code>
              </td>
              <td className="px-2 py-1.5 text-slate-400">
                {row.direction === 'input' ? '→ input' : '← output'}
              </td>
              <td className="px-2 py-1.5 font-mono text-[11px] text-cyan-200/90">{row.dataType}</td>
              <td className="px-2 py-1.5 text-slate-300">{row.role || '—'}</td>
              <td className="px-2 py-1.5">
                <ParameterDescriptionCell text={row.descriptionShort} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
