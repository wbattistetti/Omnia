// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { VariableMappingService as IVariableMappingService } from './ASTCompiler';
import { variableCreationService } from '@services/VariableCreationService';

/**
 * Implements VariableMappingService for the DSL compiler.
 * Resolves a human-readable variable label to its varId (GUID) using the
 * in-memory store maintained by VariableCreationService.
 *
 * The lookup is synchronous (in-memory), so no DB round-trip occurs during
 * condition compilation.
 */
export class VariableMappingService implements IVariableMappingService {
  /**
   * Return the varId for a variable identified by label and optional sub-path.
   * e.g. label="data di nascita", path=["giorno"] → varId for "data di nascita.giorno"
   */
  async getVariableId(label: string, path?: string[]): Promise<string | null> {
    try {
      const projectId = localStorage.getItem('currentProjectId');
      if (!projectId) {
        console.warn('[VariableMappingService] No projectId in localStorage');
        return null;
      }

      const varName = path && path.length > 0 ? `${label}.${path.join('.')}` : label;
      const varId = variableCreationService.getVarIdByVarName(projectId, varName);

      if (!varId) {
        console.warn('[VariableMappingService] Variable not found', { varName, projectId });
      }

      return varId;
    } catch (error) {
      console.warn('[VariableMappingService] Error resolving variable ID', { label, path, error });
      return null;
    }
  }
}
