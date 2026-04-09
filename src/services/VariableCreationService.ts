// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { Task, TaskTree, TaskTreeNode } from '@types/taskTypes';
import type { DialogueTask } from '@services/DialogueTaskService';
import type { EnsureManualVariableOptions, VariableInstance, VariableScope } from '@types/variableTypes';
import type { WorkspaceState } from '../flows/FlowTypes';
import { getActiveFlowCanvasId } from '../flows/activeFlowCanvas';
import { FlowWorkspaceSnapshot } from '../flows/FlowWorkspaceSnapshot';
import { taskRepository } from './TaskRepository';
import { buildStandaloneTaskTreeView } from '../utils/buildStandaloneTaskTreeView';
import { getMainNodes } from '@responseEditor/core/domain';
import { TaskType, isUtteranceInterpretationTask } from '../types/taskTypes';
import {
  getTaskInstanceIdToFlowIdMap,
  isVariableVisibleInFlow,
  normalizeVariableInstance,
  sameVariableScopeBucket,
} from '@utils/variableScopeUtils';
import { normalizeSemanticTaskLabel } from '../domain/variableProxyNaming';
import { flattenUtteranceTaskTreeVariableRows } from '@utils/utteranceTaskVariableSync';
import { logVariableScope } from '@utils/debugVariableScope';
import {
  isFallbackProjectBucket,
  resolveVariableStoreProjectId,
} from '@utils/safeProjectId';
import { logVariableHydration } from '../utils/variableMenuDebug';
import { logTaskSubflowMove } from '@utils/taskSubflowMoveDebug';
import {
  MANUAL_VARIABLE_METADATA_TYPE,
  PROJECT_VARIABLE_METADATA_TYPE,
  reconstructVariableInstanceFromMinimalDoc,
  SUBFLOW_VARIABLE_METADATA_TYPE,
  TASK_BOUND_VARIABLE_METADATA_TYPE,
  UTTERANCE_VARIABLE_METADATA_TYPE,
} from '@utils/utteranceVariablePersistence';
import { getVariableLabel } from '@utils/getVariableLabel';
import { getProjectTranslationsTable } from '@utils/projectTranslationsRegistry';

interface CreateVariablesOptions {
  taskInstance: Task;
  template: DialogueTask;
  taskLabel: string;
  projectId: string | null | undefined;
  /** Flow canvas that owns this task row (per-flow namespace for task-bound variables). */
  flowId?: string | null;
  dataSchema: any[]; // REQUIRED: WizardTaskTreeNode[] - always available from cloneTemplateToInstance
}

/**
 * Service for creating and managing variables for task instances.
 *
 * Variables are kept in-memory and persisted to DB only on explicit project save.
 * This mirrors the pattern used by taskRepository and project translations.
 *
 * Phase 1 (GUID-centric utterance): identity is always `VariableInstance.id` (GUID).
 * For utterance tasks, `id` equals `TaskTreeNode.id`. Utterance rows are hydrated via
 * {@link hydrateVariablesFromTaskTree} / {@link hydrateVariablesFromFlow} only — not from the variable menu.
 */
class VariableCreationService {
  /** In-memory store: projectId → VariableInstance[] */
  private store: Map<string, VariableInstance[]> = new Map();

  /** Stable store key: explicit trimmed id, else {@link resolveVariableStoreProjectId}. */
  private projectKey(projectId: string | null | undefined): string {
    return resolveVariableStoreProjectId(projectId);
  }

  // ---------------------------------------------------------------------------
  // Normalization helpers
  // ---------------------------------------------------------------------------

  /**
   * Remove conversational verbs and articles from a task label to get
   * the semantic variable name. Delegates to {@link normalizeSemanticTaskLabel}.
   */
  normalizeTaskLabel(label: string): string {
    return normalizeSemanticTaskLabel(label);
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
   * Generate a random UUID v4 (manual-only rows without a TaskTreeNode).
   */
  private generateGuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Phase 4: task-bound rows whose task is UtteranceInterpretation or ClassifyProblem
   * are persisted as minimal Mongo documents (id + projectId + metadata); labels live in translations.
   */
  private isPersistedUtteranceVariable(v: VariableInstance): boolean {
    const tid = String(v.taskInstanceId || '').trim();
    if (!tid) return false;
    const task = taskRepository.getTask(tid);
    if (!task) return false;
    return isUtteranceInterpretationTask(task) || task.type === TaskType.ClassifyProblem;
  }

  /**
   * Phase 5: every variable row is persisted as a minimal GUID-centric document; labels are in translations.
   */
  private buildGuidCentricPersistPayload(
    v: VariableInstance,
    projectId: string
  ): Record<string, unknown> {
    if (this.isPersistedUtteranceVariable(v)) {
      return {
        id: v.id,
        projectId,
        metadata: { type: UTTERANCE_VARIABLE_METADATA_TYPE },
      };
    }
    const bf = String(v.bindingFrom ?? '').trim();
    const bt = String(v.bindingTo ?? '').trim();
    if (bf && bt) {
      return {
        id: v.id,
        projectId,
        from: bf,
        to: bt,
        metadata: { type: SUBFLOW_VARIABLE_METADATA_TYPE },
      };
    }
    const tid = String(v.taskInstanceId || '').trim();
    if (!tid) {
      const scope: VariableScope = v.scope ?? 'project';
      if (scope === 'project') {
        return {
          id: v.id,
          projectId,
          metadata: { type: PROJECT_VARIABLE_METADATA_TYPE },
        };
      }
      return {
        id: v.id,
        projectId,
        metadata: {
          type: MANUAL_VARIABLE_METADATA_TYPE,
          flowCanvasId: String(v.scopeFlowId || '').trim() || undefined,
        },
      };
    }
    return {
      id: v.id,
      projectId,
      metadata: {
        type: TASK_BOUND_VARIABLE_METADATA_TYPE,
        taskInstanceId: tid,
        dataPath: String(v.dataPath || ''),
        scopeFlowId: String(v.scopeFlowId || ''),
      },
    };
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
    const { taskInstance, taskLabel, dataSchema } = options;
    const projectId = this.projectKey(options.projectId);
    const flowScopeId = String(options.flowId ?? getActiveFlowCanvasId() ?? '').trim();

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
      taskLabel,
      normalizedLabel,
      dataSchemaLength: dataSchema.length,
    });

    dataSchema.forEach((node: any, mainIndex: number) => {
      const nodeId: string = String(node.id || node._id || node.templateId || '').trim();
      if (!nodeId) {
        console.warn('[VariableCreationService] ⚠️ Skipping node without id', { mainIndex, nodeKeys: Object.keys(node) });
        return;
      }

      variables.push({
        id: nodeId,
        varName: this.buildVarName(normalizedLabel, []),
        taskInstanceId: taskInstance.id,
        dataPath: `data[${mainIndex}]`,
        scope: 'flow',
        scopeFlowId: flowScopeId,
      });

      const subDataList: any[] = Array.isArray(node.subData) ? node.subData
        : Array.isArray(node.subNodes) ? node.subNodes
        : [];

      subDataList.forEach((sub: any, subIndex: number) => {
        const subNodeId: string = String(sub.id || sub._id || sub.templateId || '').trim();
        if (!subNodeId) {
          console.warn('[VariableCreationService] ⚠️ Skipping subData node without id', { mainIndex, subIndex, subKeys: Object.keys(sub) });
          return;
        }

        const subLabel: string = (sub.label || sub.name || `sub${subIndex}`)
          .toLowerCase()
          .trim();

        variables.push({
          id: subNodeId,
          varName: this.buildVarName(normalizedLabel, [subLabel]),
          taskInstanceId: taskInstance.id,
          dataPath: `data[${mainIndex}].subData[${subIndex}]`,
          scope: 'flow',
          scopeFlowId: flowScopeId,
        });
      });
    });

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
   * Replaces in-memory utterance variables for one flow row from flattened TaskTree roots.
   * VariableInstance.id always equals TaskTreeNode.id (GUID).
   */
  private replaceUtteranceVariablesForTaskInstanceFromRoots(
    projectId: string | null | undefined,
    flowId: string | null | undefined,
    taskInstanceId: string,
    taskRowLabel: string,
    roots: TaskTreeNode[] | null | undefined
  ): void {
    const pid = this.projectKey(projectId);
    const tid = String(taskInstanceId || '').trim();
    if (!tid) {
      return;
    }

    let fid = String(flowId ?? '').trim();
    if (!fid) {
      fid = String(getTaskInstanceIdToFlowIdMap().get(tid) ?? '').trim();
    }
    if (!fid) {
      fid = String(getActiveFlowCanvasId() || 'main').trim();
    }

    const rows = flattenUtteranceTaskTreeVariableRows(taskRowLabel, roots);
    const all = this.store.get(pid) ?? [];
    const nextForTask: VariableInstance[] = [];

    for (const r of rows) {
      nextForTask.push({
        id: r.id,
        varName: r.varName,
        taskInstanceId: tid,
        dataPath: r.dataPath,
        scope: 'flow',
        scopeFlowId: fid,
      });
    }

    const others = all.filter((v) => String(v.taskInstanceId || '').trim() !== tid);
    this.store.set(pid, [...others, ...nextForTask]);

    logTaskSubflowMove('hydrate:utteranceReplace', {
      projectId: pid,
      flowCanvasId: fid,
      taskInstanceId: tid,
      taskRowLabel,
      flattenedRowCount: rows.length,
      variableRows: nextForTask.map((v) => ({
        id: v.id,
        varName: v.varName,
        dataPath: v.dataPath,
        scopeFlowId: v.scopeFlowId,
      })),
    });
  }

  /**
   * Hydrates utterance variables from the editor TaskTree (one VariableInstance per node; id = node.id).
   * Not used from the variable menu.
   */
  hydrateVariablesFromTaskTree(
    projectId: string | null | undefined,
    flowCanvasId: string | null | undefined,
    taskRowId: string,
    taskTree: TaskTree,
    options?: { taskRowLabel?: string }
  ): void {
    const label = String(
      options?.taskRowLabel ??
        taskTree.labelKey ??
        taskTree.label ??
        'task'
    ).trim();
    const roots = getMainNodes(taskTree);
    this.replaceUtteranceVariablesForTaskInstanceFromRoots(
      projectId,
      flowCanvasId,
      taskRowId,
      label || 'task',
      roots
    );
  }

  /**
   * For every utterance-like row on all flow canvases, hydrates variables from TaskRepository trees.
   * Call when the workspace flow snapshot changes (e.g. DockManager canvas fingerprint).
   * Removes obsolete VariableInstance rows for utterance tasks (empty tree or removed from canvas).
   * Does not touch manual / non-utterance task-bound variables except pruning utterance tasks off-canvas.
   */
  hydrateVariablesFromFlow(
    projectId: string | null | undefined,
    flows: WorkspaceState['flows'] | null | undefined
  ): void {
    const pid = this.projectKey(projectId);
    if (isFallbackProjectBucket(pid)) {
      logVariableHydration('hydrateVariablesFromFlow:skip', { reason: 'fallback_project_bucket', pid });
      return;
    }
    if (!flows) {
      logVariableHydration('hydrateVariablesFromFlow:skip', { reason: 'no_flows', pid });
      return;
    }

    const storeBefore = (this.store.get(pid) ?? []).length;
    const hydratedTaskRows: { flowCanvasId: string; taskRowId: string; nodeCount: number }[] = [];

    /** Every task row id currently on an included canvas row (any flow). */
    const taskRowIdsOnCanvas = new Set<string>();
    for (const flowCanvasId of Object.keys(flows)) {
      const slice = flows[flowCanvasId];
      if (!slice?.nodes?.length) continue;
      for (const graphNode of slice.nodes || []) {
        const rows = (graphNode as { data?: { rows?: unknown[] } })?.data?.rows;
        if (!Array.isArray(rows)) continue;
        for (const row of rows) {
          if ((row as { included?: boolean }).included === false) continue;
          const taskId = String((row as { id?: string }).id || '').trim();
          if (taskId) taskRowIdsOnCanvas.add(taskId);
        }
      }
    }

    for (const flowCanvasId of Object.keys(flows)) {
      const slice = flows[flowCanvasId];
      if (!slice?.nodes?.length) continue;

      for (const graphNode of slice.nodes || []) {
        const rows = (graphNode as { data?: { rows?: unknown[] } })?.data?.rows;
        if (!Array.isArray(rows)) continue;
        for (const row of rows) {
          if ((row as { included?: boolean }).included === false) continue;
          const taskId = String((row as { id?: string }).id || '').trim();
          if (!taskId) continue;
          const task = taskRepository.getTask(taskId);
          if (!task) continue;
          const utteranceLike =
            isUtteranceInterpretationTask(task) || task.type === TaskType.ClassifyProblem;
          if (!utteranceLike) continue;
          const rowLabel = String(
            (row as { text?: string }).text ||
              (task as { label?: string }).label ||
              (task as { labelKey?: string }).labelKey ||
              ''
          ).trim();
          const tree = buildStandaloneTaskTreeView(task);
          if (!tree) {
            this.replaceUtteranceVariablesForTaskInstanceFromRoots(
              pid,
              flowCanvasId,
              taskId,
              rowLabel || 'task',
              []
            );
            hydratedTaskRows.push({
              flowCanvasId,
              taskRowId: taskId,
              nodeCount: 0,
            });
            continue;
          }
          const mains = getMainNodes(tree);
          this.hydrateVariablesFromTaskTree(pid, flowCanvasId, taskId, tree, {
            taskRowLabel: rowLabel || undefined,
          });
          hydratedTaskRows.push({
            flowCanvasId,
            taskRowId: taskId,
            nodeCount: mains.length,
          });
        }
      }
    }

    const all = this.store.get(pid) ?? [];
    const pruned = all.filter((v) => {
      const tid = String(v.taskInstanceId || '').trim();
      if (!tid) return true;
      if (taskRowIdsOnCanvas.has(tid)) return true;
      const t = taskRepository.getTask(tid);
      const utterLike =
        t && (isUtteranceInterpretationTask(t) || t.type === TaskType.ClassifyProblem);
      return !utterLike;
    });
    if (pruned.length !== all.length) {
      this.store.set(pid, pruned);
    }

    const storeAfter = (this.store.get(pid) ?? []).length;
    logVariableHydration('hydrateVariablesFromFlow:done', {
      projectId: pid,
      flowIdsInWorkspace: Object.keys(flows),
      utteranceRowsHydrated: hydratedTaskRows.length,
      hydratedTaskRows,
      variableStoreCountBefore: storeBefore,
      variableStoreCountAfter: storeAfter,
    });
    if (import.meta.env.DEV) {
      console.info('[Omnia][hydrateVariablesFromFlow]', {
        projectId: pid,
        utteranceTaskRowsHydrated: hydratedTaskRows.length,
        variableStoreCountAfter: storeAfter,
        hydratedTaskRows,
      });
    }

    if (typeof document !== 'undefined') {
      document.dispatchEvent(
        new CustomEvent('omnia:flowVariablesHydrated', {
          bubbles: true,
          detail: { projectId: pid, flowIds: Object.keys(flows) },
        })
      );
    }
  }

  /**
   * Remove all variables for a given row/instance from memory.
   * Changes are persisted on the next explicit project save.
   */
  deleteVariablesForInstance(projectId: string | null | undefined, taskInstanceId: string): void {
    const key = this.projectKey(projectId);
    const existing = this.store.get(key) ?? [];
    this.store.set(
      key,
      existing.filter(v => v.taskInstanceId !== taskInstanceId)
    );
  }

  /**
   * Removes specific variable rows for a task instance by variable id (GUID).
   */
  removeTaskVariableRowsForIds(
    projectId: string | null | undefined,
    taskInstanceId: string,
    ids: string[]
  ): number {
    const tid = String(taskInstanceId || '').trim();
    if (!tid || !ids.length) return 0;
    const remove = new Set(ids.map((id) => String(id || '').trim()).filter(Boolean));
    if (remove.size === 0) return 0;
    const key = this.projectKey(projectId);
    const existing = this.store.get(key) ?? [];
    let removed = 0;
    const next = existing.filter((v) => {
      if (String(v.taskInstanceId || '').trim() !== tid) return true;
      const vid = String(v.id || '').trim();
      if (!remove.has(vid)) return true;
      removed += 1;
      return false;
    });
    if (removed > 0) {
      this.store.set(key, next);
    }
    return removed;
  }

  /**
   * Create a manual variable (no task instance). Default scope is project (visible in all flows).
   * Use scope "flow" + scopeFlowId to bind to one flow canvas.
   */
  createManualVariable(
    projectId: string | null | undefined,
    varName: string,
    options?: EnsureManualVariableOptions
  ): VariableInstance {
    const key = this.projectKey(projectId);
    const scope: VariableScope = options?.scope ?? 'project';
    const scopeFlowId =
      scope === 'flow'
        ? String(options?.scopeFlowId ?? getActiveFlowCanvasId()).trim()
        : '';

    const trimmed = varName.trim();
    if (!trimmed) {
      throw new Error('[VariableCreationService] createManualVariable: varName must be non-empty');
    }

    const existing = this.store.get(key) ?? [];

    const existingVar = existing.find(
      v =>
        v.varName === trimmed &&
        sameVariableScopeBucket(v, scope, scope === 'flow' ? scopeFlowId : null)
    );
    if (existingVar) {
      return existingVar;
    }

    const newVariable: VariableInstance = {
      id: this.generateGuid(),
      varName: trimmed,
      taskInstanceId: '',
      dataPath: '',
      scope,
      scopeFlowId: scope === 'flow' ? scopeFlowId : undefined,
    };

    this.store.set(key, [...existing, newVariable]);
    return newVariable;
  }

  /**
   * Remove a variable by id only if it is not bound to a task instance (manual / flow-slot row).
   */
  removeVariableById(projectId: string | null | undefined, id: string): boolean {
    const key = this.projectKey(projectId);
    const existing = this.store.get(key) ?? [];
    const v = existing.find(x => x.id === id);
    if (!v || String(v.taskInstanceId ?? '').trim().length > 0) {
      return false;
    }
    this.store.set(
      key,
      existing.filter(x => x.id !== id)
    );
    return true;
  }

  /**
   * Renames any variable row by id (manual or task-bound). Preserves id.
   * @param options.userInitiatedRename When true, sets `subflowAutoRenameLocked` so automatic subflow parent renames skip this row.
   */
  renameVariableRowById(
    projectId: string | null | undefined,
    id: string,
    newVarName: string,
    options?: { userInitiatedRename?: boolean }
  ): boolean {
    const trimmed = newVarName.trim();
    if (!trimmed) return false;
    const key = this.projectKey(projectId);
    const existing = this.store.get(key) ?? [];
    const target = existing.find((x) => x.id === id);
    if (!target) return false;
    const sameTask = (a: VariableInstance, b: VariableInstance) =>
      String(a.taskInstanceId ?? '').trim() === String(b.taskInstanceId ?? '').trim();
    const dup = existing.some(
      (x) => x.id !== id && x.varName === trimmed && sameTask(x, target)
    );
    if (dup) return false;
    this.store.set(
      key,
      existing.map((x) => {
        if (x.id !== id) return x;
        const next: VariableInstance = { ...x, varName: trimmed };
        if (options?.userInitiatedRename === true) {
          next.subflowAutoRenameLocked = true;
        }
        return next;
      })
    );
    return true;
  }

  /**
   * Locks or clears automatic subflow parent rename for a variable row (tests / explicit UI).
   */
  setSubflowAutoRenameLocked(projectId: string | null | undefined, id: string, locked: boolean): boolean {
    const key = this.projectKey(projectId);
    const existing = this.store.get(key) ?? [];
    const target = existing.find((x) => x.id === id);
    if (!target) return false;
    this.store.set(
      key,
      existing.map((x) => {
        if (x.id !== id) return x;
        const next: VariableInstance = { ...x };
        if (locked) next.subflowAutoRenameLocked = true;
        else delete next.subflowAutoRenameLocked;
        return next;
      })
    );
    return true;
  }

  /**
   * Rename a manual/flow-only variable; task-bound rows cannot be renamed here.
   */
  renameVariableById(projectId: string | null | undefined, id: string, newName: string): boolean {
    const trimmed = newName.trim();
    if (!trimmed) return false;

    const key = this.projectKey(projectId);
    const existing = this.store.get(key) ?? [];
    const v = existing.find(x => x.id === id);
    if (!v || String(v.taskInstanceId ?? '').trim().length > 0) {
      return false;
    }

    const scope: VariableScope = v.scope ?? 'project';
    const bucketFlowId = scope === 'flow' ? String(v.scopeFlowId ?? '').trim() : null;

    const dup = existing.some(
      x =>
        x.id !== id &&
        x.varName === trimmed &&
        sameVariableScopeBucket(x, scope, bucketFlowId)
    );
    if (dup) return false;

    this.store.set(
      key,
      existing.map(x => (x.id === id ? { ...x, varName: trimmed } : x))
    );
    return true;
  }

  /**
   * Ensure a manual variable exists with the given GUID and label.
   * Useful when a condition needs a stable promised GUID before task materialization.
   */
  ensureManualVariableWithId(
    projectId: string | null | undefined,
    id: string,
    varName: string,
    options?: EnsureManualVariableOptions
  ): VariableInstance {
    const key = this.projectKey(projectId);
    const scope: VariableScope = options?.scope ?? 'project';
    const scopeFlowId =
      scope === 'flow'
        ? String(options?.scopeFlowId ?? getActiveFlowCanvasId()).trim()
        : '';

    const existing = this.store.get(key) ?? [];
    const normalizedName = varName.trim();

    const byId = existing.find(v => v.id === id);
    if (byId) {
      if (normalizedName && byId.varName !== normalizedName) {
        const updated = existing.map(v => (v.id === id ? { ...v, varName: normalizedName } : v));
        this.store.set(key, updated);
        return updated.find(v => v.id === id)!;
      }
      return byId;
    }

    const created: VariableInstance = {
      id,
      varName: normalizedName,
      taskInstanceId: '',
      dataPath: '',
      scope,
      scopeFlowId: scope === 'flow' ? scopeFlowId : undefined,
    };
    this.store.set(key, [...existing, created]);
    return created;
  }

  // ---------------------------------------------------------------------------
  // In-memory queries (synchronous — used by VariableMappingService at compile time)
  // ---------------------------------------------------------------------------

  /**
   * Find variable id (GUID) by exact varName (and optionally taskInstanceId).
   */
  getIdByVarName(
    projectId: string | null | undefined,
    varName: string,
    taskInstanceId?: string,
    flowCanvasId?: string
  ): string | null {
    const key = this.projectKey(projectId);
    const all = this.store.get(key) ?? [];
    if (taskInstanceId !== undefined) {
      const match = all.find(
        v => v.varName === varName && v.taskInstanceId === taskInstanceId
      );
      return match?.id ?? null;
    }
    const flowId = flowCanvasId ?? getActiveFlowCanvasId();
    const visible = all.filter(v => isVariableVisibleInFlow(v, flowId));
    const match = visible.find(v => v.varName === varName);
    return match?.id ?? null;
  }

  /**
   * Alias for callers that still ask by "node" id: task-bound variable id equals TaskTreeNode.id.
   */
  getIdByTaskNodeId(projectId: string | null | undefined, taskNodeId: string, taskInstanceId: string): string | null {
    const vars = this.store.get(this.projectKey(projectId)) ?? [];
    const match = vars.find(v => v.id === taskNodeId && v.taskInstanceId === taskInstanceId);
    return match?.id ?? null;
  }

  /**
   * Return all variables for a task instance.
   */
  getVariablesByTaskInstanceId(projectId: string | null | undefined, taskInstanceId: string): VariableInstance[] {
    return (this.store.get(this.projectKey(projectId)) ?? []).filter(v => v.taskInstanceId === taskInstanceId);
  }

  /**
   * Return all variable names visible on the given flow canvas (same rules as {@link getVariablesForFlowScope}).
   */
  getAllVarNames(projectId: string | null | undefined, flowCanvasId?: string): string[] {
    const instances = this.getVariablesForFlowScope(projectId, flowCanvasId);
    return [...new Set(instances.map((v) => v.varName).filter(Boolean))].sort();
  }

  /**
   * Variables visible when authoring conditions on a given flow canvas (globals + that flow only).
   * When `workspaceFlows` is passed (React FlowStore), visibility matches that graph so the scope stays
   * aligned when {@link FlowWorkspaceSnapshot} lags behind the store.
   */
  getVariablesForFlowScope(
    projectId: string | null | undefined,
    flowCanvasId?: string,
    workspaceFlows?: WorkspaceState['flows'] | null
  ): VariableInstance[] {
    const storeKey = this.projectKey(projectId);
    const flowId = flowCanvasId ?? getActiveFlowCanvasId();
    const flow = FlowWorkspaceSnapshot.getFlowById(flowId);
    const localTaskIds = new Set<string>();
    for (const node of flow?.nodes || []) {
      const rows = (node as any)?.data?.rows;
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        const taskId = String((row as any)?.id || '').trim();
        if (taskId) localTaskIds.add(taskId);
      }
    }

    const all = this.store.get(storeKey) ?? [];
    const filtered = all.filter((v) => isVariableVisibleInFlow(v, flowId, workspaceFlows ?? undefined));

    logVariableScope('getVariablesForFlowScope', {
      projectId: storeKey,
      flowId,
      snapshotHasFlow: !!flow,
      snapshotNodeCount: flow?.nodes?.length ?? 0,
      taskRowIdsOnCanvas: [...localTaskIds],
      storeRowCount: all.length,
      visibleRowCount: filtered.length,
      visibleVarNames: filtered.map((v) => v.varName),
      usedWorkspaceFlowsOverride: workspaceFlows != null,
    });

    return filtered;
  }

  /**
   * Exact varName match within variables visible for the flow canvas (collision checks for bindings).
   */
  findVariableInFlowScopeByExactName(
    projectId: string | null | undefined,
    flowCanvasId: string,
    varName: string
  ): VariableInstance | undefined {
    const trimmed = String(varName || '').trim();
    if (!trimmed) return undefined;
    return this.getVariablesForFlowScope(projectId, flowCanvasId).find((v) => v.varName === trimmed);
  }

  /**
   * @deprecated Prefer {@link getVariableLabel} with explicit `translations` map.
   * Resolves display label from the project translations registry (not from `varName` in memory).
   */
  getVarNameById(projectId: string | null | undefined, id: string): string | null {
    void this.projectKey(projectId);
    const label = getVariableLabel(String(id), getProjectTranslationsTable());
    return label || null;
  }

  /**
   * Return the total number of in-memory variables for a project.
   */
  getCount(projectId: string | null | undefined): number {
    return (this.store.get(this.projectKey(projectId)) ?? []).length;
  }

  /**
   * Return all variables for a project.
   * Used by compiler to build variable mapping.
   */
  getAllVariables(projectId: string | null | undefined): VariableInstance[] {
    return this.store.get(this.projectKey(projectId)) ?? [];
  }

  // ---------------------------------------------------------------------------
  // Persistence: explicit save / load (called by AppContent.tsx)
  // ---------------------------------------------------------------------------

  /**
   * Persist all in-memory variables for a project to the database.
   * Called only when the user explicitly saves the project.
   */
  async saveToDatabase(projectId: string | null | undefined): Promise<boolean> {
    const key = this.projectKey(projectId);
    if (isFallbackProjectBucket(key)) {
      console.warn('[VariableCreationService] saveToDatabase skipped: fallback bucket (no persisted project)', {
        bucket: key,
      });
      return false;
    }

    const variables = this.store.get(key) ?? [];

    console.log('[VariableCreationService] 💾 saveToDatabase called', {
      projectId: key,
      totalVariablesInStore: variables.length,
      willSkip: variables.length === 0,
      varNamesSample: variables.slice(0, 10).map((v) => ({
        varName: v.varName,
        id: v.id,
        scope: v.scope,
        scopeFlowId: v.scopeFlowId,
        taskInstanceId: v.taskInstanceId || '(empty)',
        dataPath: v.dataPath || '(empty)',
      })),
    });

    if (variables.length === 0) {
      console.log('[VariableCreationService] ⚠️ No variables to save');
      return true;
    }

    /** Flow-scoped rows are persisted only in FlowDocument.variables (PUT flow-document), not the global variables collection. */
    const variablesForGlobalTable = variables.filter((v) => {
      if (v.scope === 'flow' && String(v.scopeFlowId || '').trim()) {
        return false;
      }
      return true;
    });

    if (variablesForGlobalTable.length === 0) {
      console.log('[VariableCreationService] 💾 saveToDatabase: only flow-scoped variables (skipped global POST; in FlowDocument)');
      return true;
    }

    const manualVariables = variablesForGlobalTable.filter((v) => !v.taskInstanceId || v.taskInstanceId === '');
    const taskVariables = variablesForGlobalTable.filter((v) => v.taskInstanceId && v.taskInstanceId !== '');

    try {
      const variablesToSave = variablesForGlobalTable.map((v) => this.buildGuidCentricPersistPayload(v, key));

      let locale = 'pt';
      try {
        locale = String(localStorage.getItem('project.lang') || 'pt').trim() || 'pt';
      } catch {
        locale = 'pt';
      }

      console.log('[VariableCreationService] 📤 Sending variables to backend', {
        projectId: key,
        totalCount: variablesToSave.length,
        manualVariablesCount: manualVariables.length,
        taskVariablesCount: taskVariables.length,
      });

      const response = await fetch(`/api/projects/${key}/variables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variables: variablesToSave, locale }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[VariableCreationService] ❌ Failed to save variables', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          variablesCount: variablesToSave.length,
          manualVariablesCount: manualVariables.length,
        });
        return false;
      }

      const result = await response.json();
      console.log('[VariableCreationService] ✅ Variables saved to database', {
        projectId: key,
        totalCount: variablesToSave.length,
        inserted: result.insertedCount || 0,
        modified: result.modifiedCount || 0,
        manualVariablesSaved: manualVariables.length,
        taskVariablesSaved: taskVariables.length,
        manualVarNames: manualVariables.map(v => v.varName),
      });
      return true;
    } catch (error) {
      console.error('[VariableCreationService] ❌ Error saving variables', {
        error: error instanceof Error ? error.message : String(error),
        projectId: key,
        variablesCount: variables.length,
        manualVariablesCount: manualVariables.length,
      });
      return false;
    }
  }

  /**
   * Load variables for a project from the database into memory.
   * Called when a project is opened.
   */
  async loadFromDatabase(projectId: string | null | undefined): Promise<void> {
    const key = this.projectKey(projectId);
    if (isFallbackProjectBucket(key)) {
      console.warn('[VariableCreationService] loadFromDatabase skipped: fallback bucket (no server project)', {
        bucket: key,
      });
      this.store.set(key, []);
      return;
    }

    try {
      console.log('[VariableCreationService] 📥 Loading variables from database', { projectId: key });

      let locale = 'pt';
      try {
        locale = String(localStorage.getItem('project.lang') || 'pt').trim() || 'pt';
      } catch {
        locale = 'pt';
      }
      const response = await fetch(
        `/api/projects/${key}/variables?${new URLSearchParams({ locale }).toString()}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          console.log('[VariableCreationService] ⚠️ No variables found in database (404)');
          this.store.set(key, []);
          return;
        }
        console.warn('[VariableCreationService] Failed to load variables', {
          status: response.status,
          statusText: response.statusText,
        });
        return;
      }

      const rawRows: unknown[] = await response.json();

      console.log('[VariableCreationService] 📥 Variables received from database', {
        projectId: key,
        totalCountRaw: rawRows.length,
      });

      const byId = new Map<string, VariableInstance>();
      for (const row of rawRows) {
        const doc = row as VariableInstance & {
          metadata?: { type?: string };
          varId?: string;
          ddtPath?: string;
        };
        const rawId =
          typeof doc.id === 'string' && doc.id.trim()
            ? doc.id.trim()
            : typeof doc.varId === 'string'
              ? doc.varId.trim()
              : '';
        if (!rawId) {
          console.warn('[VariableCreationService] ⚠️ Skipping variable row without id', {
            projectId: key,
          });
          continue;
        }

        if (doc.metadata?.type === UTTERANCE_VARIABLE_METADATA_TYPE) {
          continue;
        }

        const reconstructed = reconstructVariableInstanceFromMinimalDoc(
          doc as Parameters<typeof reconstructVariableInstanceFromMinimalDoc>[0]
        );
        if (reconstructed) {
          if (byId.has(rawId)) {
            console.warn('[VariableCreationService] ⚠️ Duplicate id in DB response; keeping last row', {
              projectId: key,
              id: rawId,
            });
          }
          byId.set(rawId, normalizeVariableInstance({ ...reconstructed, id: rawId }));
          continue;
        }

        const legacy = doc as VariableInstance & { ddtPath?: string; varId?: string };
        byId.set(
          rawId,
          normalizeVariableInstance({
            ...doc,
            id: rawId,
            varName: typeof doc.varName === 'string' ? doc.varName.trim() : String(doc.varName ?? ''),
            taskInstanceId: doc.taskInstanceId ?? '',
            dataPath: legacy.dataPath ?? legacy.ddtPath ?? '',
            scope: doc.scope,
            scopeFlowId: doc.scopeFlowId,
          })
        );
      }
      let deduplicated = Array.from(byId.values());

      const taskFlowIndex = getTaskInstanceIdToFlowIdMap();
      deduplicated = deduplicated.map((v) => {
        const tid = String(v.taskInstanceId || '').trim();
        if (!tid) return v;
        if (String(v.scopeFlowId || '').trim()) return v;
        const inferred = taskFlowIndex.get(tid);
        if (!inferred) return v;
        return normalizeVariableInstance({
          ...v,
          id: v.id,
          scope: 'flow',
          scopeFlowId: inferred,
        });
      });

      this.store.set(key, deduplicated);

      const finalManualVariables = deduplicated.filter(v => !v.taskInstanceId || v.taskInstanceId === '');
      const finalTaskVariables = deduplicated.filter(v => v.taskInstanceId && v.taskInstanceId !== '');

      console.log('[VariableCreationService] ✅ Variables loaded from database', {
        projectId: key,
        totalCount: deduplicated.length,
        manualVariables: finalManualVariables.length,
        taskVariables: finalTaskVariables.length,
        duplicatesRemovedById: variables.length - deduplicated.length,
        manualVarNames: finalManualVariables.map(v => v.varName),
      });
    } catch (error) {
      console.warn('[VariableCreationService] ❌ Error loading variables', {
        error: error instanceof Error ? error.message : String(error),
        projectId: key,
      });
      this.store.set(key, []);
    }
  }

  /**
   * FlowDocument load: remove variables owned by this flow (scope or task rows in document), then merge document rows.
   */
  ingestVariablesFromFlowDocument(
    projectId: string | null | undefined,
    flowCanvasId: string,
    incoming: VariableInstance[],
    documentTasks: { id: string }[]
  ): void {
    const key = this.projectKey(projectId);
    const fid = String(flowCanvasId || '').trim();
    if (!fid) return;
    const taskIds = new Set(documentTasks.map((t) => String(t.id || '').trim()).filter(Boolean));
    const incomingIds = new Set(incoming.map((v) => String(v.id || '').trim()).filter(Boolean));
    const existing = this.store.get(key) ?? [];
    const kept = existing.filter((v) => {
      const id = String(v.id || '').trim();
      if (incomingIds.has(id)) return false;
      const tid = String(v.taskInstanceId || '').trim();
      if (tid && taskIds.has(tid)) return false;
      if (String(v.scopeFlowId || '').trim() === fid) return false;
      return true;
    });
    const normalized = incoming.map((v) =>
      normalizeVariableInstance({
        ...v,
        id: String(v.id || '').trim(),
        scope: v.scope ?? 'flow',
        scopeFlowId: v.scopeFlowId ?? fid,
      })
    );
    this.store.set(key, [...kept, ...normalized]);
  }
}

export const variableCreationService = new VariableCreationService();
