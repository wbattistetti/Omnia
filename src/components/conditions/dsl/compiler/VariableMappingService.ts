// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { VariableMappingService as IVariableMappingService } from './ASTCompiler';
import { flowchartVariablesService } from '@services/FlowchartVariablesService';

/**
 * Service for mapping variable labels to GUIDs.
 * Delegates to FlowchartVariablesService.
 */
export class VariableMappingService implements IVariableMappingService {
  /**
   * Get GUID for a variable by its label and optional path.
   */
  async getVariableId(label: string, path?: string[]): Promise<string | null> {
    try {
      // Build full variable path
      const fullPath = path ? `${label}.${path.join('.')}` : label;

      // Try to get GUID by readable name
      const nodeId = flowchartVariablesService.getNodeId(fullPath);
      if (nodeId) {
        return nodeId;
      }

      // If not found, try just the label
      const labelNodeId = flowchartVariablesService.getNodeId(label);
      if (labelNodeId && path) {
        // For nested paths, we might need to construct the full path differently
        // This is a simplified approach - may need refinement based on actual variable structure
        return `${labelNodeId}.${path.join('.')}`;
      }

      return labelNodeId;
    } catch (error) {
      console.warn('[VariableMappingService] Error getting variable ID', { label, path, error });
      return null;
    }
  }
}
