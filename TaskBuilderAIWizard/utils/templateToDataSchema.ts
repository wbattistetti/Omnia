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
 * @returns Array of WizardTaskTreeNode (single root node with potential subNodes)
 */
export function buildDataSchemaFromTemplate(template: DialogueTask): WizardTaskTreeNode[] {
  const buildNode = (t: DialogueTask): WizardTaskTreeNode => {
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
      // Note: In adaptation mode, we only show structure, so we don't need to load sub-templates
      // We can create placeholder nodes or load them if needed
      // For now, we create minimal nodes with just ID and label
      const { DialogueTaskService } = require('@services/DialogueTaskService');

      node.subNodes = t.subTasksIds
        .map(subId => {
          const subTemplate = DialogueTaskService.getTemplate(subId);
          if (subTemplate) {
            return buildNode(subTemplate);
          }
          // Fallback: create minimal node if template not found
          return {
            id: subId,
            label: `Sub-task ${subId}`,
            type: 3,
            subNodes: []
          };
        })
        .filter((n): n is WizardTaskTreeNode => n !== null);
    }

    return node;
  };

  return [buildNode(template)];
}
