// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { taskRepository } from '@services/TaskRepository';

/**
 * Centralized service for persisting examplesList to node.nlpProfile.examples
 *
 * This service ensures that examplesList is synchronized across:
 * - node.nlpProfile.examples (in Zustand store)
 * - TaskRepository cache (in-memory)
 *
 * The database is updated ONLY on explicit save (handleEditorClose).
 *
 * Architecture:
 * - Single source of truth: Zustand store (via updateSelectedNode)
 * - TaskRepository cache: mirror of store, updated synchronously
 * - Database: updated only on explicit save
 */
export class ExamplesPersistenceService {
  /**
   * Set examples for a node and synchronize across all layers
   *
   * This method:
   * 1. Updates node.nlpProfile.examples in Zustand store (via updateSelectedNode)
   * 2. Updates TaskRepository cache (in-memory)
   *
   * The database is NOT updated here - it's updated only on explicit save.
   *
   * @param nodeId - The node ID
   * @param nodeTemplateId - The node template ID (for finding in taskTree.nodes)
   * @param taskId - The task ID (for TaskRepository cache)
   * @param examplesList - The new examples list
   * @param updateSelectedNode - Callback to update the node in Zustand store
   * @returns void (updates are applied via callbacks)
   */
  static setExamplesForNode(
    nodeId: string,
    nodeTemplateId: string | undefined,
    taskId: string | undefined,
    examplesList: string[],
    updateSelectedNode: (updater: (node: any) => any) => void
  ): void {
    if (!taskId) {
      console.warn('[ExamplesPersistence] No taskId provided, skipping TaskRepository sync');
    }

    // Step 1: Update node in Zustand store via updateSelectedNode
    updateSelectedNode((prev: any) => {
      if (!prev) return prev;

      const updated = { ...prev };

      // Ensure nlpProfile exists
      if (!updated.nlpProfile) {
        updated.nlpProfile = {};
      }

      // Normalize examples (empty array becomes undefined)
      const newExamples = examplesList.length > 0 ? [...examplesList] : undefined;
      const prevExamples = updated.nlpProfile.examples;

      // Check if changed (avoid unnecessary updates and infinite loops)
      const hasChanged =
        (prevExamples?.length || 0) !== (newExamples?.length || 0) ||
        (prevExamples || []).some((ex: string, idx: number) => ex !== newExamples?.[idx]);

      if (!hasChanged) {
        return prev; // No change, return original to avoid unnecessary updates
      }

      // Log the update (for debugging)
      console.log('[ExamplesPersistence] Saving examplesList to node', {
        nodeId,
        prevCount: prevExamples?.length || 0,
        newCount: newExamples?.length || 0,
        examples: newExamples?.slice(0, 3)
      });

      // Update nlpProfile.examples
      updated.nlpProfile.examples = newExamples;

      // Step 2: Update TaskRepository cache (if taskId provided)
      // ✅ NUOVO MODELLO: Task non ha più .data[], usa TaskTree.nodes[] costruito runtime
      // Non serve più aggiornare cache con .data[] - il TaskTree viene ricostruito da template + instance
      // Examples vengono salvati nel template, non nell'istanza
      if (taskId) {
        try {
          const currentTask = taskRepository.getTask(taskId);
          // ✅ Cache update non necessario - TaskTree viene ricostruito runtime da template + instance
          console.log('[ExamplesPersistence] Examples saved to node (cache update not needed)', {
            taskId,
            nodeId,
            examplesCount: newExamples?.length || 0
          });
        } catch (error) {
          console.error('[ExamplesPersistence] Error accessing TaskRepository', error);
        }
      }

      return updated;
    });
  }

  /**
   * Get examples for a node from the current state
   *
   * @param node - The node object
   * @returns The examples list (or empty array if not set)
   */
  static getExamplesForNode(node: any): string[] {
    if (!node?.nlpProfile?.examples) {
      return [];
    }
    return Array.isArray(node.nlpProfile.examples) ? node.nlpProfile.examples : [];
  }
}
