/**
 * Chip Test avanzamento: due chip Precedente / Nuovo per il parametro in focus, oppure elenco legacy.
 */

import React from 'react';
import type { AdvancementContextChip, AdvancementQuickTestRowState } from '../../../../../domain/advancement/advancementQuickTest';

function chipClassesForTone(c: AdvancementContextChip, compact: boolean): string {
  const base = compact
    ? 'inline-flex max-w-[min(140px,30vw)] items-center gap-0.5 truncate rounded border px-1 py-0.5 text-[8px]'
    : 'inline-flex max-w-[min(180px,36vw)] items-center gap-0.5 truncate rounded border px-1.5 py-0.5 text-[9px]';
  if (c.tone === 'precedente') {
    return `${base} border-orange-500/40 bg-orange-950/35`;
  }
  if (c.tone === 'nuovo') {
    return `${base} border-emerald-500/40 bg-emerald-950/30`;
  }
  return compact
    ? `${base} border-slate-600/60 bg-slate-950/80`
    : `${base} border-slate-600/70 bg-slate-950/75`;
}

function valueClassesForTone(c: AdvancementContextChip): string {
  if (c.tone === 'precedente') return 'truncate font-mono text-orange-200/95';
  if (c.tone === 'nuovo') return 'truncate font-mono text-emerald-200/95';
  return 'truncate font-mono text-teal-200/95';
}

export function AdvancementQuickTestChips({
  state,
  compact = false,
}: {
  state: AdvancementQuickTestRowState | undefined;
  /** Riga: testo più piccolo e larghezze limitate. */
  compact?: boolean;
}) {
  if (!state) return null;
  if (state.error) {
    return (
      <span className="max-w-[min(16rem,40vw)] truncate text-[9px] text-red-300/95" title={state.error}>
        {state.error}
      </span>
    );
  }
  if (!state.chips.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {state.chips.map((c) => (
        <span key={c.key} className={chipClassesForTone(c, compact)} title={`${c.label}: ${c.value}`}>
          <span className="shrink-0 text-slate-500">{c.label}</span>
          <span className={valueClassesForTone(c)}>{c.value}</span>
        </span>
      ))}
    </div>
  );
}
