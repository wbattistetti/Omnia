// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { Task } from '@types/taskTypes';
import type { DialogueTask } from '@services/DialogueTaskService';
import type { EnsureManualVariableOptions, VariableInstance, VariableScope } from '@types/variableTypes';
import { getActiveFlowCanvasId } from '../flows/activeFlowCanvas';
import {
  isVariableVisibleInFlow,
  normalizeVariableInstance,
  sameVariableScopeBucket,
} from '@utils/variableScopeUtils';

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
  normalizeTaskLabel(label: string): string {
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
          scope: 'project',
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

  /**
   * Create a manual variable with empty instanceId and nodeId.
   * Used when user creates a variable from BackendCallEditor output fields.
   * The variable is added to the same in-memory store and will be persisted on project save.
   * Creates the label-GUID mapping automatically (varId = GUID, varName = label).
   */
  /**
   * Create a manual variable (no task instance). Default scope is project (visible in all flows).
   * Use scope "flow" + scopeFlowId to bind to one flow canvas.
   */
  createManualVariable(
    projectId: string,
    varName: string,
    options?: EnsureManualVariableOptions
  ): VariableInstance {
    const scope: VariableScope = options?.scope ?? 'project';
    const scopeFlowId =
      scope === 'flow'
        ? String(options?.scopeFlowId ?? getActiveFlowCanvasId()).trim()
        : '';

    const trimmed = varName.trim();
    if (!trimmed) {
      throw new Error('[VariableCreationService] createManualVariable: varName must be non-empty');
    }

    const existing = this.store.get(projectId) ?? [];

    const existingVar = existing.find(
      v =>
        v.varName === trimmed &&
        sameVariableScopeBucket(v, scope, scope === 'flow' ? scopeFlowId : null)
    );
    if (existingVar) {
      return existingVar;
    }

    const newVariable: VariableInstance = {
      varId: this.generateGuid(),
      varName: trimmed,
      taskInstanceId: '',
      nodeId: '',
      ddtPath: '',
      scope,
      scopeFlowId: scope === 'flow' ? scopeFlowId : undefined,
    };

    this.store.set(projectId, [...existing, newVariable]);
    return newVariable;
  }

  /**
   * Remove a variable by id only if it is not bound to a task instance (manual / flow-slot row).
   */
  removeVariableByVarId(projectId: string, varId: string): boolean {
    const existing = this.store.get(projectId) ?? [];
    const v = existing.find(x => x.varId === varId);
    if (!v || String(v.taskInstanceId ?? '').trim().length > 0) {
      return false;
    }
    this.store.set(
      projectId,
      existing.filter(x => x.varId !== varId)
    );
    return true;
  }

  /**
   * Rename a manual/flow-only variable; task-bound rows cannot be renamed here.
   */
  renameVariableByVarId(projectId: string, varId: string, newName: string): boolean {
    const trimmed = newName.trim();
    if (!trimmed) return false;

    const existing = this.store.get(projectId) ?? [];
    const v = existing.find(x => x.varId === varId);
    if (!v || String(v.taskInstanceId ?? '').trim().length > 0) {
      return false;
    }

    const scope: VariableScope = v.scope ?? 'project';
    const bucketFlowId = scope === 'flow' ? String(v.scopeFlowId ?? '').trim() : null;

    const dup = existing.some(
      x =>
        x.varId !== varId &&
        x.varName === trimmed &&
        sameVariableScopeBucket(x, scope, bucketFlowId)
    );
    if (dup) return false;

    this.store.set(
      projectId,
      existing.map(x => (x.varId === varId ? { ...x, varName: trimmed } : x))
    );
    return true;
  }

  /**
   * Ensure a manual variable exists with the given GUID and label.
   * Useful when a condition needs a stable promised GUID before task materialization.
   */
  ensureManualVariableWithId(
    projectId: string,
    varId: string,
    varName: string,
    options?: EnsureManualVariableOptions
  ): VariableInstance {
    const scope: VariableScope = options?.scope ?? 'project';
    const scopeFlowId =
      scope === 'flow'
        ? String(options?.scopeFlowId ?? getActiveFlowCanvasId()).trim()
        : '';

    const existing = this.store.get(projectId) ?? [];
    const normalizedName = varName.trim();

    // 1) Exact varId already exists → keep GUID and refresh label if needed
    const byId = existing.find(v => v.varId === varId);
    if (byId) {
      if (normalizedName && byId.varName !== normalizedName) {
        const updated = existing.map(v => (v.varId === varId ? { ...v, varName: normalizedName } : v));
        this.store.set(projectId, updated);
        return updated.find(v => v.varId === varId)!;
      }
      return byId;
    }

    // 2) Same label in the same scope bucket → preserve existing stable mapping
    const byName = existing.find(
      v =>
        v.varName === normalizedName &&
        sameVariableScopeBucket(v, scope, scope === 'flow' ? scopeFlowId : null)
    );
    if (byName) {
      return byName;
    }

    const created: VariableInstance = {
      varId,
      varName: normalizedName,
      taskInstanceId: '',
      nodeId: '',
      ddtPath: '',
      scope,
      scopeFlowId: scope === 'flow' ? scopeFlowId : undefined,
    };
    this.store.set(projectId, [...existing, created]);
    return created;
  }

  // ---------------------------------------------------------------------------
  // In-memory queries (synchronous — used by VariableMappingService at compile time)
  // ---------------------------------------------------------------------------

  /**
   * Find a varId by exact varName (and optionally taskInstanceId).
   */
  getVarIdByVarName(
    projectId: string,
    varName: string,
    taskInstanceId?: string,
    flowCanvasId?: string
  ): string | null {
    const all = this.store.get(projectId) ?? [];
    if (taskInstanceId !== undefined) {
      const match = all.find(
        v => v.varName === varName && v.taskInstanceId === taskInstanceId
      );
      return match?.varId ?? null;
    }
    const flowId = flowCanvasId ?? getActiveFlowCanvasId();
    const visible = all.filter(v => isVariableVisibleInFlow(v, flowId));
    const match = visible.find(v => v.varName === varName);
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
  getAllVarNames(projectId: string, flowCanvasId?: string): string[] {
    const flowId = flowCanvasId ?? getActiveFlowCanvasId();
    const vars = (this.store.get(projectId) ?? []).filter(v =>
      isVariableVisibleInFlow(v, flowId)
    );
    return [...new Set(vars.map(v => v.varName))].sort();
  }

  /**
   * Variables visible when authoring conditions on a given flow canvas (project + that flow's slots).
   */
  getVariablesForFlowScope(projectId: string, flowCanvasId?: string): VariableInstance[] {
    const flowId = flowCanvasId ?? getActiveFlowCanvasId();
    return (this.store.get(projectId) ?? []).filter(v => isVariableVisibleInFlow(v, flowId));
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

    // ✅ Separate manual variables (empty taskInstanceId) from task variables for logging
    const manualVariables = variables.filter(v => !v.taskInstanceId || v.taskInstanceId === '');
    const taskVariables = variables.filter(v => v.taskInstanceId && v.taskInstanceId !== '');

    console.log('[VariableCreationService] 💾 saveToDatabase called', {
      projectId,
      totalVariablesInStore: variables.length,
      manualVariables: manualVariables.length,
      taskVariables: taskVariables.length,
      willSkip: variables.length === 0,
      manualVarNames: manualVariables.map(v => v.varName),
      varNamesSample: variables.slice(0, 10).map(v => ({
        varName: v.varName,
        varId: v.varId,
        taskInstanceId: v.taskInstanceId || '(empty)',
        nodeId: v.nodeId || '(empty)'
      })),
    });

    if (variables.length === 0) {
      console.log('[VariableCreationService] ⚠️ No variables to save');
      return true;
    }

    try {
      // ✅ Ensure all variables have required fields (MongoDB compatibility)
      const variablesToSave = variables.map(v => {
        const scope: VariableScope = v.scope === 'flow' ? 'flow' : 'project';
        return {
          varId: v.varId,
          varName: v.varName,
          taskInstanceId: v.taskInstanceId || '', // ✅ Explicit empty string (not null/undefined)
          nodeId: v.nodeId || '', // ✅ Explicit empty string (not null/undefined)
          ddtPath: v.ddtPath || '', // ✅ Explicit empty string (not null/undefined)
          scope,
          scopeFlowId: scope === 'flow' ? (v.scopeFlowId ?? '') : '',
          projectId: projectId // ✅ Will be set by backend, but include for clarity
        };
      });

      console.log('[VariableCreationService] 📤 Sending variables to backend', {
        projectId,
        totalCount: variablesToSave.length,
        manualVariablesCount: manualVariables.length,
        taskVariablesCount: taskVariables.length
      });

      const response = await fetch(`/api/projects/${projectId}/variables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variables: variablesToSave }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[VariableCreationService] ❌ Failed to save variables', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          variablesCount: variablesToSave.length,
          manualVariablesCount: manualVariables.length
        });
        return false;
      }

      const result = await response.json();
      console.log('[VariableCreationService] ✅ Variables saved to database', {
        projectId,
        totalCount: variablesToSave.length,
        inserted: result.insertedCount || 0,
        modified: result.modifiedCount || 0,
        manualVariablesSaved: manualVariables.length,
        taskVariablesSaved: taskVariables.length,
        manualVarNames: manualVariables.map(v => v.varName)
      });
      return true;
    } catch (error) {
      console.error('[VariableCreationService] ❌ Error saving variables', {
        error: error instanceof Error ? error.message : String(error),
        projectId,
        variablesCount: variables.length,
        manualVariablesCount: manualVariables.length
      });
      return false;
    }
  }

  /**
   * Load variables for a project from the database into memory.
   * Called when a project is opened.
   */
  async loadFromDatabase(projectId: string): Promise<void> {
    try {
      console.log('[VariableCreationService] 📥 Loading variables from database', { projectId });

      const response = await fetch(`/api/projects/${projectId}/variables`);

      if (!response.ok) {
        if (response.status === 404) {
          console.log('[VariableCreationService] ⚠️ No variables found in database (404)');
          this.store.set(projectId, []);
          return;
        }
        console.warn('[VariableCreationService] Failed to load variables', {
          status: response.status,
          statusText: response.statusText
        });
        return;
      }

      const variables: VariableInstance[] = await response.json();

      // ✅ Separate manual variables from task variables for logging
      const manualVariables = variables.filter(v => !v.taskInstanceId || v.taskInstanceId === '');
      const taskVariables = variables.filter(v => v.taskInstanceId && v.taskInstanceId !== '');

      console.log('[VariableCreationService] 📥 Variables received from database', {
        projectId,
        totalCount: variables.length,
        manualVariables: manualVariables.length,
        taskVariables: taskVariables.length,
        manualVarNames: manualVariables.map(v => v.varName)
      });

      // Deduplicate by varId (canonical key). Same name + different varId = both kept (DSL references varId).
      const byVarId = new Map<string, VariableInstance>();
      for (const v of variables) {
        const rawId = typeof v.varId === 'string' ? v.varId.trim() : '';
        if (!rawId) {
          console.warn('[VariableCreationService] ⚠️ Skipping variable row without varId', {
            projectId,
            varName: v.varName,
          });
          continue;
        }
        if (byVarId.has(rawId)) {
          console.warn('[VariableCreationService] ⚠️ Duplicate varId in DB response; keeping last row', {
            projectId,
            varId: rawId,
          });
        }
        byVarId.set(rawId, normalizeVariableInstance({
          ...v,
          varId: rawId,
          varName: typeof v.varName === 'string' ? v.varName.trim() : String(v.varName ?? ''),
          taskInstanceId: v.taskInstanceId ?? '',
          nodeId: v.nodeId ?? '',
          ddtPath: v.ddtPath ?? '',
          scope: (v as VariableInstance).scope,
          scopeFlowId: (v as VariableInstance).scopeFlowId,
        }));
      }
      const deduplicated = Array.from(byVarId.values());

      this.store.set(projectId, deduplicated);

      const finalManualVariables = deduplicated.filter(v => !v.taskInstanceId || v.taskInstanceId === '');
      const finalTaskVariables = deduplicated.filter(v => v.taskInstanceId && v.taskInstanceId !== '');

      console.log('[VariableCreationService] ✅ Variables loaded from database', {
        projectId,
        totalCount: deduplicated.length,
        manualVariables: finalManualVariables.length,
        taskVariables: finalTaskVariables.length,
        duplicatesRemovedByVarId: variables.length - deduplicated.length,
        manualVarNames: finalManualVariables.map(v => v.varName)
      });
    } catch (error) {
      console.warn('[VariableCreationService] ❌ Error loading variables', {
        error: error instanceof Error ? error.message : String(error),
        projectId
      });
      this.store.set(projectId, []);
    }
  }
}

export const variableCreationService = new VariableCreationService();
