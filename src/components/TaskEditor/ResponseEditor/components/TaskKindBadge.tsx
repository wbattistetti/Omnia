/**
 * Shows inferred task row role (migration). Read-only; uses TaskRepository + inferTaskKind.
 */

import React from 'react';
import { taskRepository } from '@services/TaskRepository';
import { inferTaskKind, taskKindLabel } from '@utils/taskKind';

const BADGE_FG = '#5c2e00';
const BADGE_BG = '#ffffff';

export type TaskKindBadgeProps = {
  taskId: string | undefined;
  /** Bump when editor state changes so we re-read the task from the repository */
  refreshToken?: unknown;
};

export function TaskKindBadge({ taskId, refreshToken }: TaskKindBadgeProps) {
  const { label, title } = React.useMemo(() => {
    if (!taskId) {
      return {
        label: 'N/A',
        title: 'No task id on this row — task role cannot be inferred.',
      };
    }
    const task = taskRepository.getTask(taskId);
    const kind = inferTaskKind(task);
    const base =
      'Task row role (inferred for legacy rows if kind is unset). See docs/task-model-migration-step1-spec.md';
    const promoteHint =
      kind === 'embedded'
        ? ' Promote to template: available when MVP rules match (GUID nodes).'
        : kind === 'instance'
          ? ' Promote to template applies only to Embedded rows, not Instance.'
          : '';
    return {
      label: taskKindLabel(kind),
      title: base + promoteHint,
    };
  }, [taskId, refreshToken]);

  return (
    <span
      data-testid="task-kind-badge"
      title={title}
      style={{
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.03,
        padding: '4px 10px',
        borderRadius: 8,
        background: BADGE_BG,
        color: BADGE_FG,
        border: `1px solid rgba(0,0,0,0.12)`,
        boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}
