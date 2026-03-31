/**
 * Rules for which task rows go to POST /tasks/bulk vs template-only persistence.
 * Project template definitions (catalogue rows: templateId null, not Factory, no embedded graph)
 * are written via DialogueTaskService.saveModifiedTemplates → POST /api/projects/:pid/templates
 * with the full dataContract from in-memory template cache. Bulk must not write the same id
 * with a stripped payload or race the template save.
 */

import type { Task } from '@types/taskTypes';
import { TemplateSource, TaskType } from '@types/taskTypes';
import { isStandaloneMaterializedTaskRow } from '@utils/taskKind';

/**
 * True when this row must NOT appear in POST /tasks/bulk during project save — it is persisted
 * only through the template save path (full document from DialogueTaskService cache).
 */
export function isProjectTemplateDefinitionRowForTemplateEndpointOnly(task: Task): boolean {
  const tid = task.templateId;
  if (tid !== null && tid !== undefined) {
    return false;
  }
  if ((task as { source?: string }).source === TemplateSource.Factory) {
    return false;
  }
  if (isStandaloneMaterializedTaskRow(task)) {
    return false;
  }
  if (task.subTasks && task.subTasks.length > 0) {
    return false;
  }
  // Only UtteranceInterpretation catalogue template rows are persisted via POST /templates (full cache).
  // SayMessage, BackendCall, AIAgent, etc. with templateId null are normal flow-row tasks and MUST go through POST /tasks/bulk (otherwise message text / parameters never persist).
  if (task.type !== TaskType.UtteranceInterpretation) {
    return false;
  }
  return true;
}
