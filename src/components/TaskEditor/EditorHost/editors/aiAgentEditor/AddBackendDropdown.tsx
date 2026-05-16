/**
 * Single "Add backend" control with a dropdown: existing OpenAPI import vs manual specs (emulation).
 */

import React from 'react';
import { ChevronDown } from 'lucide-react';

export function AddBackendDropdown({
  wizardUi,
  onAddExisting,
  onCreateSpecs,
}: {
  /** Wizard step Backend: slightly larger tap targets. */
  wizardUi?: boolean;
  onAddExisting: () => void;
  onCreateSpecs: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el || el.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const btnPad = wizardUi ? 'px-2.5 py-1 text-sm' : 'px-2 py-0.5 text-[11px]';
  const itemPad = wizardUi ? 'px-3 py-2 text-sm' : 'px-2.5 py-1.5 text-[11px]';

  return (
    <div className="relative inline-flex shrink-0" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 rounded border border-violet-600/70 bg-violet-950/40 font-semibold text-violet-100 hover:bg-violet-900/55 ${btnPad}`}
        title="Add a backend to the catalog"
      >
        Add backend
        <ChevronDown
          className={`${wizardUi ? 'h-4 w-4' : 'h-3.5 w-3.5'} shrink-0 opacity-80`}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          className="absolute left-0 top-full z-[80] mt-1 min-w-[14rem] rounded-md border border-slate-600/90 bg-slate-900 py-0.5 shadow-lg shadow-black/40 ring-1 ring-slate-700/50"
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            className={`flex w-full text-left font-medium text-slate-100 hover:bg-slate-800 ${itemPad}`}
            onClick={() => {
              onAddExisting();
              setOpen(false);
            }}
          >
            Add existing backend
          </button>
          <button
            type="button"
            role="menuitem"
            className={`flex w-full text-left font-medium text-slate-100 hover:bg-slate-800 ${itemPad}`}
            onClick={() => {
              onCreateSpecs();
              setOpen(false);
            }}
          >
            Create backend specs
          </button>
        </div>
      ) : null}
    </div>
  );
}
