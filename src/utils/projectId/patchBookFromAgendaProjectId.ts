/**
 * Se SEND projectId è vuoto su Backend Call bookfromagenda, valorizza con generateProjectId e persiste nel TaskRepository.
 */

import type { Task } from '@types/taskTypes';
import { TaskType } from '@types/taskTypes';
import { taskRepository } from '@services/TaskRepository';
import { generateProjectId } from './generateProjectId';
import type { GenerateProjectIdSegments } from './generateProjectId';

function taskTargetsBookFromAgenda(task: Task): boolean {
  const ep = (task as Task & { endpoint?: { url?: string } }).endpoint;
  const url = ep && typeof ep.url === 'string' ? ep.url.trim().toLowerCase() : '';
  return url.includes('bookfromagenda');
}

/**
 * @returns true se ha modificato almeno un task
 */
export function patchEmptyBookFromAgendaProjectId(
  taskIds: Iterable<string>,
  segments: GenerateProjectIdSegments,
  projectIdForRepo?: string
): boolean {
  const pid = generateProjectId(segments.cliente, segments.nomeProgetto, segments.versione);
  let anyChanged = false;
  for (const id of taskIds) {
    const task = taskRepository.getTask(id);
    if (!task || task.type !== TaskType.BackendCall || !taskTargetsBookFromAgenda(task)) continue;
    const inputs = (task as Task & { inputs?: Array<{ apiParam?: string; variable?: string; internalName?: string }> })
      .inputs;
    if (!Array.isArray(inputs)) continue;
    let rowPatched = false;
    const next = inputs.map((row) => {
      if (String(row.apiParam || '').trim() !== 'projectId') return row;
      if (String(row.variable ?? '').trim()) return row;
      rowPatched = true;
      return { ...row, variable: pid };
    });
    if (rowPatched) {
      anyChanged = true;
      taskRepository.updateTask(id, { inputs: next } as Partial<Task>, projectIdForRepo, { merge: true });
    }
  }
  return anyChanged;
}
