// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { TaskContentResolver } from './TaskContentResolver';
import { taskRepository } from '@services/TaskRepository';
import type { TaskContentResolverConfig } from './TaskContentResolver.types';

/**
 * Creates a resolver configured for production environment
 * Uses window.__projectTranslationsContext for translations
 */
export function createProductionResolver(): TaskContentResolver {
  const config: TaskContentResolverConfig = {
    getTranslations: () => {
      // Deterministic access to translations
      // Uses window.__projectTranslationsContext as temporary fallback
      // During migration, this will be replaced by a centralized service
      if (typeof window !== 'undefined') {
        const context = (window as any).__projectTranslationsContext;
        if (context && context.translations) {
          return context.translations;
        }
      }
      return {};
    },
    getTask: (taskId: string) => taskRepository.getTask(taskId),
    enableLegacyTextFallback: true // Enabled during migration
  };

  return TaskContentResolver.create(config);
}

/**
 * Singleton for global use (to be used during migration)
 * TODO: Remove after complete migration
 */
let globalResolver: TaskContentResolver | null = null;

export function getGlobalResolver(): TaskContentResolver {
  if (!globalResolver) {
    globalResolver = createProductionResolver();
  }
  return globalResolver;
}
