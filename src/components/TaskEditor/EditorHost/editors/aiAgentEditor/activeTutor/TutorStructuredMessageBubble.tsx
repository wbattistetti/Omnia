/**
 * Active Tutor — bubble messaggio strutturato con chip uiRefs e actions cliccabili.
 */

import React from 'react';
import * as LucideIcons from 'lucide-react';
import type {
  TutorStructuredAction,
  TutorStructuredMessage,
  TutorStructuredUiRef,
} from '@domain/activeTutor/tutorStructuredMessage';

export interface TutorStructuredMessageBubbleProps {
  readonly message: TutorStructuredMessage;
  readonly onUiRefClick: (ref: TutorStructuredUiRef) => void;
  readonly onActionClick: (action: TutorStructuredAction) => void;
}

function LucideBySlug({ slug, className }: { slug: string; className?: string }): React.ReactElement | null {
  const Icon = (LucideIcons as Record<string, React.ComponentType<{ className?: string; size?: number }>>)[slug];
  if (!Icon) return null;
  return <Icon size={14} className={className} aria-hidden />;
}

export function TutorStructuredMessageBubble({
  message,
  onUiRefClick,
  onActionClick,
}: TutorStructuredMessageBubbleProps): React.ReactElement {
  return (
    <div className="flex max-w-[95%] flex-col gap-1.5 self-start">
      <div className="rounded-lg border border-violet-500/25 bg-violet-950/55 px-2.5 py-2 text-xs leading-relaxed text-violet-50 shadow-sm">
        {message.title.trim() ? (
          <p className="mb-1 font-semibold text-violet-100">{message.title}</p>
        ) : null}
        {message.body.trim() ? (
          <p className="whitespace-pre-wrap text-violet-50/95">{message.body}</p>
        ) : null}

        {message.uiRefs.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.uiRefs.map((ref) => (
              <button
                key={ref.elementId}
                type="button"
                onClick={() => onUiRefClick(ref)}
                className="inline-flex items-center gap-1 rounded-full border border-violet-400/45 bg-violet-900/50 px-2 py-0.5 text-[10px] font-medium text-violet-100 hover:border-violet-300/70 hover:bg-violet-800/60"
              >
                <LucideBySlug slug="MousePointer2" className="opacity-80" />
                {ref.label}
              </button>
            ))}
          </div>
        ) : null}

        {message.actions.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.actions.map((action) => (
              <button
                key={`${action.icon}-${action.label}`}
                type="button"
                onClick={() => onActionClick(action)}
                className="inline-flex items-center gap-1 rounded-full border border-violet-400/35 bg-violet-800/45 px-2 py-0.5 text-[10px] font-medium text-violet-100 hover:border-violet-300/60 hover:bg-violet-800/70"
              >
                <LucideBySlug slug={action.icon} />
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
