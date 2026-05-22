/**
 * Top toolbar for the review portal: Task → KB → Backend → Prompts → Conversation.
 */

import React from 'react';
import { BookOpen, ClipboardList, MessagesSquare, PlugZap, Sparkles } from 'lucide-react';
import {
  REVIEW_PORTAL_STEP_IDS,
  REVIEW_PORTAL_STEP_LABELS,
  type ReviewPortalStepId,
} from './reviewPortalSteps';

const STEP_ICONS: Record<ReviewPortalStepId, React.ReactNode> = {
  task: <ClipboardList size={14} aria-hidden />,
  knowledge_base: <BookOpen size={14} aria-hidden />,
  backend: <PlugZap size={14} aria-hidden />,
  prompts: <Sparkles size={14} aria-hidden />,
  conversation: <MessagesSquare size={14} aria-hidden />,
};

export interface ReviewPortalStepperProps {
  activeStep: ReviewPortalStepId;
  onSelectStep: (step: ReviewPortalStepId) => void;
  /** Optional badge counts per step (e.g. use case count on Prompts). */
  badges?: Partial<Record<ReviewPortalStepId, number>>;
  className?: string;
}

export function ReviewPortalStepper({
  activeStep,
  onSelectStep,
  badges = {},
  className = '',
}: ReviewPortalStepperProps): React.ReactElement {
  return (
    <nav
      className={`flex flex-wrap items-center gap-1 border-b border-slate-800 px-2 py-2 ${className}`}
      aria-label="Sezioni review"
    >
      {REVIEW_PORTAL_STEP_IDS.map((stepId) => {
        const active = stepId === activeStep;
        const badge = badges[stepId];
        return (
          <button
            key={stepId}
            type="button"
            onClick={() => onSelectStep(stepId)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition ${
              active
                ? 'border-emerald-500/60 bg-emerald-950/40 text-emerald-100'
                : 'border-slate-700/80 bg-slate-900/50 text-slate-400 hover:border-slate-600 hover:text-slate-200'
            }`}
            aria-current={active ? 'page' : undefined}
          >
            {STEP_ICONS[stepId]}
            <span>{REVIEW_PORTAL_STEP_LABELS[stepId]}</span>
            {typeof badge === 'number' && badge > 0 ? (
              <span
                className={`rounded-full px-1.5 py-0 text-[10px] ${
                  active ? 'bg-emerald-800/80 text-emerald-100' : 'bg-slate-700 text-slate-300'
                }`}
              >
                {badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
