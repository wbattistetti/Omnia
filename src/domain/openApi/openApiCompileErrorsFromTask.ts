/**
 * Deriva errori compilazione OpenAPI dal task Backend Call (meta dopo Read API).
 */

import type { Task } from '../../types/taskTypes';
import { collectOpenApiCompileErrorMessages } from './buildOpenApiParamContractLines';

export function openApiCompileErrorsFromTask(task: Task | null | undefined): string[] {
  if (!task) return [];
  return collectOpenApiCompileErrorMessages(task);
}
