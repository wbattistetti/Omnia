// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import DialogueTaskService from '@services/DialogueTaskService';
import { taskRepository } from '@services/TaskRepository';
import type { TaskTreeNode } from '@types/taskTypes';
import { taskRowUsesSubTasksContract } from '@utils/taskKind';
import { resolveNodeDataContract } from '@utils/taskNodeContractResolver';
import { catalogueLookupTemplateId } from '@utils/taskTreeNodeCatalogueLookup';
import { derivePersistableTestPhrases } from '@responseEditor/domain/testPhrasesContractGridSync';

/**
 * Centralized service for persisting testPhrases (test phrases) on the data contract.
 *
 * - Template-backed rows: template.dataContract.testPhrases in DialogueTaskService cache.
 * - Standalone materialized rows: node.dataContract.testPhrases via updateSelectedNode.
 *
 * The database is updated ONLY on explicit save (handleEditorClose) for templates; standalone
 * updates the task tree node in memory through updateSelectedNode.
 */
export class ExamplesPersistenceService {
  /**
   * Set testPhrases for a node and persist to the correct store for the task row kind.
   *
   * @param contractTestPhrases - Same turn as RecognitionEditor localContract (avoids wiping template when grid lags).
   * @param node - Required for resolveNodeDataContract merge when examplesList is stale.
   */
  static setExamplesForNode(
    nodeId: string,
    nodeTemplateId: string | undefined,
    taskId: string | undefined,
    examplesList: string[],
    updateSelectedNode: (updater: (node: any) => any) => void,
    contractTestPhrases: string[] | undefined,
    node: any
  ): void {
    const row =
      taskId && taskId !== 'unknown' ? taskRepository.getTask(taskId) : null;

    const resolvedList = row && node
      ? resolveNodeDataContract(row, node)?.testPhrases
      : undefined;
    const resolved = Array.isArray(resolvedList) ? resolvedList : undefined;

    const effective = derivePersistableTestPhrases({
      examplesList,
      contractTestPhrases,
      resolvedTestPhrases: resolved,
    });
    const newTestPhrases = effective;

    if (row && taskRowUsesSubTasksContract(row)) {
      updateSelectedNode((prev: any) => {
        if (!prev) return prev;
        const prevPhrases = prev.dataContract?.testPhrases as string[] | undefined;
        const sameLength = (prevPhrases?.length ?? 0) === (newTestPhrases?.length ?? 0);
        const sameContent =
          sameLength &&
          (newTestPhrases == null || newTestPhrases.length === 0
            ? !prevPhrases || prevPhrases.length === 0
            : newTestPhrases.every((ex, idx) => ex === prevPhrases?.[idx]));
        if (sameContent) {
          return prev;
        }

        const base =
          prev.dataContract && typeof prev.dataContract === 'object'
            ? { ...prev.dataContract }
            : {
                subDataMapping: {},
                engines: [],
                outputCanonical: { format: 'value' as const },
              };
        if (newTestPhrases) {
          base.testPhrases = newTestPhrases;
        } else {
          delete base.testPhrases;
        }
        return { ...prev, dataContract: base };
      });

      return;
    }

    if (!nodeTemplateId) {
      console.warn('[ExamplesPersistence] No nodeTemplateId provided, cannot save testPhrases to template');
      return;
    }

    const template = DialogueTaskService.getTemplate(nodeTemplateId);

    if (!template) {
      console.warn('[ExamplesPersistence] Template not found:', nodeTemplateId);
      return;
    }

    if (!template.dataContract) {
      template.dataContract = {
        templateId: nodeTemplateId,
        templateName: template.label || nodeTemplateId,
        subDataMapping: {},
        engines: [],
        outputCanonical: { format: 'value' },
      };
    }

    const prevTestPhrases = template.dataContract.testPhrases;
    const hasChanged =
      (prevTestPhrases?.length || 0) !== (newTestPhrases?.length || 0) ||
      (prevTestPhrases || []).some((ex: string, idx: number) => ex !== newTestPhrases?.[idx]);

    if (hasChanged) {
      template.dataContract.testPhrases = newTestPhrases;
      DialogueTaskService.markTemplateAsModified(nodeTemplateId);
    }
  }

  /**
   * Read testPhrases from the effective contract for this node (standalone vs template cache).
   */
  static getExamplesForNode(node: any, taskId?: string): string[] {
    const row =
      taskId && taskId !== 'unknown' ? taskRepository.getTask(taskId) : null;
    if (row) {
      const contract = resolveNodeDataContract(row, node);
      if (contract?.testPhrases && Array.isArray(contract.testPhrases)) {
        return contract.testPhrases;
      }
      return [];
    }

    const lookup = node ? catalogueLookupTemplateId(node as TaskTreeNode) : '';
    if (!lookup) {
      return [];
    }

    const template = DialogueTaskService.getTemplate(lookup);
    if (!template?.dataContract?.testPhrases) {
      return [];
    }

    return Array.isArray(template.dataContract.testPhrases) ? template.dataContract.testPhrases : [];
  }
}
