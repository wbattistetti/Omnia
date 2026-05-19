/**
 * Cyclable KB rule status control with icon + accessible label.
 */

import React from 'react';
import type { KbRuleStatus } from '@domain/knowledgeBase/kbRuleTypes';
import {
  KB_RULE_STATUS_LABEL,
  cycleKbRuleStatus,
} from '@domain/knowledgeBase/kbRuleStatus';
import { Lightbulb, ThumbsDown, ThumbsUp, Pencil } from 'lucide-react';

export type KbRuleStatusControlProps = {
  status: KbRuleStatus;
  disabled?: boolean;
  onCycle: (next: KbRuleStatus) => void;
  className?: string;
};

function KbRuleStatusIcon({ status }: { status: KbRuleStatus }): React.ReactElement {
  const common = 'h-4 w-4 shrink-0';
  switch (status) {
    case 'hypothesized':
      return <Lightbulb className={common + ' text-amber-300'} aria-hidden />;
    case 'validated':
      return <ThumbsUp className={common + ' text-emerald-400'} aria-hidden />;
    case 'corrected':
      return <Pencil className={common + ' text-sky-400'} aria-hidden />;
    case 'reworked':
      return (
        <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
          <Lightbulb className="h-4 w-4 text-amber-300" />
          <span className="absolute -right-0.5 -top-0.5 text-[9px] font-bold leading-none text-violet-300">
            *
          </span>
        </span>
      );
    case 'invalid':
      return <ThumbsDown className={common + ' text-rose-400/90'} aria-hidden />;
    default:
      return <Lightbulb className={common + ' text-amber-300'} aria-hidden />;
  }
}

export function KbRuleStatusControl({
  status,
  disabled = false,
  onCycle,
  className = '',
}: KbRuleStatusControlProps): React.ReactElement {
  const label = KB_RULE_STATUS_LABEL[status];
  return (
    <button
      type="button"
      disabled={disabled}
      title={`Stato: ${label}. Clic per cambiare.`}
      aria-label={`Stato regola: ${label}. Clic per il prossimo stato.`}
      onClick={(e) => {
        e.stopPropagation();
        onCycle(cycleKbRuleStatus(status));
      }}
      className={
        'inline-flex items-center gap-1 rounded border border-slate-700/80 bg-slate-900/80 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800 disabled:opacity-50 ' +
        className
      }
    >
      <KbRuleStatusIcon status={status} />
      <span className="max-w-[7rem] truncate">{label}</span>
    </button>
  );
}
