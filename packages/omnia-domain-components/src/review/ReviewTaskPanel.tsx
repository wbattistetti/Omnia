/**
 * Review portal — Task tab: design description + editable structured sections.
 */

import React from 'react';
import type { AgentStructuredSectionId } from '@omnia/domain-core/task/sections/agentStructuredSectionIds';
import { TaskStructuredViewerPanel } from '../task/TaskStructuredViewerPanel';

export interface ReviewTaskPanelProps {
  description: string;
  onDescriptionChange: (text: string) => void;
  structuredSections: Partial<Record<AgentStructuredSectionId, string>>;
  onStructuredSectionChange: (sectionId: AgentStructuredSectionId, text: string) => void;
}

export function ReviewTaskPanel({
  description,
  onDescriptionChange,
  structuredSections,
  onStructuredSectionChange,
}: ReviewTaskPanelProps): React.ReactElement {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3">
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wide text-teal-400/90">
          Descrizione task
        </label>
        <textarea
          className="mt-1 w-full min-h-[120px] rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Descrizione del task agente…"
        />
      </div>
      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-violet-400/90">
          Design strutturato
        </p>
        <TaskStructuredViewerPanel
          sections={structuredSections}
          readOnly={false}
          onSectionChange={onStructuredSectionChange}
          className="min-h-[220px]"
        />
      </div>
    </div>
  );
}
