/**
 * Mapping section: accent header + optional frame (SEND/RECEIVE, INPUT/OUTPUT).
 * `flat`: lighter single border, no inner shadow — less “nested box” chrome when embedded (e.g. Backend Call).
 */

import React from 'react';

export type MappingBlockAccent = 'send' | 'receive' | 'input' | 'output';

const ACCENT: Record<
  MappingBlockAccent,
  { headerClass: string; borderClass: string; label: string }
> = {
  send: {
    headerClass: 'bg-teal-500',
    borderClass: 'border-teal-500',
    label: 'SEND',
  },
  receive: {
    headerClass: 'bg-emerald-500',
    borderClass: 'border-emerald-500',
    label: 'RECEIVE',
  },
  input: {
    headerClass: 'bg-sky-500',
    borderClass: 'border-sky-500',
    label: 'INPUT',
  },
  output: {
    headerClass: 'bg-violet-500',
    borderClass: 'border-violet-500',
    label: 'OUTPUT',
  },
};

export interface MappingBlockProps {
  accent: MappingBlockAccent;
  /** Override header label (e.g. i18n) */
  labelOverride?: string;
  /** When set, replaces the default accent header bar background (e.g. gradient for Interface). */
  headerClassNameOverride?: string;
  /** Override span classes for the header title (default: short uppercase slate). */
  headerLabelClassName?: string;
  /** When set, replaces border-2 accent color on the block root. */
  borderClassNameOverride?: string;
  /** Layout: e.g. `w-full` (stacked) or `flex-1 min-w-0` (side-by-side columns). */
  rootClassName?: string;
  /** e.g. draggable “Parameter” chip for backend */
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
  /**
   * Target for pointer-based row drag from the flow canvas (useNodeDragDrop).
   * Renders data-* on the block root so elementFromPoint can detect Input/Output without removing the row.
   */
  flowDropTarget?: { flowCanvasId: string; zone: 'input' | 'output' };
  /** Backend Call SEND/RECEIVE: pointer drop from canvas rows (useNodeDragDrop). */
  backendMappingDropTarget?: { flowCanvasId: string; zone: 'send' | 'receive' };
  /** When true, tree body grows with the column (Interface double-column layout). */
  fillBodyHeight?: boolean;
  /** Thinner border, no shadow-inner — embedded backend panels without double-frame look. */
  flat?: boolean;
}

/** Max body height before vertical scroll; keeps panels short when few rows. */
const BODY_MAX_H = 'max-h-[min(60vh,420px)]';

export function MappingBlock({
  accent,
  labelOverride,
  headerClassNameOverride,
  headerLabelClassName,
  borderClassNameOverride,
  rootClassName = '',
  headerExtra,
  children,
  flowDropTarget,
  backendMappingDropTarget,
  fillBodyHeight = false,
  flat = false,
}: MappingBlockProps) {
  const { headerClass, borderClass, label } = ACCENT[accent];
  const text = labelOverride ?? label;
  const headerBar = headerClassNameOverride ?? headerClass;
  const labelBar =
    headerLabelClassName ??
    'text-[10px] font-bold leading-none tracking-wide text-slate-950 uppercase select-none';
  const borderBar = borderClassNameOverride ?? borderClass;

  const frameClass = flat
    ? 'rounded-md border border-slate-600/25 bg-slate-950/30'
    : `rounded-xl border-2 ${borderBar} bg-[#0a0c10] shadow-inner`;

  const bodyPad = flat ? 'p-1.5' : 'p-2.5';

  return (
    <div
      className={`flex flex-col min-h-0 overflow-hidden min-w-0 ${frameClass} ${rootClassName}`}
      {...(flowDropTarget
        ? {
            'data-flow-interface-zone': flowDropTarget.zone,
            'data-flow-canvas-id': flowDropTarget.flowCanvasId,
          }
        : {})}
      {...(backendMappingDropTarget
        ? {
            'data-omnia-backend-mapping': backendMappingDropTarget.zone,
            'data-flow-canvas-id': backendMappingDropTarget.flowCanvasId,
          }
        : {})}
    >
      <header
        className={`shrink-0 px-2 py-0.5 h-7 min-h-7 box-border ${headerBar} border-b border-black/10 flex items-center gap-2`}
      >
        <span className={labelBar}>
          {text}
        </span>
        {headerExtra != null && <div className="ml-auto shrink-0">{headerExtra}</div>}
      </header>
      <div
        className={
          fillBodyHeight
            ? `min-h-0 min-w-0 flex-1 ${bodyPad} overflow-y-auto overflow-x-hidden`
            : `min-h-0 min-w-0 ${bodyPad} overflow-y-auto overflow-x-hidden ${BODY_MAX_H}`
        }
      >
        {children}
      </div>
    </div>
  );
}
