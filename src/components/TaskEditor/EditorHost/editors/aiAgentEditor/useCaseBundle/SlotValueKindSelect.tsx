/**
 * Selettore valueKind per hint SEND (compile design-time).
 */

import React from 'react';

export const VALUE_KIND_OPTIONS = [
  '',
  'end_of_month',
  'start_of_month',
  'tomorrow',
  'day_after_tomorrow',
  'today',
  'specific_date',
  'specific_time',
] as const;

export function SlotValueKindSelect({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (valueKind: string) => void;
}): React.ReactElement {
  return (
    <select
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-0.5 max-w-full rounded border border-slate-600/60 bg-slate-900 px-1 py-0.5 font-mono text-[9px] text-slate-300"
      aria-label="Value kind"
    >
      {VALUE_KIND_OPTIONS.map((k) => (
        <option key={k || '__none'} value={k}>
          {k || '— valueKind —'}
        </option>
      ))}
    </select>
  );
}
