// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { flowchartVariablesService } from '../../src/services/FlowchartVariablesService';
import type { WizardTaskTreeNode } from '../types';

/**
 * Sync variables with structure: register all readableName mappings in FlowchartVariablesService
 *
 * This function:
 * 1. Extracts readableName and dottedName from structure
 * 2. Registers mappings in FlowchartVariablesService
 * 3. Saves to database (via FlowchartVariablesService.saveToDatabase)
 *
 * @param structure Array of WizardTaskTreeNode with readableName, dottedName, taskId populated
 * @param taskId Task ID (should match node.taskId)
 * @param rowId Row ID (for tracking)
 * @param taskLabel Original task label
 * @returns Promise<void>
 */
export async function syncVariablesWithStructure(
  structure: WizardTaskTreeNode[],
  rowId: string, // ✅ ALWAYS equals row.id (which equals task.id when task exists)
  taskLabel: string
): Promise<void> {
  if (!structure || structure.length === 0) {
    console.warn('[VariableSyncService] No structure provided');
    return;
  }

  // Build DDT-like structure for FlowchartVariablesService
  // FlowchartVariablesService expects mainList format with subNodes
  const mainList = structure.map((node) => convertToMainListFormat(node));

  // Create a minimal DDT structure for FlowchartVariablesService
  const ddt = {
    id: rowId, // ✅ ALWAYS equals row.id (which equals task.id when task exists)
    data: mainList,
  };

  // Extract variables using FlowchartVariablesService
  // This will create mappings: readableName → nodeId
  await flowchartVariablesService.extractVariablesFromDDT(
    ddt,
    rowId, // ✅ ALWAYS equals row.id (which equals task.id when task exists)
    rowId, // ✅ ALWAYS equals row.id (which equals task.id when task exists)
    taskLabel
  );

  // Note: FlowchartVariablesService.saveToDatabase() is called when project is saved
  // We don't need to call it here explicitly
}

/**
 * Convert WizardTaskTreeNode to mainList format (for FlowchartVariablesService)
 */
function convertToMainListFormat(node: WizardTaskTreeNode): any {
  const mainNode: any = {
    id: node.id,
    label: node.label,
    icon: node.icon,
    kind: node.type,
    templateId: node.templateId,
  };

  // Add subNodes (FlowchartVariablesService expects subNodes, not subData)
  if (node.subNodes && node.subNodes.length > 0) {
    mainNode.subNodes = node.subNodes.map((subNode) => ({
      id: subNode.id,
      label: subNode.label,
      icon: subNode.icon,
      kind: subNode.type,
      templateId: subNode.templateId,
      required: true, // Default: all sub-nodes are required
    }));
  }

  return mainNode;
}
