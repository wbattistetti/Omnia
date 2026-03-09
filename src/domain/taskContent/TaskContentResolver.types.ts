// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { Task } from '@types/taskTypes';

/**
 * Configuration for TaskContentResolver
 * Allows dependency injection for testing and different contexts
 */
export interface TaskContentResolverConfig {
  /**
   * Provider for accessing translations
   * Permits dependency injection for tests and different contexts
   */
  getTranslations: () => Record<string, string>;

  /**
   * Provider for accessing tasks
   * Permits dependency injection for tests
   */
  getTask: (taskId: string) => Task | null;

  /**
   * Flag to enable backward compatibility with task.text
   * Default: true (for gradual migration)
   */
  enableLegacyTextFallback?: boolean;
}

/**
 * Result of resolving task content
 */
export interface TaskContentResult {
  /** Resolved text content (null if not found) */
  text: string | null;
  /** TextKey (GUID) if exists (null if not found) */
  textKey: string | null;
  /** Whether the task has content */
  hasContent: boolean;
  /** Source of the content */
  source: 'translation' | 'legacy' | 'none';
}
