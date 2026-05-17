/**
 * «Aggiungi strumento» — droplist modulare (stile ElevenLabs: Cliente / Webhook / Integrazione).
 * Comportamento allineato ad AddBackendDropdown (click-outside, Escape, role=menu).
 */

import React from 'react';
import { ChevronDown, LayoutGrid, Wrench } from 'lucide-react';
import type { ElevenLabsWorkspaceToolKind } from '@domain/backendCatalog/catalogTypes';

export type ConvaiToolMenuOption = {
  id: ElevenLabsWorkspaceToolKind;
  label: string;
  icon: React.ReactElement;
  enabled: boolean;
  title?: string;
};

const DEFAULT_OPTIONS: ConvaiToolMenuOption[] = [
  {
    id: 'client',
    label: 'Cliente',
    icon: <Wrench className="h-4 w-4 shrink-0 text-amber-200/90" aria-hidden />,
    enabled: false,
    title: 'Prossimamente',
  },
  {
    id: 'webhook',
    label: 'Webhook',
    icon: <ConvaiWebhookMenuIcon />,
    enabled: true,
  },
  {
    id: 'integration',
    label: 'Integrazione',
    icon: <LayoutGrid className="h-4 w-4 shrink-0 text-amber-200/90" aria-hidden />,
    enabled: false,
    title: 'Prossimamente',
  },
];

/** Icona hub a tre rami (come UI ElevenLabs). */
function ConvaiWebhookMenuIcon(): React.ReactElement {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-amber-200/90"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
      aria-hidden
    >
      <circle cx="8" cy="8" r="1.35" fill="currentColor" stroke="none" />
      <path d="M8 6.5V2.5M8 9.5v4M6.5 8H2.5M9.5 8h4" strokeLinecap="round" />
      <circle cx="8" cy="2" r="1" />
      <circle cx="8" cy="14" r="1" />
      <circle cx="2" cy="8" r="1" />
      <circle cx="14" cy="8" r="1" />
    </svg>
  );
}

export type AddConvaiToolDropdownProps = {
  disabled?: boolean;
  options?: readonly ConvaiToolMenuOption[];
  onSelectKind: (kind: ElevenLabsWorkspaceToolKind) => void;
};

export function AddConvaiToolDropdown({
  disabled = false,
  options = DEFAULT_OPTIONS,
  onSelectKind,
}: AddConvaiToolDropdownProps): React.ReactElement {
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

  return (
    <div ref={rootRef} className="relative inline-flex shrink-0">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={
          'inline-flex items-center gap-1 rounded-md border px-3 py-1 text-xs font-medium transition-colors ' +
          (disabled
            ? 'border-slate-600 text-slate-400 opacity-60'
            : 'border-violet-600/70 text-violet-200 hover:border-violet-500 hover:bg-violet-950/40')
        }
      >
        Aggiungi strumento
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
      </button>
      {open ? (
        <div
          className="absolute right-0 top-full z-[80] mt-1 min-w-[11rem] rounded-md border border-amber-900/40 bg-[#1a1510] py-1 shadow-lg shadow-black/50 ring-1 ring-amber-950/60"
          role="menu"
        >
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="menuitem"
              disabled={!opt.enabled}
              title={opt.title}
              className={
                'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-medium ' +
                (opt.enabled
                  ? 'text-amber-100/95 hover:bg-amber-950/35'
                  : 'cursor-not-allowed text-amber-100/35')
              }
              onClick={() => {
                if (!opt.enabled) return;
                onSelectKind(opt.id);
                setOpen(false);
              }}
            >
              {opt.icon}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
