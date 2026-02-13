// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { WizardTaskTreeNode } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * API Structure Node (from backend)
 *
 * NOTE: The AI does NOT generate IDs. The frontend generates GUIDs for each node
 * when building the tree. The 'id' field from API is ignored.
 */
interface ApiStructureNode {
  id?: string;  // Ignored - frontend generates GUIDs
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
 * 2. Generates GUID for each node (frontend always generates IDs, ignoring API ids)
 * 3. Initializes pipelineStatus with default values
 * 4. Recursively processes all nodes
 *
 * CRITICAL: The AI does NOT generate IDs. The frontend generates a pure GUID
 * for each node. This GUID becomes the template.id when the template is saved.
 *
 * @param apiStructure Array of nodes from API response
 * @param rowId Row ID (ALWAYS equals row.id which equals task.id when task exists)
 * @returns Array of WizardTaskTreeNode compatible with wizard
 */
export function convertApiStructureToWizardTaskTree(
  apiStructure: ApiStructureNode[],
  rowId: string // ✅ ALWAYS equals row.id (which equals task.id when task exists)
): WizardTaskTreeNode[] {
  if (!Array.isArray(apiStructure) || apiStructure.length === 0) {
    return [];
  }

  return apiStructure.map((node) => convertNode(node, rowId));
}

/**
 * Convert a single API node to WizardTaskTreeNode (recursive)
 *
 * CRITICAL: The frontend ALWAYS generates a pure GUID for each node.
 * The AI does NOT generate IDs - it only returns structure (label, type, icon, subNodes).
 * This GUID becomes the template.id when the template is saved to Factory.
 */
function convertNode(
  apiNode: ApiStructureNode,
  rowId: string, // ✅ ALWAYS equals row.id (which equals task.id when task exists) - not used but kept for consistency
  parentPath: string[] = []
): WizardTaskTreeNode {
  // ✅ CRITICAL: Frontend ALWAYS generates a pure GUID for each node
  // Ignore apiNode.id completely - the AI does not generate IDs
  // This GUID will become the template.id when saved to Factory
  const nodeId = uuidv4(); // Pure GUID, no prefix

  // ✅ CRITICAL: templateId MUST always equal id (single source of truth)
  // This is an architectural invariant that must never be violated
  const templateId = nodeId;

  // ✅ INVARIANT CHECK: Ensure id === templateId (this should never fail)
  if (nodeId !== templateId) {
    throw new Error(
      `[convertApiStructureToWizardTaskTree] CRITICAL: node.id (${nodeId}) !== templateId (${templateId}). ` +
      `This should never happen. The ID must be generated once and used consistently.`
    );
  }

  // Normalize children: prefer subNodes, fallback to subData (backward compatibility)
  const children = apiNode.subNodes || apiNode.subData || [];

  // Convert children recursively
  const subNodes: WizardTaskTreeNode[] = children.length > 0
    ? children.map((child) => convertNode(child, rowId, [...parentPath, apiNode.label]))
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

  const result: WizardTaskTreeNode = {
    id: nodeId,
    templateId, // ✅ Always equals nodeId
    label: apiNode.label || 'Unnamed',
    type: apiNode.type,
    icon: apiNode.icon,
    subNodes,
    pipelineStatus,
    // Note: readableName, dottedName will be added later by VariableNameGeneratorService
  };

  // ✅ FINAL INVARIANT CHECK: Verify the invariant is preserved in the result
  if (result.id !== result.templateId) {
    throw new Error(
      `[convertApiStructureToWizardTaskTree] CRITICAL: result.id (${result.id}) !== result.templateId (${result.templateId}). ` +
      `This should never happen. The invariant must be preserved.`
    );
  }

  return result;
}
