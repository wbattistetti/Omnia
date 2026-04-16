/**
 * Riepilogo NLU compatto: riga motore, nodo slot espandibile (tree) con tempo, figli semantica + linguistica.
 */
import { useState } from 'react';
import { Braces, ChevronDown, ChevronRight, Languages, Layers } from 'lucide-react';

export function NluSummaryInline(props: {
  /** Prima riga (es. Grammar Flow). */
  engineLine: string;
  /** Etichetta riga slot (nodo treeview). */
  slotLabel: string;
  elapsedMs: number | null | undefined;
  showNoMatch: boolean;
  semantic: string;
  linguistic: string;
}) {
  const { engineLine, slotLabel, elapsedMs, showNoMatch, semantic, linguistic } = props;
  const [slotOpen, setSlotOpen] = useState(true);

  const msLabel =
    elapsedMs != null && elapsedMs > 0 ? `${Math.round(elapsedMs)} msec` : '—';

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-slate-800 leading-snug">{engineLine}</p>

      <div className="rounded-md border border-purple-100/60 bg-purple-50/30 overflow-hidden">
        <button
          type="button"
          className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-[11px] text-slate-800 hover:bg-purple-100/40 transition-colors"
          onClick={() => setSlotOpen((o) => !o)}
          aria-expanded={slotOpen}
        >
          {slotOpen ? (
            <ChevronDown size={14} className="shrink-0 text-slate-500" aria-hidden />
          ) : (
            <ChevronRight size={14} className="shrink-0 text-slate-500" aria-hidden />
          )}
          <Layers size={13} className="shrink-0 text-purple-700" aria-hidden />
          <span className="flex-1 min-w-0 font-medium truncate">{slotLabel}</span>
          <span className="shrink-0 text-slate-500 tabular-nums">({msLabel})</span>
        </button>

        {slotOpen ? (
          <div className="pl-4 pr-2 pb-2 pt-0 border-t border-purple-100/40 space-y-1.5">
            {showNoMatch ? (
              <p className="text-[11px] text-slate-700 pl-1">no match</p>
            ) : (
              <>
                <div className="flex items-start gap-1.5 pl-1">
                  <Braces size={13} className="shrink-0 text-emerald-700 mt-0.5" aria-hidden />
                  <span className="text-[11px] text-emerald-900 font-mono break-all leading-snug">
                    {semantic}
                  </span>
                </div>
                <div className="flex items-start gap-1.5 pl-1">
                  <Languages size={13} className="shrink-0 text-blue-600 mt-0.5" aria-hidden />
                  <span className="text-[11px] italic text-blue-600 leading-snug break-all">
                    &quot;{linguistic}&quot;
                  </span>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
