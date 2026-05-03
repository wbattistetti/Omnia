/**
 * Costante numerica SEND: stepper + slider compatto nel pannello mapping.
 */

import React from 'react';

const RANGE_MAX = 1_000_000;
const RANGE_MIN = 0;

export function NumberLiteralEditor({
  value,
  onChange,
  onKeyDown,
}: {
  value: string;
  onChange: (next: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}) {
  const parsed = parseFloat(value.trim());
  const n = Number.isFinite(parsed) ? parsed : 0;
  const sliderVal = Math.min(RANGE_MAX, Math.max(RANGE_MIN, n));

  const bump = (delta: number) => {
    const base = Number.isFinite(parsed) ? parsed : 0;
    onChange(String(base + delta));
  };

  return (
    <div className="flex min-w-0 w-full flex-col gap-1.5">
      <div className="flex min-w-0 items-center gap-1">
        <button
          type="button"
          aria-label="Diminuisci"
          className="shrink-0 rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-200 hover:bg-slate-700"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => bump(-1)}
        >
          −
        </button>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="0"
          className="min-w-0 flex-1 rounded border border-amber-400/40 bg-slate-900 px-2 py-1 text-[10px] text-amber-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400/60"
        />
        <button
          type="button"
          aria-label="Aumenta"
          className="shrink-0 rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-200 hover:bg-slate-700"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => bump(1)}
        >
          +
        </button>
      </div>
      <input
        type="range"
        aria-label="Scorri valore"
        min={RANGE_MIN}
        max={RANGE_MAX}
        step={1}
        value={sliderVal}
        onChange={(e) => onChange(e.target.value)}
        className="h-1.5 w-full cursor-pointer accent-amber-500"
      />
    </div>
  );
}
