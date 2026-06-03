/**
 * Tabella dizionario slot dinamico (definizioni IA/designer) nel pannello Slot Mapping.
 */

import React from 'react';
import type { ProjectSlotLexicon } from '@domain/useCaseBundle/projectSlotLexicon';
import {
  bindingSummary,
  listSlotDefinitions,
  slotBindingStatus,
  type DynamicSlotDefinition,
} from '@domain/useCaseBundle/dynamicSlotRegistry';

export interface SlotDictionarySectionProps {
  lexicon: ProjectSlotLexicon;
}

function statusLabel(def: DynamicSlotDefinition): { text: string; className: string } {
  const st = slotBindingStatus(def);
  if (st === 'ok') return { text: 'OK', className: 'text-emerald-400' };
  if (st === 'ambiguous') return { text: 'Ambiguo', className: 'text-amber-300' };
  return { text: 'Mancante', className: 'text-red-400' };
}

export function SlotDictionarySection({
  lexicon,
}: SlotDictionarySectionProps): React.ReactElement {
  const defs = React.useMemo(() => listSlotDefinitions(lexicon), [lexicon]);

  return (
    <section className="shrink-0 border-b border-slate-700/80 px-3 py-2">
      <h3 className="text-[10px] font-semibold uppercase tracking-wide text-violet-300/90">
        Dizionario slot (dinamico)
      </h3>
      <p className="mt-0.5 text-[10px] leading-snug text-slate-500">
        Creato da Compila (IA). Nessun vocabolario predefinito — rivedi binding e approva le surface
        sotto.
      </p>
      <div className="mt-2 max-h-52 overflow-auto rounded border border-slate-700/60">
        <table className="w-full table-fixed text-left text-[10px]">
          <thead className="sticky top-0 bg-slate-900/95 text-slate-500">
            <tr>
              <th className="w-[22%] px-2 py-1 font-medium">Slot</th>
              <th className="w-[10%] px-2 py-1 font-medium">Tipo</th>
              <th className="w-[34%] px-2 py-1 font-medium">Descrizione</th>
              <th className="w-[24%] px-2 py-1 font-medium">Binding</th>
              <th className="w-[10%] px-2 py-1 font-medium">Stato</th>
            </tr>
          </thead>
          <tbody>
            {defs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-2 py-2 text-slate-500">
                  Vuoto. Esegui Compila per generare il dizionario dai token delle frasi.
                </td>
              </tr>
            ) : (
              defs.map((d) => {
                const st = statusLabel(d);
                const missing = slotBindingStatus(d) !== 'ok';
                const bindingText = bindingSummary(d.binding);
                return (
                  <tr
                    key={d.slotId}
                    className={`border-t border-slate-800/80 ${missing ? 'bg-red-950/20' : ''}`}
                  >
                    <td className="px-2 py-1.5 align-top font-mono text-emerald-200/95">
                      <span className="block whitespace-normal break-words leading-snug">
                        {d.label?.trim() || d.slotId}
                      </span>
                      {d.proposedByAi ? (
                        <span className="mt-0.5 inline-block text-[9px] text-violet-400">IA</span>
                      ) : null}
                    </td>
                    <td className="px-2 py-1.5 align-top text-slate-400">{d.valueType}</td>
                    <td className="px-2 py-1.5 align-top text-slate-300">
                      <span className="block whitespace-normal break-words leading-snug">
                        {d.description || '—'}
                      </span>
                    </td>
                    <td
                      className="px-2 py-1.5 align-top font-mono text-amber-200/80"
                      title={bindingText}
                    >
                      <span className="block whitespace-normal break-words leading-snug">
                        {bindingText}
                      </span>
                    </td>
                    <td className={`px-2 py-1.5 align-top font-semibold ${st.className}`}>
                      {st.text}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
