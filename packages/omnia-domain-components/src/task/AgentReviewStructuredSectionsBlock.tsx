/**
 * Blocco review conmotione: sezioni strutturate (Scopo, Sequenza, Contesto, Vincoli).
 * Usato dal portale review; stesso componente tabbed di @omnia/domain-components.
 */

import React from 'react';
import type { AgentStructuredSectionId } from '@omnia/domain-core/task/sections/agentStructuredSectionIds';
import { TaskStructuredViewerPanel } from './TaskStructuredViewerPanel';

export interface AgentReviewStructuredSectionsBlockProps {
  sections: Partial<Record<AgentStructuredSectionId, string>>;
  readOnly?: boolean;
  onSectionChange?: (sectionId: AgentStructuredSectionId, text: string) => void;
  className?: string;
  panelClassName?: string;
}

export function hasReviewStructuredSectionContent(
  sections: Partial<Record<AgentStructuredSectionId, string>>
): boolean {
  return Object.values(sections).some((v) => typeof v === 'string' && v.trim().length > 0);
}

export function AgentReviewStructuredSectionsBlock({
  sections,
  readOnly = true,
  onSectionChange,
  className = '',
  panelClassName = '',
}: AgentReviewStructuredSectionsBlockProps): React.ReactElement | null {
  if (!hasReviewStructuredSectionContent(sections)) {
    return null;
  }

  return (
    <div className={className}>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-violet-400/90">
        Design strutturato {readOnly ? '(sola lettura)' : ''}
      </p>
      <TaskStructuredViewerPanel
        sections={sections}
        readOnly={readOnly}
        onSectionChange={onSectionChange}
        className={panelClassName}
      />
    </div>
  );
}
