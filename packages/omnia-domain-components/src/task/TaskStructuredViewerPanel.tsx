/**
 * Task strutturato in sola lettura o editabile: tab Scopo, Sequenza, Contesto, Vincoli.
 */

import React from 'react';
import {
  AGENT_REVIEW_STRUCTURED_SECTION_IDS,
  AGENT_STRUCTURED_SECTION_LABELS,
  type AgentStructuredSectionId,
} from '@omnia/domain-core/task/sections/agentStructuredSectionIds';

const REVIEW_SECTION_IDS = AGENT_REVIEW_STRUCTURED_SECTION_IDS;

export interface TaskStructuredViewerPanelProps {
  sections: Partial<Record<AgentStructuredSectionId, string>>;
  readOnly?: boolean;
  onSectionChange?: (sectionId: AgentStructuredSectionId, text: string) => void;
  className?: string;
}

export function TaskStructuredViewerPanel({
  sections,
  readOnly = true,
  onSectionChange,
  className = '',
}: TaskStructuredViewerPanelProps): React.ReactElement {
  const [activeId, setActiveId] = React.useState<AgentStructuredSectionId>(
    REVIEW_SECTION_IDS[0] ?? 'goal'
  );

  const activeText = sections[activeId] ?? '';

  return (
    <div
      className={`flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-600/60 bg-slate-900/40 ${className}`}
    >
      <div
        className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-slate-700/80 px-1"
        role="tablist"
      >
        {REVIEW_SECTION_IDS.map((id) => {
          const active = id === activeId;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`shrink-0 rounded-t px-3 py-2 text-xs font-semibold transition ${
                active
                  ? 'bg-slate-800 text-violet-200'
                  : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-300'
              }`}
              onClick={() => setActiveId(id)}
            >
              {AGENT_STRUCTURED_SECTION_LABELS[id]}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1 p-2">
        {readOnly || !onSectionChange ? (
          <pre className="min-h-[120px] whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-200">
            {activeText.trim() || (
              <span className="italic text-slate-500">Sezione vuota.</span>
            )}
          </pre>
        ) : (
          <textarea
            className="min-h-[160px] w-full resize-y rounded border border-slate-600 bg-slate-950/80 px-2 py-1.5 text-sm text-slate-100"
            value={activeText}
            onChange={(e) => onSectionChange(activeId, e.target.value)}
            placeholder={`Testo ${AGENT_STRUCTURED_SECTION_LABELS[activeId]}…`}
          />
        )}
      </div>
    </div>
  );
}
