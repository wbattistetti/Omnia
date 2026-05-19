/**
 * Small maximize/minimize control for KB dock panels and rule accordions.
 */

import React from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

export type KbPanelExpandButtonProps = {
  expanded: boolean;
  onToggle: () => void;
  expandTitle?: string;
  collapseTitle?: string;
  expandAriaLabel?: string;
  collapseAriaLabel?: string;
};

export function KbPanelExpandButton({
  expanded,
  onToggle,
  expandTitle = 'Espandi',
  collapseTitle = 'Riduci',
  expandAriaLabel = 'Espandi',
  collapseAriaLabel = 'Riduci',
}: KbPanelExpandButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      title={expanded ? collapseTitle : expandTitle}
      aria-label={expanded ? collapseAriaLabel : expandAriaLabel}
      aria-pressed={expanded}
      className="inline-flex shrink-0 items-center justify-center rounded-md border border-slate-600/70 bg-slate-900/60 px-1.5 py-1 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
    >
      {expanded ? <Minimize2 size={14} aria-hidden /> : <Maximize2 size={14} aria-hidden />}
    </button>
  );
}
