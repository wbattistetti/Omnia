// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { Task } from '@types/taskTypes';
import type { DialogueTask } from '@services/DialogueTaskService';
import type { VariableInstance } from '@types/variableTypes';

interface CreateVariablesOptions {
  taskInstance: Task;
  template: DialogueTask;
  taskLabel: string;
  projectId: string;
  dataSchema: any[]; // REQUIRED: WizardTaskTreeNode[] - always available from cloneTemplateToInstance
}

/**
 * Service for creating and managing variables for task instances.
 *
 * Variables are kept in-memory and persisted to DB only on explicit project save.
 * This mirrors the pattern used by taskRepository and project translations.
 */
class VariableCreationService {
  /** In-memory store: projectId → VariableInstance[] */
  private store: Map<string, VariableInstance[]> = new Map();

  // ---------------------------------------------------------------------------
  // Normalization helpers
  // ---------------------------------------------------------------------------

  /**
   * Remove conversational verbs and articles from a task label to get
   * the semantic variable name.
   * e.g. "chiedi la data di nascita" → "data di nascita"
   */
  private normalizeTaskLabel(label: string): string {
    let normalized = label.trim();

    // Remove common Italian conversational verbs
    normalized = normalized.replace(/^(chiedi|richiedi|inserisci|fornisci|inserire|fornire)\s+/i, '');

    // Remove common English conversational verbs
    normalized = normalized.replace(/^(ask for|request|enter|provide|insert)\s+/i, '');

    // Remove Italian and English articles
    normalized = normalized.replace(/^(la|il|lo|le|gli|un|una|uno|the|a|an)\s+/i, '');

    return normalized.trim() || label.trim();
  }

  /**
   * Build a variable name from normalized label and optional sub-path.
   * Root node  → "data di nascita"
   * Sub node   → "data di nascita.giorno"
   */
  private buildVarName(normalizedLabel: string, path: string[]): string {
    if (path.length === 0) {
      return normalizedLabel;
    }
    return `${normalizedLabel}.${path.join('.')}`;
  }

  /**
   * Generate a random UUID v4.
   */
  private generateGuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // ---------------------------------------------------------------------------
  // Core: create variables in memory (no DB call)
  // ---------------------------------------------------------------------------

  /**
   * Create VariableInstance objects for every node in the template structure
   * and store them in memory.
   *
   * Called immediately after cloneTemplateToInstance() so that the template
   * structure (node IDs) is already stable.
   *
   * NO network call is made here. Variables are persisted only on project save.
   */
  createVariablesForInstance(options: CreateVariablesOptions): VariableInstance[] {
    const { taskInstance, template, taskLabel, projectId, dataSchema } = options;

    // ✅ VALIDATION: dataSchema is always required (guaranteed by cloneTemplateToInstance)
    if (!dataSchema || !Array.isArray(dataSchema) || dataSchema.length === 0) {
      throw new Error(
        '[VariableCreationService] dataSchema is required and must be a non-empty array. ' +
        'This should never happen if called from cloneTemplateToInstance.'
      );
    }

    const normalizedLabel = this.normalizeTaskLabel(taskLabel);
    const variables: VariableInstance[] = [];

    console.log('[VariableCreationService] 🚀 createVariablesForInstance', {
      taskInstanceId: taskInstance.id,
      templateId: (template as any).id,
      taskLabel,
      normalizedLabel,
      dataSchemaLength: dataSchema.length,
      hasData: dataSchema.length > 0,
    });

    dataSchema.forEach((node: any, mainIndex: number) => {
      const nodeId: string = node.id || node._id || node.templateId || '';
      if (!nodeId) {
        console.warn('[VariableCreationService] ⚠️ Skipping node without id', { mainIndex, nodeKeys: Object.keys(node) });
        return;
      }

      // Root / main data node → varName is the normalized task label
      variables.push({
        varId: this.generateGuid(),
        varName: this.buildVarName(normalizedLabel, []),
        taskInstanceId: taskInstance.id,
        nodeId,
        ddtPath: `data[${mainIndex}]`,
      });

      // Sub-data nodes → varName is "normalizedLabel.<subLabel>"
      const subDataList: any[] = Array.isArray(node.subData) ? node.subData
        : Array.isArray(node.subNodes) ? node.subNodes
        : [];

      subDataList.forEach((sub: any, subIndex: number) => {
        const subNodeId: string = sub.id || sub._id || sub.templateId || '';
        if (!subNodeId) {
          console.warn('[VariableCreationService] ⚠️ Skipping subData node without id', { mainIndex, subIndex, subKeys: Object.keys(sub) });
          return;
        }

        const subLabel: string = (sub.label || sub.name || `sub${subIndex}`)
          .toLowerCase()
          .trim();

        variables.push({
          varId: this.generateGuid(),
          varName: this.buildVarName(normalizedLabel, [subLabel]),
          taskInstanceId: taskInstance.id,
          nodeId: subNodeId,
          ddtPath: `data[${mainIndex}].subData[${subIndex}]`,
        });
      });
    });

    // Merge into in-memory store (replace existing entries for this instance)
    const existing = (this.store.get(projectId) ?? []).filter(
      v => v.taskInstanceId !== taskInstance.id
    );
    this.store.set(projectId, [...existing, ...variables]);

    console.log('[VariableCreationService] ✅ In-memory store updated', {
      projectId,
      taskInstanceId: taskInstance.id,
      variablesCreated: variables.length,
      totalInStore: (this.store.get(projectId) ?? []).length,
      varNames: variables.map(v => v.varName),
    });

    return variables;
  }

  /**
   * Remove all variables for a given row/instance from memory.
   * Changes are persisted on the next explicit project save.
   */
  deleteVariablesForInstance(projectId: string, taskInstanceId: string): void {
    const existing = this.store.get(projectId) ?? [];
    this.store.set(
      projectId,
      existing.filter(v => v.taskInstanceId !== taskInstanceId)
    );
  }

  // ---------------------------------------------------------------------------
  // In-memory queries (synchronous — used by VariableMappingService at compile time)
  // ---------------------------------------------------------------------------

  /**
   * Find a varId by exact varName (and optionally taskInstanceId).
   */
  getVarIdByVarName(projectId: string, varName: string, taskInstanceId?: string): string | null {
    const vars = this.store.get(projectId) ?? [];
    const match = vars.find(v =>
      v.varName === varName &&
      (taskInstanceId === undefined || v.taskInstanceId === taskInstanceId)
    );
    return match?.varId ?? null;
  }

  /**
   * Find a varId by nodeId + taskInstanceId.
   */
  getVarIdByNodeId(projectId: string, nodeId: string, taskInstanceId: string): string | null {
    const vars = this.store.get(projectId) ?? [];
    const match = vars.find(v => v.nodeId === nodeId && v.taskInstanceId === taskInstanceId);
    return match?.varId ?? null;
  }

  /**
   * Return all variables for a task instance.
   */
  getVariablesByTaskInstanceId(projectId: string, taskInstanceId: string): VariableInstance[] {
    return (this.store.get(projectId) ?? []).filter(v => v.taskInstanceId === taskInstanceId);
  }

  /**
   * Return all variable names for use in condition editor autocomplete.
   */
  getAllVarNames(projectId: string): string[] {
    const vars = this.store.get(projectId) ?? [];
    return [...new Set(vars.map(v => v.varName))].sort();
  }

  /**
   * Return the varName (human-readable label) for a given varId.
   * Used by condition editor to display stored GUIDs as labels.
   */
  getVarNameByVarId(projectId: string, varId: string): string | null {
    const vars = this.store.get(projectId) ?? [];
    const match = vars.find(v => v.varId === varId);
    return match?.varName ?? null;
  }

  /**
   * Return the total number of in-memory variables for a project.
   */
  getCount(projectId: string): number {
    return (this.store.get(projectId) ?? []).length;
  }

  /**
   * Return all variables for a project.
   * Used by compiler to build variable mapping.
   */
  getAllVariables(projectId: string): VariableInstance[] {
    return this.store.get(projectId) ?? [];
  }

  // ---------------------------------------------------------------------------
  // Persistence: explicit save / load (called by AppContent.tsx)
  // ---------------------------------------------------------------------------

  /**
   * Persist all in-memory variables for a project to the database.
   * Called only when the user explicitly saves the project.
   */
  async saveToDatabase(projectId: string): Promise<boolean> {
    const variables = this.store.get(projectId) ?? [];

    console.log('[VariableCreationService] 💾 saveToDatabase called', {
      projectId,
      variablesInStore: variables.length,
      willSkip: variables.length === 0,
      varNamesSample: variables.slice(0, 5).map(v => v.varName),
    });

    if (variables.length === 0) return true;

    try {
      const response = await fetch(`/api/projects/${projectId}/variables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variables }),
      });

      if (!response.ok) {
        console.error('[VariableCreationService] Failed to save variables', response.statusText);
        return false;
      }

      console.log('[VariableCreationService] ✅ Variables saved to database', {
        projectId,
        count: variables.length,
      });
      return true;
    } catch (error) {
      console.error('[VariableCreationService] ❌ Error saving variables', error);
      return false;
    }
  }

  /**
   * Load variables for a project from the database into memory.
   * Called when a project is opened.
   */
  async loadFromDatabase(projectId: string): Promise<void> {
    try {
      const response = await fetch(`/api/projects/${projectId}/variables`);

      if (!response.ok) {
        if (response.status === 404) {
          this.store.set(projectId, []);
          return;
        }
        console.warn('[VariableCreationService] Failed to load variables', response.statusText);
        return;
      }

      const variables: VariableInstance[] = await response.json();
      this.store.set(projectId, Array.isArray(variables) ? variables : []);

      console.log('[VariableCreationService] ✅ Variables loaded from database', {
        projectId,
        count: (this.store.get(projectId) ?? []).length,
      });
    } catch (error) {
      console.warn('[VariableCreationService] ❌ Error loading variables', error);
      this.store.set(projectId, []);
    }
  }
}

export const variableCreationService = new VariableCreationService();
