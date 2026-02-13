// Domain layer: Editor event types
// Pure types, no dependencies

import type { TaskType, TaskTree } from '@types/taskTypes';
import type { TaskMeta, TaskWizardMode } from '@taskEditor/EditorHost/types';

/**
 * TaskEditor open event payload
 * id: ALWAYS equals row.id (which equals task.id when task exists)
 */
export interface TaskEditorOpenEvent {
  id: string;  // ALWAYS equals row.id (which equals task.id when task exists)
  type: TaskType;
  label?: string;
  name?: string;
  taskWizardMode?: TaskWizardMode;
  needsTaskBuilder?: boolean;
  needsTaskContextualization?: boolean;
  contextualizationTemplateId?: string;
  taskLabel?: string;
  taskTree?: TaskTree;
  templateId?: string;
}

/**
 * ConditionEditor open event payload
 */
export interface ConditionEditorOpenEvent {
  nodeId?: string;
  label?: string;
  name?: string;
  script?: string;
  variables?: Record<string, any>;
  variablesTree?: any;
}

/**
 * NonInteractiveEditor open event payload
 */
export interface NonInteractiveEditorOpenEvent {
  instanceId: string;
  title?: string;
  accentColor?: string;
}

/**
 * Validates TaskEditorOpenEvent
 */
export function validateTaskEditorEvent(event: any): event is TaskEditorOpenEvent {
  return event && event.id && event.type !== undefined && event.type !== null;
}

/**
 * Validates ConditionEditorOpenEvent
 */
export function validateConditionEditorEvent(event: any): event is ConditionEditorOpenEvent {
  return event && (event.nodeId || event.label || event.name);
}

/**
 * Validates NonInteractiveEditorOpenEvent
 */
export function validateNonInteractiveEditorEvent(event: any): event is NonInteractiveEditorOpenEvent {
  return event && event.instanceId;
}
