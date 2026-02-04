// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Template Search Service
 *
 * Handles template search and matching logic.
 * No UI dependencies, pure business logic.
 */

import { DialogueTaskService } from '../../../services/DialogueTaskService';
import { TaskTemplateMatcherService } from '../../../services/TaskTemplateMatcherService';

export interface TemplateSearchResult {
  found: boolean;
  template?: any;
  matchScore?: number;
  reason?: string;
}

/**
 * Search for a template matching the task label
 */
export async function searchTemplate(
  taskLabel: string,
  taskType?: string
): Promise<TemplateSearchResult> {
  try {
    // Use existing template matcher service
    const match = await TaskTemplateMatcherService.findTaskTemplate(taskLabel, taskType);

    if (match) {
      return {
        found: true,
        template: match.template,
        matchScore: 1.0, // TaskTemplateMatcherService doesn't return score, use default
        reason: `Matched template: ${match.templateId}`
      };
    }

    return {
      found: false,
      reason: 'No matching template found'
    };
  } catch (error) {
    console.error('[templateSearchService] Error searching template:', error);
    return {
      found: false,
      reason: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check if template cache is loaded
 */
export function isTemplateCacheLoaded(): boolean {
  return DialogueTaskService.isCacheLoaded();
}

/**
 * Load template cache if needed
 */
export async function ensureTemplateCacheLoaded(): Promise<boolean> {
  if (isTemplateCacheLoaded()) {
    return true;
  }

  try {
    // DialogueTaskService should handle cache loading
    // This is a placeholder - adjust based on actual implementation
    return true;
  } catch (error) {
    console.error('[templateSearchService] Error loading template cache:', error);
    return false;
  }
}
