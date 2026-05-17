/**
 * Read-only toggle styled like ElevenLabs workflow inspector switches.
 */

import React from 'react';

export type ElevenLabsReadOnlyToggleProps = {
  label: string;
  checked: boolean;
  hint?: string;
};

export function ElevenLabsReadOnlyToggle({
  label,
  checked,
  hint,
}: ElevenLabsReadOnlyToggleProps): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 py-3">
      <div className="min-w-0">
        <p className="text-sm text-slate-200">{label}</p>
        {hint ? <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p> : null}
      </div>
      <div
        role="presentation"
        aria-label={`${label}: ${checked ? 'attivo' : 'disattivo'}`}
        className={
          'relative h-5 w-9 shrink-0 rounded-full ' +
          (checked ? 'bg-violet-600' : 'bg-slate-700')
        }
      >
        <span
          className={
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow ' +
            (checked ? 'translate-x-4' : 'translate-x-0.5')
          }
        />
      </div>
    </div>
  );
}

