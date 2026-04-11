// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { TaskContentResolver } from './TaskContentResolver';
import { taskRepository } from '@services/TaskRepository';
import type { TaskContentResolverConfig } from './TaskContentResolver.types';
import { getProjectTranslationsTable } from '@utils/projectTranslationsRegistry';

/**
 * Creates a resolver for the running app: same merged translation map as authoring/runtime
 * (`compiledTranslations`), not only the global React slice on `window`.
 */
export function createProductionResolver(): TaskContentResolver {
  const config: TaskContentResolverConfig = {
    getTranslations: () => getProjectTranslationsTable(),
    getTask: (taskId: string) => taskRepository.getTask(taskId),
  };

  return TaskContentResolver.create(config);
}

/** Singleton for global use (e.g. flowchart hasTaskTree checks). */
let globalResolver: TaskContentResolver | null = null;

export function getGlobalResolver(): TaskContentResolver {
  if (!globalResolver) {
    globalResolver = createProductionResolver();
  }
  return globalResolver;
}
