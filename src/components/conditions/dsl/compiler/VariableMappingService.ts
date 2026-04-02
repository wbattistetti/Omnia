// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { VariableMappingService as IVariableMappingService } from './ASTCompiler';
import { variableCreationService } from '@services/VariableCreationService';
import { getActiveFlowCanvasId } from '../../../../flows/activeFlowCanvas';

/**
 * Implements VariableMappingService for the DSL compiler.
 * Resolves a human-readable variable label to its variable id (GUID) using the
 * in-memory store maintained by VariableCreationService.
 *
 * The lookup is synchronous (in-memory), so no DB round-trip occurs during
 * condition compilation.
 */
export class VariableMappingService implements IVariableMappingService {
  constructor(private readonly flowCanvasId?: string) {}

  /**
   * Return the id (GUID) for a variable identified by label and optional sub-path.
   */
  async getVariableId(label: string, path?: string[]): Promise<string | null> {
    try {
      const projectId = localStorage.getItem('currentProjectId');
      if (!projectId) {
        console.warn('[VariableMappingService] No projectId in localStorage');
        return null;
      }

      const varName = path && path.length > 0 ? `${label}.${path.join('.')}` : label;
      const flowId = this.flowCanvasId ?? getActiveFlowCanvasId();
      const vid = variableCreationService.getIdByVarName(projectId, varName, undefined, flowId);

      if (!vid) {
        console.warn('[VariableMappingService] Variable not found', { varName, projectId });
      }

      return vid;
    } catch (error) {
      console.warn('[VariableMappingService] Error resolving variable ID', { label, path, error });
      return null;
    }
  }
}
