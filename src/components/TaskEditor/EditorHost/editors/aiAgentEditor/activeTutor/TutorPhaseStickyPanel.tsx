/**
 * Active Tutor — pannello sticky con istruzioni fisse della tab corrente.
 */

import React from 'react';
import * as LucideIcons from 'lucide-react';
import type { TutorStickyPanelContent } from '@domain/activeTutor/tutorStickyPanel';
import type {
  TutorStructuredAction,
  TutorStructuredUiRef,
} from '@domain/activeTutor/tutorStructuredMessage';

export interface TutorPhaseStickyPanelProps {
  readonly heading: string;
  readonly content: TutorStickyPanelContent;
  readonly onUiRefClick: (ref: TutorStructuredUiRef) => void;
  readonly onActionClick: (action: TutorStructuredAction) => void;
}

function LucideBySlug({ slug, className }: { slug: string; className?: string }): React.ReactElement | null {
  const Icon = (LucideIcons as Record<string, React.ComponentType<{ className?: string; size?: number }>>)[slug];
  if (!Icon) return null;
  return <Icon size={12} className={className} aria-hidden />;
}

export function TutorPhaseStickyPanel({
  heading,
  content,
  onUiRefClick,
  onActionClick,
}: TutorPhaseStickyPanelProps): React.ReactElement {
  const { introText, warningText, stateMessage } = content;
  const stateBody = stateMessage?.body.trim() ?? '';
  const showStateBody = Boolean(stateBody && stateBody !== introText.trim());

  return (
    <section
      className="shrink-0 border-b border-emerald-800/40 bg-emerald-950/25 px-3 py-2.5"
      aria-label={`Guida ${heading}`}
    >
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300/80">
        {heading}
      </p>
      <p className="text-xs leading-relaxed text-emerald-50/95">{introText}</p>

      {showStateBody ? (
        <p className="mt-1.5 text-xs leading-relaxed text-emerald-100/90">{stateBody}</p>
      ) : null}

      {stateMessage && stateMessage.uiRefs.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {stateMessage.uiRefs.map((ref) => (
            <button
              key={ref.elementId}
              type="button"
              onClick={() => onUiRefClick(ref)}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-900/40 px-2 py-0.5 text-[10px] font-medium text-emerald-50 hover:border-emerald-400/60 hover:bg-emerald-800/50"
            >
              <LucideBySlug slug="MousePointer2" className="opacity-80" />
              {ref.label}
            </button>
          ))}
        </div>
      ) : null}

      {stateMessage && stateMessage.actions.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {stateMessage.actions.map((action) => (
            <button
              key={`${action.icon}-${action.label}`}
              type="button"
              onClick={() => onActionClick(action)}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-900/35 px-2 py-0.5 text-[10px] font-medium text-emerald-50 hover:border-emerald-400/55 hover:bg-emerald-800/45"
            >
              <LucideBySlug slug={action.icon} />
              {action.label}
            </button>
          ))}
        </div>
      ) : null}

      {warningText ? (
        <p className="mt-2 text-[11px] leading-relaxed text-amber-200/85">{warningText}</p>
      ) : null}
    </section>
  );
}
