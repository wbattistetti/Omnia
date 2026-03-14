// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import DialogueTaskService from '@services/DialogueTaskService';

/**
 * Centralized service for persisting testPhrases (frasi di test) to template.dataContract.testPhrases
 *
 * This service ensures that testPhrases are saved in the correct location:
 * - template.dataContract.testPhrases (fonte di verità)
 *
 * The database is updated ONLY on explicit save (handleEditorClose).
 *
 * Architecture:
 * - Single source of truth: template.dataContract.testPhrases
 * - Test phrases are part of the contract, not the node profile
 * - Database: updated only on explicit save
 */
export class ExamplesPersistenceService {
  /**
   * Set testPhrases for a node and save to template.dataContract.testPhrases
   *
   * This method:
   * 1. Saves testPhrases to template.dataContract.testPhrases (fonte di verità)
   * 2. Marks template as modified for future save
   *
   * The database is NOT updated here - it's updated only on explicit save.
   *
   * @param nodeId - The node ID (for logging)
   * @param nodeTemplateId - The node template ID (required - used to find template)
   * @param taskId - The task ID (for logging, not used for persistence)
   * @param examplesList - The new test phrases list (frasi di test)
   * @param updateSelectedNode - Callback (not used anymore, kept for compatibility)
   * @returns void (updates are applied directly to template)
   */
  static setExamplesForNode(
    nodeId: string,
    nodeTemplateId: string | undefined,
    taskId: string | undefined,
    examplesList: string[],
    updateSelectedNode: (updater: (node: any) => any) => void
  ): void {
    if (!nodeTemplateId) {
      console.warn('[ExamplesPersistence] No nodeTemplateId provided, cannot save testPhrases to template');
      return;
    }

    // Normalize testPhrases (empty array becomes undefined)
    const newTestPhrases = examplesList.length > 0 ? [...examplesList] : undefined;

    // ✅ CORRETTO: Salva testPhrases nel template.dataContract.testPhrases
    const template = DialogueTaskService.getTemplate(nodeTemplateId);

    if (!template) {
      console.warn('[ExamplesPersistence] Template not found:', nodeTemplateId);
      return;
    }

    // Assicurati che dataContract esista
    if (!template.dataContract) {
      template.dataContract = {
        templateId: nodeTemplateId,
        templateName: template.label || nodeTemplateId,
        subDataMapping: {},
        engines: [],
        outputCanonical: { format: 'value' }
      };
    }

    // Salva testPhrases nel dataContract
    const prevTestPhrases = template.dataContract.testPhrases;
    const hasChanged =
      (prevTestPhrases?.length || 0) !== (newTestPhrases?.length || 0) ||
      (prevTestPhrases || []).some((ex: string, idx: number) => ex !== newTestPhrases?.[idx]);

    if (hasChanged) {
      template.dataContract.testPhrases = newTestPhrases;
      DialogueTaskService.markTemplateAsModified(nodeTemplateId);

      console.log('[ExamplesPersistence] ✅ Saved testPhrases to template.dataContract.testPhrases', {
        templateId: nodeTemplateId,
        nodeId,
        prevCount: prevTestPhrases?.length || 0,
        newCount: newTestPhrases?.length || 0,
        testPhrases: newTestPhrases?.slice(0, 3)
      });
    }
  }

  /**
   * Get testPhrases for a node from template.dataContract.testPhrases
   *
   * @param node - The node object (must have templateId)
   * @returns The testPhrases list (or empty array if not set)
   */
  static getExamplesForNode(node: any): string[] {
    if (!node?.templateId) {
      return [];
    }

    const template = DialogueTaskService.getTemplate(node.templateId);
    if (!template?.dataContract?.testPhrases) {
      return [];
    }

    return Array.isArray(template.dataContract.testPhrases) ? template.dataContract.testPhrases : [];
  }
}
