// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { TaskType } from '@types/taskTypes';
import type { TaskContentResolverConfig, TaskContentResult } from './TaskContentResolver.types';

/**
 * TaskContentResolver: Domain service for resolving task content
 *
 * PRINCIPLES:
 * - Single Source of Truth: unique logic to extract content
 * - Encapsulation: hides model data details
 * - Deterministic: does not depend on React or global state
 * - Testable: dependency injection for tests
 *
 * USAGE:
 * ```typescript
 * const resolver = TaskContentResolver.create({
 *   getTranslations: () => translations,
 *   getTask: (id) => taskRepository.getTask(id)
 * });
 *
 * const result = resolver.getMessageText(taskId);
 * if (result.hasContent) {
 *   console.log(result.text);
 * }
 * ```
 */
export class TaskContentResolver {
  private constructor(private config: TaskContentResolverConfig) {}

  /**
   * Factory method to create a resolver instance
   */
  static create(config: TaskContentResolverConfig): TaskContentResolver {
    return new TaskContentResolver(config);
  }

  /**
   * Resolves the text of a SayMessage task
   *
   * @param taskId - Task ID
   * @returns TaskContentResult with text, textKey, and metadata
   */
  getMessageText(taskId: string): TaskContentResult {
    const task = this.config.getTask(taskId);

    if (!task) {
      return {
        text: null,
        textKey: null,
        hasContent: false,
        source: 'none'
      };
    }

    // Priority 1: New model (textKey in parameters)
    const textParam = task.parameters?.find(
      (p: any) => p?.parameterId === 'text'
    );
    const textKey = textParam?.value;

    if (textKey && typeof textKey === 'string') {
      const translations = this.config.getTranslations();
      const translation = translations[textKey];

      if (translation && translation.trim().length > 0) {
        return {
          text: translation,
          textKey: textKey,
          hasContent: true,
          source: 'translation'
        };
      }

      // TextKey exists but translation not found
      return {
        text: null,
        textKey: textKey,
        hasContent: false,
        source: 'translation' // textKey present but translation missing
      };
    }

    // Priority 2: Legacy fallback (only if enabled)
    if (this.config.enableLegacyTextFallback && (task as any).text) {
      return {
        text: (task as any).text,
        textKey: null,
        hasContent: (task as any).text.trim().length > 0,
        source: 'legacy'
      };
    }

    // No content found
    return {
      text: null,
      textKey: null,
      hasContent: false,
      source: 'none'
    };
  }

  /**
   * Checks if a SayMessage task has content
   *
   * @param taskId - Task ID
   * @returns true if the task has non-empty text
   */
  hasMessage(taskId: string): boolean {
    return this.getMessageText(taskId).hasContent;
  }

  /**
   * Resolves the textKey of a task (if exists)
   *
   * @param taskId - Task ID
   * @returns textKey (GUID) or null
   */
  getTextKey(taskId: string): string | null {
    return this.getMessageText(taskId).textKey;
  }

  /**
   * Checks if a task has a TaskTree (relevant content)
   *
   * @param taskId - Task ID
   * @param taskType - Task type (for type-specific logic)
   * @returns true if the task has relevant content
   */
  hasTaskTree(taskId: string, taskType: TaskType): boolean {
    const task = this.config.getTask(taskId);

    if (!task) {
      return false;
    }

    switch (taskType) {
      case TaskType.SayMessage:
        return this.hasMessage(taskId);

      case TaskType.UtteranceInterpretation:
        // For DataRequest, always allowed (can create empty TaskTree)
        return true;

      case TaskType.ClassifyProblem:
        // For ProblemClassification, require templateId or data
        return Boolean(
          (task.templateId && task.templateId !== 'UNDEFINED' && task.templateId !== null) ||
          (task.data && task.data.length > 0)
        );

      case TaskType.Subflow:
        // Flow always allows opening subflow tab
        return true;

      default:
        // For other types: check if there's relevant content
        return Boolean(
          this.hasMessage(taskId) ||
          task.endpoint ||
          (Array.isArray(task.semanticValues) && task.semanticValues.length > 0)
        );
    }
  }

  /**
   * Generic method to check if a task has any content
   *
   * @param taskId - Task ID
   * @param taskType - Task type
   * @returns true if the task has any relevant content
   */
  hasContent(taskId: string, taskType: TaskType): boolean {
    return this.hasTaskTree(taskId, taskType);
  }
}
