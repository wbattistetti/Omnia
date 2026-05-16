/**
 * Actions palette for AI Agent use case response (same catalog as ResponseEditor Tasks panel).
 */

import React from 'react';
import TaskList from '@taskEditor/TaskPalette/TaskList';
import { FontProvider } from '@context/FontContext';
import { useEscalationTasks } from '@responseEditor/hooks/useEscalationTasks';
import { TaskContext } from '@types/taskContext';
import { filterTasksByContext } from '@utils/taskContextHelpers';

export function UseCaseActionsPalettePanel(): React.ReactElement {
  const [tasks, setTasks] = React.useState<unknown[]>([]);
  useEscalationTasks({ setEscalationTasks: setTasks });

  const filtered = React.useMemo(
    () => filterTasksByContext(tasks as Parameters<typeof filterTasksByContext>[0], TaskContext.ESCALATION),
    [tasks]
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-violet-500/25 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-violet-300/90">
        Azioni
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <FontProvider>
          <TaskList tasks={filtered} />
        </FontProvider>
      </div>
    </div>
  );
}
