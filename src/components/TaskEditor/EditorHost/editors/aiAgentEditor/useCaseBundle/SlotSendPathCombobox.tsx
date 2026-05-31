/**
 * Dropdown path SEND leaf da catalogo OpenAPI (Slot Mapping).
 */

import React from 'react';
import type { BackendSendParamLeaf } from '@domain/openApi/backendSendParamCatalog';

export interface SlotSendPathComboboxProps {
  value: string;
  leaves: readonly BackendSendParamLeaf[];
  disabled?: boolean;
  onCommit: (sendPath: string) => void;
  className?: string;
}

export function SlotSendPathCombobox({
  value,
  leaves,
  disabled,
  onCommit,
  className = '',
}: SlotSendPathComboboxProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const trimmed = value.trim();
  const label = trimmed || '— SEND —';

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled || leaves.length === 0}
        onClick={() => setOpen((o) => !o)}
        className={[
          'max-w-full truncate rounded border px-1.5 py-0.5 font-mono text-[10px]',
          trimmed
            ? 'border-cyan-600/50 text-cyan-200'
            : 'border-slate-600/60 text-slate-500',
          disabled ? 'opacity-50' : 'hover:border-cyan-500/60',
        ].join(' ')}
        title={trimmed || 'Seleziona path SEND OpenAPI'}
      >
        {label}
      </button>
      {open && leaves.length > 0 ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Chiudi"
            onClick={() => setOpen(false)}
          />
          <ul
            className="absolute left-0 top-full z-50 mt-0.5 max-h-48 w-[min(280px,90vw)] overflow-y-auto rounded border border-slate-600 bg-slate-900 py-1 shadow-lg"
            role="listbox"
          >
            {leaves.map((leaf) => (
              <li key={leaf.path}>
                <button
                  type="button"
                  role="option"
                  className="block w-full px-2 py-1 text-left font-mono text-[10px] text-slate-200 hover:bg-slate-800"
                  onClick={() => {
                    onCommit(leaf.path);
                    setOpen(false);
                  }}
                >
                  <span className="text-cyan-200">{leaf.path}</span>
                  {leaf.format ? (
                    <span className="ml-1 text-slate-500">{leaf.format}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
