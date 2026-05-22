/**
 * Azioni use case in sola lettura (nessun ResponseEditor / drag-drop).
 */

import React from 'react';
import { ListTree } from 'lucide-react';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import {
  getUseCaseResponseTasks,
  splitResponseMessageAndActions,
} from '@domain/aiAgentUseCase/useCaseResponseTasks';
import { summarizeUseCaseActionLabel } from '@omnia/domain-core/usecase/logic/useCaseActionSummary';
import { UC_RESPONSE_ICON_COL } from './reviewPresentation';

export interface UseCaseActionsReadOnlyListProps {
  useCase: AIAgentUseCase;
  className?: string;
}

export function UseCaseActionsReadOnlyList({
  useCase,
  className = '',
}: UseCaseActionsReadOnlyListProps): React.ReactElement {
  const tasks = getUseCaseResponseTasks(useCase);
  const { actionTasks } = React.useMemo(
    () => splitResponseMessageAndActions(tasks),
    [tasks]
  );

  if (actionTasks.length === 0) {
    return (
      <div
        className={`rounded-md border border-dashed border-slate-500/50 bg-slate-900/30 px-3 py-4 text-center text-xs text-slate-500 ${className}`}
      >
        Nessuna azione collegata a questo use case.
      </div>
    );
  }

  return (
    <ul className={`space-y-1.5 ${className}`}>
      {actionTasks.map((task) => (
        <li
          key={task.id}
          className="flex items-start gap-1 rounded border border-slate-600/40 bg-slate-900/50 px-2 py-1.5 text-xs text-slate-200"
        >
          <span className={`${UC_RESPONSE_ICON_COL} text-slate-400`} title="Azione">
            <ListTree size={14} aria-hidden />
          </span>
          <span className="min-w-0 flex-1 leading-snug">{summarizeUseCaseActionLabel(task)}</span>
        </li>
      ))}
    </ul>
  );
}
