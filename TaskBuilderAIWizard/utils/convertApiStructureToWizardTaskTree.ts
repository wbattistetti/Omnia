// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { WizardTaskTreeNode } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * API Structure Node (from backend)
 */
interface ApiStructureNode {
  id?: string;
  label: string;
  type?: string;
  icon?: string;
  subNodes?: ApiStructureNode[];  // Preferred format
  subData?: ApiStructureNode[];    // Backward compatibility (will be normalized)
}

/**
 * Convert API structure response to WizardTaskTreeNode format.
 *
 * This function:
 * 1. Converts subData → subNodes (if present, for backward compatibility)
 * 2. Generates templateId from id (if missing)
 * 3. Initializes pipelineStatus with default values
 * 4. Recursively processes all nodes
 *
 * @param apiStructure Array of nodes from API response
 * @param taskId Task ID (for variable mapping)
 * @returns Array of WizardTaskTreeNode compatible with wizard
 */
export function convertApiStructureToWizardTaskTree(
  apiStructure: ApiStructureNode[],
  taskId: string
): WizardTaskTreeNode[] {
  if (!Array.isArray(apiStructure) || apiStructure.length === 0) {
    return [];
  }

  return apiStructure.map((node) => convertNode(node, taskId));
}

/**
 * Convert a single API node to WizardTaskTreeNode (recursive)
 */
function convertNode(
  apiNode: ApiStructureNode,
  taskId: string,
  parentPath: string[] = []
): WizardTaskTreeNode {
  // Generate ID if missing or invalid (e.g., 'root', 'UNDEFINED')
  let nodeId = apiNode.id;
  if (!nodeId || nodeId === 'root' || nodeId === 'UNDEFINED' || nodeId.trim() === '') {
    nodeId = `node-${uuidv4()}`;
    console.warn('[convertApiStructureToWizardTaskTree] ⚠️ Invalid node id from API, generating new GUID', {
      originalId: apiNode.id,
      newId: nodeId,
      label: apiNode.label,
    });
  }

  // Generate templateId (same as id, but ensure it's a valid GUID)
  // ✅ CRITICAL: templateId must be a valid GUID, not 'root' or 'UNDEFINED'
  const templateId = nodeId;

  // Normalize children: prefer subNodes, fallback to subData (backward compatibility)
  const children = apiNode.subNodes || apiNode.subData || [];

  // Convert children recursively
  const subNodes: WizardTaskTreeNode[] = children.length > 0
    ? children.map((child) => convertNode(child, taskId, [...parentPath, apiNode.label]))
    : undefined;

  // Initialize pipeline status
  const pipelineStatus = {
    constraints: 'pending' as const,
    parser: 'pending' as const,
    messages: 'pending' as const,
    constraintsProgress: 0,
    parserProgress: 0,
    messagesProgress: 0,
  };

  return {
    id: nodeId,
    templateId,
    label: apiNode.label || 'Unnamed',
    type: apiNode.type,
    icon: apiNode.icon,
    subNodes,
    pipelineStatus,
    // Note: readableName, dottedName, taskId will be added later by VariableNameGeneratorService
  };
}
