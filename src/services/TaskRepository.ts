import type { Task, TaskInstance, MaterializedStep } from '../types/taskTypes';
import { migrateLegacyIntentsOnTask, problemIntentsToSemanticValues } from '../utils/semanticValueClassificationBridge';
import { TaskType, TemplateSource } from '../types/taskTypes';
import { StepType } from '../types/stepTypes';
import { generateId } from '../utils/idGenerator';
import { getTemplateId } from '../utils/taskHelpers';
import { generateSafeGuid } from '@utils/idGenerator';
import { FEATURE_FLAGS } from '../config/featureFlags';
import { isAiAgentDebugEnabled, summarizeAgentTaskFields } from '../components/TaskEditor/EditorHost/editors/aiAgentEditor/aiAgentDebug';
import { inferTaskKind, isStandaloneMaterializedTaskRow } from '@utils/taskKind';
import { logContractPersist, summarizeSubTasksForDebug } from '@utils/contractPersistDebug';
import {
  resolveTaskInEditorScope as resolveTaskInEditorScopeFromUtil,
  resolveTemplateDefinitionTask as resolveTemplateDefinitionTaskFromUtil,
} from '@utils/taskScopedLookup';
import { isProjectTemplateDefinitionRowForTemplateEndpointOnly } from './project-save/projectBulkTaskRules';
import { syncSubflowInterfaceAfterAuthoringCanvasChange } from '@domain/taskSubflowMove/syncSubflowInterfaceOnAuthoringChange';
import { upsertFlowSlicesFromSubflowSync } from '@domain/taskSubflowMove/subflowSyncFlowsRef';
import {
  removeTaskIdFromFlowSlice,
  syncTaskAuthoringIntoFlowSlice,
} from '@domain/flowDocument/flowSliceDomainSync';

/**
 * TaskRepository: Primary repository for Task data
 *
 * Manages Task objects with direct database access via /api/projects/:pid/tasks endpoints.
 * All components use TaskRepository as the single source of truth.
 */
class TaskRepository {
  // Internal storage for Task objects
  private tasks = new Map<string, Task>();

  /**
   * Task ids removed from memory that must be deleted from Mongo on the next explicit project save.
   * Immediate HTTP DELETE is not used — aligns with TaskRepository update semantics (persist on save).
   */
  private pendingRemoteTaskDeletes = new Set<string>();

  /**
   * Get current project ID from localStorage or window
   */
  private getCurrentProjectId(): string | undefined {
    if (typeof window === 'undefined') return undefined;
    const stored = localStorage.getItem('currentProjectId');
    if (stored) return stored;
    // Fallback: try to get from window (if available)
    return (window as any).currentProjectId;
  }

  /**
   * Get Task by ID
   * If task is missing 'type' field, it's invalid and should be reloaded from database
   */
  getTask(taskId: string): Task | null {
    // Check internal storage first
    const cachedTask = this.tasks.get(taskId);
    if (cachedTask) {
      // ✅ CRITICAL: If task is missing 'type', it's invalid (loaded before type was added)
      if (cachedTask.type === undefined || cachedTask.type === null) {
        // Return null to force reload from database
        return null;
      }
      return cachedTask;
    }
    return null;
  }

  /**
   * Resolve the Task row for the Response Editor: root tab task or a subtask validated under `root.subTasks`.
   */
  resolveTaskInEditorScope(rootTaskId: string, nodeTaskId: string | null): Task | null {
    return resolveTaskInEditorScopeFromUtil(rootTaskId, nodeTaskId, (id) => this.getTask(id));
  }

  /**
   * Load the template-definition task by id (contracts) from the same project task store.
   */
  resolveTemplateDefinitionTask(templateId: string | null): Task | null {
    return resolveTemplateDefinitionTaskFromUtil(templateId, (id) => this.getTask(id));
  }

  /**
   * Create a new Task
   *
   * @param type - TaskType enum (obbligatorio) - Determina il comportamento del task
   * @param templateId - Template ID (null = standalone, GUID = referenzia un altro Task)
   * @param fields - Task fields (label, data, text, etc.)
   * @param taskId - Optional task ID (generates if not provided)
   * @param projectId - Optional project ID
   * @returns Task
   */
  createTask(type: TaskType, templateId: string | null = null, fields?: Partial<Task>, taskId?: string, projectId?: string): Task {
    const finalTaskId = taskId || generateId();
    const finalProjectId = projectId || this.getCurrentProjectId();

    // ✅ CRITICAL: type is REQUIRED - must be provided
    if (type === undefined || type === null) {
      throw new Error(`[TaskRepository] Cannot create task - type field is required`);
    }

    const subflowDefaults =
      type === TaskType.Subflow
        ? { subflowBindingsSchemaVersion: 1 as const, subflowBindings: [] as Task['subflowBindings'] }
        : {};
    const task: Task = {
      id: finalTaskId,
      type: type,                // ✅ Enum numerico (0-19) - REQUIRED - COMPORTAMENTO
      templateId: templateId,   // ✅ GUID reference to another Task (or null) - NOT related to type
      ...subflowDefaults,
      ...(fields || {}),          // ✅ Campi diretti (niente wrapper value)
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // ✅ Save to internal storage only (in-memory)
    // ✅ NO automatic database save - save only on explicit user action (project:save event)
    this.tasks.set(finalTaskId, task);
    this.pendingRemoteTaskDeletes.delete(finalTaskId);
    syncTaskAuthoringIntoFlowSlice(task);

    return task;
  }

  /**
   * Update Task
   */
  /**
   * Update Task with optional merge behavior
   *
   * @param taskId - Task ID
   * @param updates - Partial Task updates
   * @param projectId - Optional project ID
   * @param options - Update options (merge behavior)
   */
  updateTask(
    taskId: string,
    updates: Partial<Task>,
    projectId?: string,
    options?: { merge?: boolean; allowClearTemplateId?: boolean; skipSubflowInterfaceSync?: boolean }
  ): boolean {
    // Check internal storage first
    const existingTask = this.tasks.get(taskId);
    if (!existingTask) {
      return false;
    }

    if ((updates as any).intents !== undefined) {
      (updates as Partial<Task>).semanticValues = problemIntentsToSemanticValues(
        Array.isArray((updates as any).intents) ? (updates as any).intents : [],
        existingTask.semanticValues ?? null
      );
      delete (updates as any).intents;
    }

    // ✅ CRITICAL: Preserve type field - never allow it to be removed
    // ✅ CRITICAL: Rimuovi anche steps e data per gestirli separatamente con merge profondo
    const { type, templateId, steps, data, ...updatesWithoutTypeAndTemplateId } = updates;

    // ✅ If type is explicitly provided and different, update it
    // ✅ If type is not provided, preserve existing type
    const finalType = type !== undefined ? type : existingTask.type;

    // ✅ CRITICAL: Ensure type is always present
    if (finalType === undefined || finalType === null) {
      return false;
    }

    // ✅ CRITICAL: Protect templateId from accidental overwrite
    // ✅ Se updates.templateId === null E existingTask.templateId !== null, preservare quello esistente
    // ✅ allowClearTemplateId: explicit migration (e.g. wizard instance-first) may set templateId to null
    const finalTemplateId =
      templateId === undefined
        ? existingTask.templateId
        : templateId === null && existingTask.templateId !== null && !options?.allowClearTemplateId
          ? existingTask.templateId
          : templateId;


    // ✅ CRITICAL: Validate steps structure before merging
    if (updates.steps && typeof updates.steps === 'object') {
      const stepsKeys = Object.keys(updates.steps);
      const stepTypeKeys = ['start', 'noMatch', 'noInput', 'confirmation', 'notConfirmed', 'success'];
      const hasWrongStructure = stepsKeys.length === stepTypeKeys.length &&
        stepsKeys.every(key => stepTypeKeys.includes(key));

      // Structure validation (silent)
    }

    // ✅ CRITICAL: Merge behavior controlled by options.merge or feature flag
    // Default: use feature flag (DISABLE_MERGE_PROFONDO = true means NO merge)
    const shouldMerge = options?.merge ?? !FEATURE_FLAGS.DISABLE_MERGE_PROFONDO;

    let finalSteps = updates.steps;
    if (updates.steps && typeof updates.steps === 'object' && !Array.isArray(updates.steps) &&
        existingTask.steps && typeof existingTask.steps === 'object' && !Array.isArray(existingTask.steps)) {

      if (shouldMerge) {
        // ✅ Merge profondo: preserva tutti i nodeTemplateId esistenti e aggiorna solo quelli in updates
        finalSteps = {
          ...existingTask.steps,  // Base: tutti i nodeTemplateId esistenti
        };

        // ✅ Merge profondo per ogni nodeTemplateId: preserva tutti gli step esistenti e aggiorna solo quelli in updates
        for (const [nodeTemplateId, nodeSteps] of Object.entries(updates.steps)) {
          if (nodeSteps && typeof nodeSteps === 'object') {
            // ✅ CRITICAL: Se nodeSteps è un oggetto vuoto {}, significa che tutti gli step sono stati cancellati
            // In questo caso, sovrascriviamo completamente con {} invece di fare merge
            if (Object.keys(nodeSteps).length === 0) {
              // ✅ Oggetto vuoto = cancellazione esplicita di tutti gli step per questo nodeTemplateId
              finalSteps[nodeTemplateId] = {};
            } else {
              // ✅ Merge profondo: preserva tutti gli step esistenti (inclusi flag _disabled) e aggiorna solo quelli in updates
              if (!finalSteps[nodeTemplateId]) {
                finalSteps[nodeTemplateId] = {};
              }
              finalSteps[nodeTemplateId] = {
                ...finalSteps[nodeTemplateId],  // Base: tutti gli step esistenti (inclusi flag _disabled)
                ...nodeSteps                    // Override: aggiorna solo quelli specificati
              };
            }
          } else {
            finalSteps[nodeTemplateId] = nodeSteps;
          }
        }
      } else {
        // ✅ NO MERGE: Sovrascrivi completamente (nuovo comportamento semplificato)
        finalSteps = {
          ...existingTask.steps,  // Preserva altri nodeTemplateId
          ...updates.steps        // Sovrascrivi completamente quelli in updates
        };

        // ✅ Gestisci cancellazioni esplicite ({} = cancella tutti gli step)
        for (const [nodeTemplateId, nodeSteps] of Object.entries(updates.steps)) {
          if (nodeSteps && typeof nodeSteps === 'object' && Object.keys(nodeSteps).length === 0) {
            finalSteps[nodeTemplateId] = {}; // Cancellazione esplicita
          }
        }
      }
    }

    // ✅ CRITICAL: Se updates.data è presente, fa merge profondo dei node per preservare nlpProfile
    let finalData = updates.data;
    if (updates.data && Array.isArray(updates.data) && existingTask.data && Array.isArray(existingTask.data)) {
      // ✅ Merge profondo: per ogni node in updates.data, preserva nlpProfile e testNotes dal node esistente se non presente
      finalData = updates.data.map((updatedNode: any, index: number) => {
        const existingNode = existingTask.data.find((n: any) =>
          n.id === updatedNode.id || n.templateId === updatedNode.templateId
        ) || existingTask.data[index];

        if (existingNode) {
          // ✅ CRITICAL: Merge profondo di nlpProfile (preserva examples se presente in updatedNode)
          const mergedNlpProfile = updatedNode.nlpProfile
            ? {
                ...(existingNode.nlpProfile || {}), // Base dal node esistente
                ...updatedNode.nlpProfile            // Override con quello aggiornato (preserva examples)
              }
            : existingNode.nlpProfile; // Se updatedNode non ha nlpProfile, usa quello esistente

          // ✅ Merge profondo: preserva nlpProfile e testNotes se non presenti in updatedNode
          const mergedNode = {
            ...existingNode, // Base dal node esistente (preserva tutti i campi)
            ...updatedNode,  // Override con i campi aggiornati
            // ✅ CRITICAL: Usa mergedNlpProfile (preserva examples se presente in updatedNode)
            nlpProfile: mergedNlpProfile,
            // ✅ CRITICAL: Se updatedNode ha testNotes, preservalo; altrimenti usa quello esistente
            testNotes: updatedNode.testNotes || existingNode.testNotes
          };


          return mergedNode;
        }
        return updatedNode; // Nuovo node, usa così com'è
      });
    }

    // Update in internal storage (merge fields directly, no value wrapper)
    const updatedTask: Task = {
      ...existingTask,
      ...updatesWithoutTypeAndTemplateId,  // ✅ Spread senza type e templateId
      ...(finalSteps ? { steps: finalSteps } : {}), // ✅ Usa finalSteps se presente (merge profondo)
      ...(finalData ? { data: finalData } : {}), // ✅ Usa finalData se presente (merge profondo)
      type: finalType,  // ✅ Always preserve/update type - REQUIRED
      templateId: finalTemplateId,  // ✅ Protected templateId
      updatedAt: updates.updatedAt || new Date()
    };

    const prevAuthoringCanvas = String(existingTask.authoringFlowCanvasId ?? '').trim();
    const nextAuthoringCanvas = String(updatedTask.authoringFlowCanvasId ?? '').trim();

    // ✅ Update internal storage only (in-memory)
    // ✅ NO automatic database save - save only on explicit user action (project:save event)
    this.tasks.set(taskId, updatedTask);

    if (
      !options?.skipSubflowInterfaceSync &&
      finalType !== TaskType.Subflow &&
      prevAuthoringCanvas !== nextAuthoringCanvas &&
      nextAuthoringCanvas.startsWith('subflow_')
    ) {
      const pid = String(projectId || this.getCurrentProjectId() || '').trim();
      if (pid) {
        const res = syncSubflowInterfaceAfterAuthoringCanvasChange({
          projectId: pid,
          taskInstanceId: taskId,
          previousAuthoringCanvasId: prevAuthoringCanvas || undefined,
          nextAuthoringCanvasId: nextAuthoringCanvas || undefined,
          taskType: finalType,
        });
        if (res) {
          upsertFlowSlicesFromSubflowSync(res.flowsNext, [res.parentFlowId, res.childFlowId]);
        }
      }
    }

    syncTaskAuthoringIntoFlowSlice(updatedTask);

    return true;
  }

  /**
   * Delete Task from in-memory repository only.
   * MongoDB removal runs on the next successful `saveAllTasksToDatabase` (explicit project save).
   */
  async deleteTask(taskId: string, _projectId?: string): Promise<boolean> {
    const existing = this.tasks.get(taskId);
    const authoringFlow = existing ? String(existing.authoringFlowCanvasId ?? '').trim() : '';
    const deleted = this.tasks.delete(taskId);
    if (deleted) {
      this.pendingRemoteTaskDeletes.add(taskId);
      removeTaskIdFromFlowSlice(taskId, authoringFlow || undefined);
    }
    return deleted;
  }

  /**
   * Applies queued remote deletes after a successful bulk upsert (or when there is nothing to upsert).
   */
  private async flushPendingRemoteTaskDeletes(projectId: string): Promise<boolean> {
    if (this.pendingRemoteTaskDeletes.size === 0) {
      return true;
    }
    const ids = [...this.pendingRemoteTaskDeletes];
    let allOk = true;
    for (const taskId of ids) {
      try {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`,
          { method: 'DELETE' }
        );
        if (!response.ok) {
          console.error('[TaskRepository] flushPendingRemoteTaskDeletes failed', {
            projectId,
            taskId,
            status: response.status,
          });
          allOk = false;
        }
      } catch (err) {
        console.error('[TaskRepository] flushPendingRemoteTaskDeletes exception', { projectId, taskId, err });
        allOk = false;
      }
    }
    if (allOk) {
      this.pendingRemoteTaskDeletes.clear();
    }
    return allOk;
  }

  /**
   * Check if Task exists
   */
  hasTask(taskId: string): boolean {
    return this.tasks.has(taskId);
  }

  /**
   * Get all Tasks
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Load all Tasks from database
   *
   * @param projectId - Project ID to load tasks for
   * @returns True if loaded successfully
   */
  async loadAllTasksFromDatabase(projectId?: string): Promise<boolean> {
    const finalProjectId = projectId || this.getCurrentProjectId();

    try {
      if (!finalProjectId) {
        console.error('[TaskRepository] ❌ LOAD TASKS: No projectId', { projectId, finalProjectId });
        return false;
      }

      console.log('[TaskRepository] 🔍 LOAD TASKS - START', {
        projectId: finalProjectId,
        repositorySizeBefore: this.tasks.size,
        repositoryTaskIdsBefore: Array.from(this.tasks.keys()),
        timestamp: new Date().toISOString(),
      });

      const response = await fetch(`/api/projects/${finalProjectId}/tasks`);
      if (!response.ok) {
        console.error('[TaskRepository] ❌ LOAD TASKS: HTTP Error', {
          projectId: finalProjectId,
          status: response.status,
          statusText: response.statusText,
        });
        return false;
      }

      const data = await response.json();
      const items: Task[] = data.items || [];

      console.log('[TaskRepository] 🔍 LOAD TASKS - RAW RESPONSE', {
        projectId: finalProjectId,
        itemsCount: items.length,
        rawItems: items.map(item => ({
          id: item.id,
          idLength: item.id?.length,
          templateId: item.templateId,
          type: item.type || item.Type,
          hasSteps: !!(item.steps || item.value?.steps),
          isInstance: !!item.templateId,
          label: item.label || item.value?.label,
        })),
      });

      // Clear and populate internal storage
      const clearedCount = this.tasks.size;
      this.tasks.clear();
      this.pendingRemoteTaskDeletes.clear();
      console.log('[TaskRepository] 🔍 LOAD TASKS - CLEARED REPOSITORY', {
        projectId: finalProjectId,
        clearedCount,
        timestamp: new Date().toISOString(),
      });

      for (const item of items) {
        // ✅ Load task with fields directly (no value wrapper)
        const { id, templateId, createdAt, updatedAt, projectId: _projectId, value, type, Type, ...directFields } = item;
        const taskType = type !== undefined && type !== null ? type : (Type !== undefined && Type !== null ? Type : undefined);

        // Log rimosso: non essenziale per flusso motore

        // ✅ CRITICAL: type is REQUIRED - must be saved correctly in database
        if (taskType === undefined || taskType === null) {
          continue;
        }

        const task: Task = {
          id: item.id,
          type: taskType,                // ✅ Enum numerico (0-19) - REQUIRED
          ...(value || {}),  // ✅ Backward compatibility: flatten value if present
          ...directFields,   // ✅ Use direct fields (data, label, steps, ecc.)
          // ✅ CRITICAL: templateId deve essere impostato DOPO value e directFields
          // ✅ per evitare che venga sovrascritto da value.templateId o directFields.templateId
          templateId: item.templateId ?? null,
          createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined
        };

        // ✅ CLEANUP: Rimuovi constraints/examples vuoti (sono referenziati dal template, non salvati)
        // ✅ Se constraints/examples sono array vuoti, rimuovili (useranno quelli del template)
        if (task.constraints && Array.isArray(task.constraints) && task.constraints.length === 0) {
          delete task.constraints;
        }
        if (task.examples && Array.isArray(task.examples) && task.examples.length === 0) {
          delete task.examples;
        }

        // ✅ CRITICAL: Verifica e converte steps structure se necessario
        if (task.steps) {
          // ✅ Se è già un array, è corretto - nessuna azione necessaria
          if (Array.isArray(task.steps)) {
            // Struttura corretta, nessun warning
          } else if (typeof task.steps === 'object') {
            // ✅ Verifica se è la vecchia struttura (dictionary con stepType come chiavi)
            const stepsKeys = Object.keys(task.steps);
            const stepTypeKeys = [StepType.START, StepType.NO_MATCH, StepType.NO_INPUT, StepType.CONFIRMATION, StepType.NOT_CONFIRMED, StepType.SUCCESS, StepType.INTRODUCTION];
            const hasWrongStructure = stepsKeys.length === stepTypeKeys.length &&
              stepsKeys.every(key => stepTypeKeys.includes(key));

            if (hasWrongStructure) {
              // ✅ CONVERSIONE AUTOMATICA: Converti dictionary in array MaterializedStep[]
              // ⚠️ ATTENZIONE: Questa conversione è per la vecchia struttura (stepType come chiavi)
              // La nuova struttura (nodeTemplateId come chiavi) NON deve essere convertita!
              const stepsDict = task.steps as Record<string, any>;
              const materializedSteps: MaterializedStep[] = [];

              for (const [stepType, stepData] of Object.entries(stepsDict)) {
                if (stepData && typeof stepData === 'object') {
                  materializedSteps.push({
                    id: stepData.id || generateSafeGuid(),
                    templateStepId: stepData.templateStepId || undefined, // ✅ Solo se step derivato
                    escalations: stepData.escalations || []
                  });
                }
              }

              // ✅ Sostituisci steps con la struttura corretta
              task.steps = materializedSteps;
            } else {
              // ✅ NUOVA STRUTTURA: Dictionary con nodeTemplateId come chiavi
              // ✅ Preserva TUTTA la struttura, inclusi flag _disabled
              // Non fare nulla - la struttura è già corretta
              // Esempio: { "nodeTemplateId": { "start": { _disabled: true, escalations: [...] }, ... } }
            }
          }
        }

        migrateLegacyIntentsOnTask(task);
        this.tasks.set(task.id, task);

        if (inferTaskKind(task) === 'embedded' || (task.subTasks && task.subTasks.length > 0)) {
          logContractPersist('repoLoad', 'task hydrated from project DB into TaskRepository', {
            taskId: task.id,
            inferredKind: inferTaskKind(task),
            templateId: task.templateId ?? null,
            ...summarizeSubTasksForDebug(task.subTasks),
          });
        }
      }

      // ✅ LOG: LOAD TASKS FROM DATABASE TRACE
      console.log('[TaskRepository] 🔍 LOAD TASKS FROM DATABASE TRACE', {
        projectId: finalProjectId,
        totalTasks: items.length,
        taskIds: items.map(item => item.id),
        taskDetails: items.map(item => ({
          id: item.id,
          templateId: item.templateId,
          type: item.type || item.Type,
          isInstance: !!item.templateId,
          hasSteps: item.steps ? (Array.isArray(item.steps) ? item.steps.length > 0 : Object.keys(item.steps).length > 0) : false,
          label: item.label || item.value?.label,
        })),
        instancesCount: items.filter(item => item.templateId).length,
        templatesCount: items.filter(item => !item.templateId).length,
        timestamp: new Date().toISOString(),
      });

      // ✅ NEW: Verifica se task specifici sono presenti
      const loadedTaskIds = items.map(item => item.id);
      const tasksInMemory = Array.from(this.tasks.keys());

      // ✅ NEW: Verifica tutte le istanze (task con templateId)
      const allInstances = items.filter(item => item.templateId);

      console.log('[TaskRepository] 🔍 LOAD VERIFICATION - SUMMARY', {
        projectId: finalProjectId,
        loadedFromDb: items.length,
        storedInMemory: this.tasks.size,
        instancesCount: allInstances.length,
        allMatch: loadedTaskIds.length === tasksInMemory.length &&
                  loadedTaskIds.every(id => tasksInMemory.includes(id)),
      });

      // ✅ EXPANDED LOGS: Mostra tutti i dati completi
      console.log('[TaskRepository] 🔍 ALL LOADED TASK IDs (from database)', loadedTaskIds);
      console.log('[TaskRepository] 🔍 ALL TASK IDs (in memory)', tasksInMemory);
      console.log('[TaskRepository] 🔍 ALL INSTANCE IDs (tasks with templateId)', allInstances.map(item => item.id));

      // ✅ NEW: Dettagli completi per tutte le istanze
      console.log('[TaskRepository] 🔍 ALL INSTANCES DETAILS', allInstances.map(item => ({
        id: item.id,
        templateId: item.templateId,
        type: item.type || item.Type,
        label: item.label || item.value?.label,
        hasSteps: !!(item.steps || item.value?.steps),
      })));

      // ✅ CRITICAL: Log after loading with instance details
      const allInstancesInMemory = Array.from(this.tasks.values()).filter(t => t.templateId);
      console.log('[TaskRepository] 🔍 LOAD TASKS - AFTER PROCESSING', {
        projectId: finalProjectId,
        itemsLoaded: items.length,
        tasksInMemory: this.tasks.size,
        allTaskIds: Array.from(this.tasks.keys()),
        instancesCount: allInstancesInMemory.length,
        allInstances: allInstancesInMemory.map(t => ({
          id: t.id,
          idLength: t.id.length,
          templateId: t.templateId,
          type: t.type,
          label: t.label,
          hasSteps: t.steps ? Object.keys(t.steps).length > 0 : false,
        })),
        timestamp: new Date().toISOString(),
      });

      // Emit event to notify components that tasks have been loaded
      window.dispatchEvent(new CustomEvent('tasks:loaded', {
        detail: { projectId: finalProjectId, tasksCount: this.tasks.size }
      }));

      if (isAiAgentDebugEnabled()) {
        const aiAgents = Array.from(this.tasks.values()).filter((t) => t.type === TaskType.AIAgent);
        console.log(
          'TASK AFTER LOAD (AI Agent tasks)',
          aiAgents.map((t) => ({ id: t.id, ...summarizeAgentTaskFields(t) }))
        );
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Save all Tasks to database
   *
   * @param projectId - Project ID to save tasks for
   * @returns True if saved successfully
   */
  async saveAllTasksToDatabase(projectId?: string, tasksToSave?: Task[]): Promise<boolean> {
    try {
      const finalProjectId = projectId || this.getCurrentProjectId();
      if (!finalProjectId) {
        console.error('[TaskRepository] ❌ SAVE TASKS: No projectId', { projectId, finalProjectId });
        return false;
      }

      // ✅ ARCHITECTURAL FIX: Use provided tasksToSave if available, otherwise use all tasks in repository
      // This allows frontend to filter orphan tasks BEFORE saving to database
      let allTasks = tasksToSave || Array.from(this.tasks.values());

      // ✅ CRITICAL: Filter out templates with source: 'Factory' (they are saved in Factory database, not project)
      // Only templates with source: 'Project' or no source (backward compatibility) should be saved to project
      allTasks = allTasks.filter(task => {
        if (task.templateId) {
          return true;
        }
        if (task.templateId === null) {
          const source = (task as any).source;
          if (source === TemplateSource.Factory) {
            console.log('[TaskRepository] ⏭️ SKIPPING TEMPLATE: source is Factory', {
              taskId: task.id,
              source,
            });
            return false;
          }
          if (isProjectTemplateDefinitionRowForTemplateEndpointOnly(task)) {
            console.log('[TaskRepository] ⏭️ SKIPPING BULK: project template definition (POST /templates only)', {
              taskId: task.id,
            });
            return false;
          }
          return true;
        }
        return true;
      });

      if (allTasks.length === 0) {
        console.log('[TaskRepository] ✅ SAVE TASKS: No tasks to upsert (all filtered out); applying pending deletes');
        return await this.flushPendingRemoteTaskDeletes(finalProjectId);
      }

      // ✅ LOG: Tasks to save - BEFORE processing
      console.log('[TaskRepository] 🔍 TASKS TO SAVE - BEFORE PROCESSING', {
        projectId: finalProjectId,
        totalTasks: allTasks.length,
        taskIds: allTasks.map(t => t.id).slice(0, 30), // First 30 IDs
        taskDetails: allTasks.slice(0, 10).map(t => ({ // First 10 details
          id: t.id,
          type: t.type,
          templateId: t.templateId,
          isInstance: !!t.templateId,
          hasSteps: t.steps ? Object.keys(t.steps).length > 0 : false,
          stepsCount: t.steps ? Object.keys(t.steps).length : 0,
          label: t.label,
        })),
        instancesCount: allTasks.filter(t => t.templateId).length,
        templatesCount: allTasks.filter(t => !t.templateId).length,
      });

      // ✅ Prepare items for bulk save (fields directly, no value wrapper)
      const items = allTasks.map(task => {
        // ✅ CRITICAL: type is required - skip tasks without type
        if (task.type === undefined || task.type === null) {
          console.warn('[TaskRepository] ⚠️ SKIPPING TASK: Missing type', {
            taskId: task.id,
            taskLabel: task.label,
          });
          return null;
        }

        // ✅ CRITICAL: Extract all fields and REMOVE _id to prevent MongoDB immutable field error
        const { id, templateId, createdAt, updatedAt, _id, ...fields } = task as any;

        // ✅ Validate templateId: must be null or valid GUID (not semantic string)
        const finalTemplateId = templateId === null || templateId === undefined ? null : templateId;

        // ✅ Check if templateId is a semantic string (should be null or GUID)
        const itemToSave: Record<string, unknown> = {
          id: task.id,
          type: task.type,
          templateId: finalTemplateId,
          ...fields,
        };

        if (finalTemplateId !== null && typeof finalTemplateId === 'string') {
          const isSemanticString = ['SayMessage', 'Message', 'DataRequest', 'GetData', 'BackendCall', 'UNDEFINED'].includes(finalTemplateId);
          if (isSemanticString) {
            console.warn('[TaskRepository] ⚠️ CONVERTING SEMANTIC TEMPLATE ID TO NULL', {
              taskId: task.id,
              semanticTemplateId: finalTemplateId,
            });
            itemToSave.templateId = null;
          }
        }

        return itemToSave;
      }).filter(item => item !== null);

      for (const row of items) {
        if (inferTaskKind(row as Task) === 'embedded') {
          logContractPersist('bulkSave', 'row in bulk payload (POST /tasks/bulk)', {
            taskId: row.id,
            templateId: row.templateId ?? null,
            ...summarizeSubTasksForDebug(row.subTasks),
            payloadFieldKeys: Object.keys(row as Record<string, unknown>).filter(k => k !== 'steps'),
          });
        }
      }

      // ✅ LOG: Items prepared for save
      console.log('[TaskRepository] 🔍 ITEMS PREPARED FOR SAVE', {
        projectId: finalProjectId,
        itemsCount: items.length,
        skippedCount: allTasks.length - items.length,
        itemIds: items.map(i => i.id).slice(0, 30), // First 30 IDs
        itemDetails: items.slice(0, 10).map(i => ({ // First 10 details
          id: i.id,
          type: i.type,
          templateId: i.templateId,
          isInstance: !!i.templateId,
        })),
      });

      // ✅ NEW: Log specifico per istanze
      const instancesInPayload = items.filter(i => i.templateId);
      console.log('[TaskRepository] 🔍 INSTANCES IN PAYLOAD', {
        projectId: finalProjectId,
        instancesCount: instancesInPayload.length,
        allInstances: instancesInPayload.map(i => ({
          id: i.id,
          templateId: i.templateId,
          type: i.type,
          hasSteps: i.steps ? Object.keys(i.steps).length > 0 : false,
        })),
      });

      // ✅ CRITICAL: Log the exact payload being sent
      console.log('[TaskRepository] 🔍 PAYLOAD BEING SENT TO BACKEND', {
        projectId: finalProjectId,
        itemsCount: items.length,
        payloadPreview: JSON.stringify({ items: items.slice(0, 2) }, null, 2).substring(0, 1000), // First 2 items, first 1000 chars
      });

      const response = await fetch(`/api/projects/${finalProjectId}/tasks/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });

      if (!response.ok) {
        // ✅ LOG: Error response details
        let errorText = '';
        try {
          errorText = await response.text();
        } catch (e) {
          errorText = 'Unable to read error response';
        }

        console.error('[TaskRepository] ❌ SAVE TASKS FAILED - Backend Error', {
          projectId: finalProjectId,
          status: response.status,
          statusText: response.statusText,
          errorText: errorText.substring(0, 1000), // First 1000 chars
          itemsCount: items.length,
          itemsIds: items.map(i => i.id).slice(0, 20), // First 20 IDs for debugging
          itemsDetails: items.slice(0, 5).map(i => ({ // First 5 details
            id: i.id,
            type: i.type,
            templateId: i.templateId,
            hasSteps: i.steps ? Object.keys(i.steps).length > 0 : false,
          })),
        });
        return false;
      }

      const result = await response.json().catch(() => ({}));

      // ✅ LOG: SAVE TASKS SUCCESS
      console.log('[TaskRepository] ✅ SAVE TASKS SUCCESS', {
        projectId: finalProjectId,
        itemsCount: items.length,
        itemsIds: items.map(i => i.id).slice(0, 30), // First 30 IDs
        itemsDetails: items.map(i => ({
          id: i.id,
          templateId: i.templateId,
          type: i.type,
          isInstance: !!i.templateId,
        })),
        result: result,
        inserted: result.inserted || 0,
        updated: result.updated || 0,
        timestamp: new Date().toISOString(),
      });

      // ✅ NEW: Log specifico per istanze salvate
      const instancesSaved = items.filter(i => i.templateId);
      console.log('[TaskRepository] 🔍 INSTANCES SAVED SUMMARY', {
        projectId: finalProjectId,
        instancesInPayload: instancesSaved.length,
        instancesDetails: instancesSaved.map(i => ({
          id: i.id,
          templateId: i.templateId,
          type: i.type,
        })),
        inserted: result.inserted || 0,
        updated: result.updated || 0,
      });

      // ✅ CRITICAL: Verify what was actually saved by querying the database
      if (result.inserted > 0 || result.updated > 0) {
        console.log('[TaskRepository] 🔍 VERIFYING SAVED TASKS', {
          projectId: finalProjectId,
          inserted: result.inserted,
          updated: result.updated,
          savedItemIds: items.map(i => i.id),
        });

        // ✅ CRITICAL: Query database to verify tasks were actually saved
        try {
          const verifyResponse = await fetch(`/api/projects/${finalProjectId}/tasks`);
          if (verifyResponse.ok) {
            const verifyData = await verifyResponse.json();
            const verifyItems = verifyData.items || [];
            console.log('[TaskRepository] 🔍 DATABASE VERIFICATION AFTER SAVE', {
              projectId: finalProjectId,
              expectedCount: items.length,
              actualCount: verifyItems.length,
              expectedIds: items.map(i => i.id),
              actualIds: verifyItems.map((i: any) => i.id),
              missingIds: items.map(i => i.id).filter(id => !verifyItems.some((v: any) => v.id === id)),
              foundIds: items.map(i => i.id).filter(id => verifyItems.some((v: any) => v.id === id)),
              allSavedItems: verifyItems.map((i: any) => ({
                id: i.id,
                templateId: i.templateId,
                type: i.type,
                isInstance: !!i.templateId,
                hasSteps: !!(i.steps || i.value?.steps),
              })),
            });

            // ✅ NEW: Verifica specifica per istanze
            const expectedInstances = items.filter(i => i.templateId);
            const actualInstances = verifyItems.filter((i: any) => i.templateId);
            console.log('[TaskRepository] 🔍 INSTANCES VERIFICATION', {
              projectId: finalProjectId,
              expectedInstancesCount: expectedInstances.length,
              actualInstancesCount: actualInstances.length,
              expectedInstanceIds: expectedInstances.map(i => i.id),
              actualInstanceIds: actualInstances.map((i: any) => i.id),
              missingInstanceIds: expectedInstances
                .map(i => i.id)
                .filter(id => !actualInstances.some((v: any) => v.id === id)),
              foundInstanceIds: expectedInstances
                .map(i => i.id)
                .filter(id => actualInstances.some((v: any) => v.id === id)),
              allActualInstances: actualInstances.map((i: any) => ({
                id: i.id,
                templateId: i.templateId,
                type: i.type,
                hasSteps: !!(i.steps || i.value?.steps),
              })),
            });
          } else {
            console.error('[TaskRepository] ❌ VERIFICATION REQUEST FAILED', {
              projectId: finalProjectId,
              status: verifyResponse.status,
              statusText: verifyResponse.statusText,
            });
          }
        } catch (verifyError) {
          console.error('[TaskRepository] ❌ VERIFICATION ERROR', {
            projectId: finalProjectId,
            error: verifyError instanceof Error ? verifyError.message : String(verifyError),
          });
        }
      }

      const flushed = await this.flushPendingRemoteTaskDeletes(finalProjectId);
      if (!flushed) {
        console.error('[TaskRepository] ❌ SAVE TASKS: bulk OK but pending task deletes failed', {
          projectId: finalProjectId,
        });
        return false;
      }
      return true;
    } catch (error) {
      console.error('[TaskRepository] ❌ SAVE TASKS ERROR - Exception', {
        projectId: projectId || 'unknown',
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
      });
      return false;
    }
  }

  /**
   * Save a single Task to database
   * Uses POST with upsert support (backend handles create/update automatically)
   */
  private async saveTaskToDatabase(task: Task, projectId: string): Promise<boolean> {
    try {
      // ✅ CRITICAL: type is required - cannot save task without type
      if (task.type === undefined || task.type === null) {
        return false;
      }

      // ✅ Extract all fields except id, _id (MongoDB immutable), templateId, createdAt, updatedAt
      const { id, _id, templateId, createdAt, updatedAt, ...fields } = task;

      const isNarrowInstance =
        task.templateId !== null &&
        task.templateId !== undefined &&
        !isStandaloneMaterializedTaskRow(task);

      let payload;
      if (isNarrowInstance) {
        payload = {
          id: task.id,
          type: task.type,
          templateId: task.templateId,
          templateVersion: task.templateVersion || 1,
          labelKey: task.labelKey,
          steps: task.steps,
        };
      } else {
        payload = {
          id: task.id,
          type: task.type,
          templateId: task.templateId ?? null,
          ...fields,
        };
      }

      // ✅ CRITICAL: Log steps structure only if wrong (reduce noise)
      if (payload.steps) {
        const stepsKeys = Object.keys(payload.steps);
        const stepTypeKeys = [StepType.START, StepType.NO_MATCH, StepType.NO_INPUT, StepType.CONFIRMATION, StepType.NOT_CONFIRMED, StepType.SUCCESS];
        const hasWrongStructure = stepsKeys.length === stepTypeKeys.length &&
          stepsKeys.every(key => stepTypeKeys.includes(key));

        // Structure validation (silent)
        // ❌ RIMOSSO: log normale (troppo verboso)
      }

      // ✅ Validate payload before stringifying
      try {
        // Check for circular references in steps
        if (payload.steps) {
          const stepsString = JSON.stringify(payload.steps);
          if (stepsString.length > 10 * 1024 * 1024) { // 10MB limit
            // Remove steps if too large (should not happen, but safety check)
            delete payload.steps;
          }
        }
      } catch (e) {
        // Remove steps if circular reference or other error
        if (payload.steps) {
          delete payload.steps;
        }
      }

      const payloadString = JSON.stringify(payload);

      const response = await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payloadString
      });

      if (!response.ok) {
        return false;
      }

      // ✅ LOG: SAVE TASK TO DATABASE TRACE
      console.log('[TaskRepository] 🔍 SAVE TASK TO DATABASE TRACE', {
        taskId: task.id,
        instanceId: task.id, // Dovrebbe essere uguale a row.id
        templateId: task.templateId,
        isInstance: !!task.templateId, // Se ha templateId, è un'istanza
        projectId,
        hasSteps: task.steps ? Object.keys(task.steps).length > 0 : false,
        stepsKeys: task.steps ? Object.keys(task.steps) : [],
        taskType: task.type,
        taskLabel: task.label,
        payloadKeys: Object.keys(payload),
        timestamp: new Date().toISOString(),
      });

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get internal tasks count (for debugging)
   */
  getInternalTasksCount(): number {
    return this.tasks.size;
  }

  /**
   * FlowDocument load: upsert tasks that belong to this flow canvas into the in-memory store.
   */
  ingestTasksFromFlowDocument(flowCanvasId: string, tasks: Task[]): void {
    const fid = String(flowCanvasId || '').trim();
    if (!fid) return;
    for (const t of tasks) {
      const merged: Task = {
        ...t,
        authoringFlowCanvasId: fid,
      };
      this.tasks.set(t.id, merged);
      this.pendingRemoteTaskDeletes.delete(t.id);
    }
  }
}

// Export singleton instance
export const taskRepository = new TaskRepository();
