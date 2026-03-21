/**
 * Single mapping row: three visual slots (plain label, dashed placeholder, solid binding).
 * Column content is passed as React nodes for flexibility (backend vs interface).
 */

import React from 'react';

export type MappingCellVariant = 'plain' | 'dashed' | 'solid' | 'muted';

export interface MappingCellSpec {
  key: string;
  variant: MappingCellVariant;
  children: React.ReactNode;
}

function cellClass(variant: MappingCellVariant): string {
  const base = 'flex-1 min-w-[72px] rounded px-2 py-1.5 text-[11px] leading-snug';
  switch (variant) {
    case 'plain':
      return `${base} text-cyan-300/95 font-medium`;
    case 'dashed':
      return `${base} border border-dashed border-amber-500/55 text-amber-100/85 bg-slate-950/40`;
    case 'solid':
      return `${base} border border-amber-500/90 text-slate-100 bg-slate-950/30`;
    case 'muted':
      return `${base} border border-slate-600/60 text-slate-500 italic`;
    default:
      return base;
  }
}

export interface MappingRowShellProps {
  cells: MappingCellSpec[];
}

export function MappingRowShell({ cells }: MappingRowShellProps) {
  return (
    <div className="flex flex-wrap items-stretch gap-2 w-full">
      {cells.map((c) => (
        <div key={c.key} className={cellClass(c.variant)}>
          {c.children}
        </div>
      ))}
    </div>
  );
}
