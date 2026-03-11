// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Template to DataSchema Converter
 *
 * Converts a DialogueTask template to WizardTaskTreeNode format for wizard display.
 * Used in adaptation mode to show template structure before adaptation.
 */

import type { DialogueTask } from '@types/taskTypes';
import type { WizardTaskTreeNode } from '../types';

/**
 * Convert template to dataSchema format for wizard display
 *
 * @param template - Root template to convert
 * @param projectId - Optional project ID to load templates from project database if not found in Factory
 * @returns Array of WizardTaskTreeNode (single root node with potential subNodes)
 */
export async function buildDataSchemaFromTemplate(
  template: DialogueTask,
  projectId?: string
): Promise<WizardTaskTreeNode[]> {
  const buildNode = async (t: DialogueTask): Promise<WizardTaskTreeNode> => {
    const node: WizardTaskTreeNode = {
      id: t.id || '',
      label: t.label || 'Task',
      type: t.type || 3,
      icon: t.icon,
      dataContract: t.dataContract,
      constraints: t.constraints || [],
      subNodes: []
    };

    // Build subNodes from subTasksIds
    if (t.subTasksIds && t.subTasksIds.length > 0) {
      const { DialogueTaskService } = await import('@services/DialogueTaskService');

      // Load sub-templates: try Factory first, then project database
      const subNodesPromises = t.subTasksIds.map(async (subId) => {
        let subTemplate = DialogueTaskService.getTemplate(subId);

        // ✅ If not found in Factory, try loading from project database
        if (!subTemplate && projectId) {
          const { loadTemplateFromProject } = await import('@utils/taskUtils');
          subTemplate = await loadTemplateFromProject(subId, projectId);
        }

        if (subTemplate) {
          return await buildNode(subTemplate);
        }

        // Fallback: create minimal node if template not found
        return {
          id: subId,
          label: `Sub-task ${subId}`,
          type: 3,
          subNodes: []
        };
      });

      const subNodes = await Promise.all(subNodesPromises);
      node.subNodes = subNodes.filter((n): n is WizardTaskTreeNode => n !== null);
    }

    return node;
  };

  const rootNode = await buildNode(template);
  return [rootNode];
}
