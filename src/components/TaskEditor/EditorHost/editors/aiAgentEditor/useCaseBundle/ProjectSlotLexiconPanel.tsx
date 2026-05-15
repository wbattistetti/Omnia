/**
 * Pannello lessico progetto: tabella surface → slot_id, conflitti, approvazioni.
 */

import React from 'react';
import type { ProjectSlotLexicon } from '@domain/useCaseBundle/projectSlotLexicon';

export interface ProjectSlotLexiconPanelProps {
  open: boolean;
  onClose: () => void;
  lexicon: ProjectSlotLexicon;
  onApproveEntry: (surface: string) => void;
}

export function ProjectSlotLexiconPanel({
  open,
  onClose,
  lexicon,
  onApproveEntry,
}: ProjectSlotLexiconPanelProps): React.ReactElement | null {
  if (!open) return null;

  const entries = [...lexicon.entries].sort((a, b) => a.surface.localeCompare(b.surface));
  const pending = lexicon.pendingProposals ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-lg border border-slate-600 bg-slate-900 p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-100">Lessico slot (progetto)</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            Chiudi
          </button>
        </div>

        <table className="mb-4 w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400">
              <th className="py-1">surface</th>
              <th className="py-1">slot_id</th>
              <th className="py-1">stato</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-3 text-slate-500">
                  Nessuna voce. Compila le frasi use case per popolare il lessico.
                </td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr key={e.surface} className="border-b border-slate-800">
                  <td className="py-1 font-mono text-amber-100">{e.surface}</td>
                  <td className="py-1 font-mono text-emerald-300">{e.slot_id}</td>
                  <td className="py-1">
                    {e.conflictWith ? (
                      <span className="text-red-400">conflitto → {e.conflictWith}</span>
                    ) : e.approved ? (
                      <span className="text-emerald-400">approvato</span>
                    ) : (
                      <span className="text-orange-400">bozza</span>
                    )}
                  </td>
                  <td className="py-1 text-right">
                    {!e.approved && !e.conflictWith ? (
                      <button
                        type="button"
                        className="text-amber-300 hover:underline"
                        onClick={() => onApproveEntry(e.surface)}
                      >
                        Approva
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {pending.length > 0 ? (
          <>
            <h4 className="mb-2 text-xs font-medium text-slate-400">Proposte in attesa</h4>
            <ul className="list-inside list-disc text-xs text-slate-300">
              {pending.map((p) => (
                <li key={`${p.surface}-${p.slot_id}`}>
                  {p.surface} → {p.slot_id}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  );
}
