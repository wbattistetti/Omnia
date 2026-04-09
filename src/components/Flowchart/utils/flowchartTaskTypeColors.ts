/**
 * Canonical hex colors for Flowchart task rows (label + active type icon).
 * Subflow uses `sidebarTheme.tasks.color` so the canvas matches the Tasks sidebar palette (orange).
 */

import { TaskType } from '@types/taskTypes';
import { sidebarTheme } from '../../Sidebar/sidebarTheme';

/** Muted icon when the row has no TaskTree / inactive state in type visuals. */
export const FLOWCHART_INACTIVE_ICON_GRAY = '#94a3b8';

const LABEL_BY_TYPE: Partial<Record<TaskType, string>> = {
  [TaskType.AIAgent]: '#a855f7',
  [TaskType.UtteranceInterpretation]: '#3b82f6',
  [TaskType.ClassifyProblem]: '#f59e0b',
  [TaskType.Summarizer]: '#06b6d4',
  [TaskType.Negotiation]: '#6366f1',
  [TaskType.BackendCall]: '#22c55e',
  [TaskType.Subflow]: sidebarTheme.tasks.color,
  [TaskType.SayMessage]: '#22c55e',
};

const DEFAULT_LABEL = LABEL_BY_TYPE[TaskType.SayMessage]!;

/**
 * Label / active icon color for a task type on the flowchart (single source of truth).
 */
export function getFlowchartTaskTypeLabelColor(type: TaskType): string {
  const c = LABEL_BY_TYPE[type];
  return c ?? DEFAULT_LABEL;
}
