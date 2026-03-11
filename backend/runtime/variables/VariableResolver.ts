// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Resolves nodeId + taskInstanceId to varId by querying the variables collection.
 * This is needed because the backend receives nodeId from DDT engine, but conditions use varId.
 */

interface VariableInstance {
  varId: string;
  varName: string;
  taskInstanceId: string;
  nodeId: string;
  ddtPath: string;
  createdAt: number;
  updatedAt: number;
}

class VariableResolver {
  private cache: Map<string, string> = new Map(); // Cache: "nodeId:taskInstanceId" -> varId
  private projectId: string | null = null;

  /**
   * Initialize resolver with projectId
   */
  setProjectId(projectId: string): void {
    this.projectId = projectId;
    this.cache.clear();
  }

  /**
   * Resolve nodeId + taskInstanceId to varId
   */
  async resolveVarId(nodeId: string, taskInstanceId: string): Promise<string | null> {
    if (!this.projectId) {
      console.warn('[VariableResolver] No projectId set');
      return null;
    }

    // Check cache first
    const cacheKey = `${nodeId}:${taskInstanceId}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) || null;
    }

    try {
      // Query database for variable with matching nodeId and taskInstanceId
      const response = await fetch(`http://localhost:3100/api/projects/${this.projectId}/variables?nodeId=${nodeId}&taskInstanceId=${taskInstanceId}`);

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        console.warn('[VariableResolver] Failed to resolve varId', {
          nodeId,
          taskInstanceId,
          status: response.status
        });
        return null;
      }

      const variables: VariableInstance[] = await response.json();

      if (variables && variables.length > 0) {
        const varId = variables[0].varId;
        // Cache result
        this.cache.set(cacheKey, varId);
        return varId;
      }

      return null;
    } catch (error) {
      console.error('[VariableResolver] Error resolving varId', {
        nodeId,
        taskInstanceId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Clear cache (useful when variables are created/deleted)
   */
  clearCache(): void {
    this.cache.clear();
  }
}

export const variableResolver = new VariableResolver();
