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
 * Check if a string is a valid GUID (UUID format or node-{uuid} format)
 */
function isValidGuid(id: string): boolean {
  if (!id || typeof id !== 'string') return false;

  // Check for UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) return true;

  // Check for node-{uuid} format: node-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  const nodeUuidRegex = /^node-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (nodeUuidRegex.test(id)) return true;

  return false;
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
  // ✅ FIX: Always generate GUID if ID is missing, invalid, or not a GUID
  // This ensures every node has a stable GUID from the start, not simple names like "giorno", "mese", "anno"
  let nodeId = apiNode.id;

  if (!nodeId ||
      nodeId === 'root' ||
      nodeId === 'UNDEFINED' ||
      nodeId.trim() === '' ||
      !isValidGuid(nodeId)) {  // ✅ NEW: Check if ID is a valid GUID

    const originalId = nodeId;
    nodeId = `node-${uuidv4()}`;

    console.log('[convertApiStructureToWizardTaskTree] 🔄 Generating GUID for node', {
      originalId: originalId || '(missing)',
      newId: nodeId,
      label: apiNode.label,
      reason: !originalId ? 'missing' :
              !isValidGuid(originalId) ? 'not a valid GUID' :
              'invalid value',
    });
  }

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

  const result: WizardTaskTreeNode = {
    id: nodeId,
    templateId, // ✅ Always equals nodeId
    label: apiNode.label || 'Unnamed',
    type: apiNode.type,
    icon: apiNode.icon,
    subNodes,
    pipelineStatus,
    // Note: readableName, dottedName, taskId will be added later by VariableNameGeneratorService
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
