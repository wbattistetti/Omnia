import type { Task, TaskInstance, MaterializedStep } from '../types/taskTypes';
import { TaskType } from '../types/taskTypes';
import { generateId } from '../utils/idGenerator';
import { getTemplateId } from '../utils/taskHelpers';
import { v4 as uuidv4 } from 'uuid';

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
        console.warn(`[TaskRepository] Task ${taskId} in memory is missing 'type' field - this task needs to be reloaded from database`);
        // Return null to force reload from database
        return null;
      }
      return cachedTask;
    }
    return null;
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

    const task: Task = {
      id: finalTaskId,
      type: type,                // ✅ Enum numerico (0-19) - REQUIRED - COMPORTAMENTO
      templateId: templateId,   // ✅ GUID reference to another Task (or null) - NOT related to type
      ...(fields || {}),          // ✅ Campi diretti (niente wrapper value)
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // ✅ LOG: Verifica templateId dopo creazione
    console.log('[🔍 TaskRepository][CREATE] ✅ Task creato', {
      taskId: finalTaskId,
      templateId: task.templateId,
      templateIdFromParam: templateId,
      fieldsTemplateId: fields?.templateId,
      finalTemplateId: task.templateId,
      fieldsKeys: fields ? Object.keys(fields) : []
    });

    // ✅ Save to internal storage only (in-memory)
    // ✅ NO automatic database save - save only on explicit user action (project:save event)
    this.tasks.set(finalTaskId, task);

    return task;
  }

  /**
   * Update Task
   */
  updateTask(taskId: string, updates: Partial<Task>, projectId?: string): boolean {
    // Check internal storage first
    const existingTask = this.tasks.get(taskId);
    if (!existingTask) {
      console.warn('[TaskRepository] Task not found:', taskId);
      return false;
    }

    // ✅ CRITICAL: Preserve type field - never allow it to be removed
    const { type, templateId, ...updatesWithoutTypeAndTemplateId } = updates;

    // ✅ If type is explicitly provided and different, update it
    // ✅ If type is not provided, preserve existing type
    const finalType = type !== undefined ? type : existingTask.type;

    // ✅ CRITICAL: Ensure type is always present
    if (finalType === undefined || finalType === null) {
      console.error(`[TaskRepository] Cannot update task ${taskId} - type field is missing. This task is invalid.`);
      return false;
    }

    // ✅ CRITICAL: Protect templateId from accidental overwrite
    // ✅ Se updates.templateId === null E existingTask.templateId !== null, preservare quello esistente
    // ✅ Altrimenti, usare quello passato negli updates (anche se null, se è un cambio esplicito)
    const finalTemplateId = (templateId === null && existingTask.templateId !== null)
      ? existingTask.templateId  // ✅ Preserva templateId esistente se viene passato null per errore
      : (templateId !== undefined ? templateId : existingTask.templateId);  // ✅ Usa quello passato o preserva


    // ✅ CRITICAL: Validate steps structure before merging
    if (updates.steps && typeof updates.steps === 'object') {
      const stepsKeys = Object.keys(updates.steps);
      const stepTypeKeys = ['start', 'noMatch', 'noInput', 'confirmation', 'notConfirmed', 'success'];
      const hasWrongStructure = stepsKeys.length === stepTypeKeys.length &&
        stepsKeys.every(key => stepTypeKeys.includes(key));

      if (hasWrongStructure) {
        const stackTrace = new Error().stack?.split('\n').slice(1, 6).join('\n') || 'No stack trace';
        console.error('[🔍 TaskRepository][UPDATE] ❌ CRITICAL: Wrong steps structure detected!', {
          taskId,
          stepsKeys,
          stepsKeysAsStrings: stepsKeys.join(', '),
          expectedStructure: 'Object with templateId keys (e.g., { "templateId": { start: {...}, ... } })',
          actualStructure: 'Object with step type keys (e.g., { "start": {...}, "noMatch": {...} })',
          caller: stackTrace
        });
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

          // ✅ DEBUG: Log del merge per verificare che examples sia preservato
          if (mergedNode.nlpProfile?.examples) {
            console.log('[TaskRepository] updateTask - Deep merge preserved nlpProfile.examples', {
              taskId,
              nodeId: mergedNode.id,
              nodeTemplateId: mergedNode.templateId,
              updatedNodeHasNlpProfile: !!updatedNode.nlpProfile,
              updatedNodeHasExamples: !!updatedNode.nlpProfile?.examples,
              updatedNodeExamplesCount: updatedNode.nlpProfile?.examples?.length || 0,
              existingNodeHasNlpProfile: !!existingNode.nlpProfile,
              existingNodeHasExamples: !!existingNode.nlpProfile?.examples,
              existingNodeExamplesCount: existingNode.nlpProfile?.examples?.length || 0,
              mergedNodeHasExamples: !!mergedNode.nlpProfile?.examples,
              mergedNodeExamplesCount: mergedNode.nlpProfile.examples.length
            });
          }

          return mergedNode;
        }
        return updatedNode; // Nuovo node, usa così com'è
      });
    }

    // Update in internal storage (merge fields directly, no value wrapper)
    const updatedTask: Task = {
      ...existingTask,
      ...updatesWithoutTypeAndTemplateId,  // ✅ Spread senza type e templateId
      ...(finalData ? { data: finalData } : {}), // ✅ Usa finalData se presente (merge profondo)
      type: finalType,  // ✅ Always preserve/update type - REQUIRED
      templateId: finalTemplateId,  // ✅ Protected templateId
      updatedAt: updates.updatedAt || new Date()
    };


    // ✅ Update internal storage only (in-memory)
    // ✅ NO automatic database save - save only on explicit user action (project:save event)
    this.tasks.set(taskId, updatedTask);

    // ✅ DEBUG: Verifica che data[0].nlpProfile.examples sia presente dopo l'aggiornamento
    if (updatedTask.data?.[0]?.nlpProfile?.examples) {
      console.log('[TaskRepository] updateTask - Cache updated with examples', {
        taskId,
        examplesCount: updatedTask.data[0].nlpProfile.examples.length,
        examples: updatedTask.data[0].nlpProfile.examples.slice(0, 3)
      });
    }

    return true;
  }

  /**
   * Delete Task
   */
  async deleteTask(taskId: string, projectId?: string): Promise<boolean> {
    // Remove from internal storage
    const deleted = this.tasks.delete(taskId);

    // Delete from database if projectId is available
    const finalProjectId = projectId || this.getCurrentProjectId();
    if (finalProjectId) {
      try {
        const response = await fetch(`/api/projects/${finalProjectId}/tasks/${taskId}`, {
          method: 'DELETE'
        });
        if (!response.ok) {
          console.error('[TaskRepository] Failed to delete task from database');
          return false;
        }
      } catch (err) {
        console.error('[TaskRepository] Error deleting task from database:', err);
        return false;
      }
    }

    return deleted;
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
        console.warn('[📥 LOAD_TASKS] No project ID available');
        return false;
      }

      const response = await fetch(`/api/projects/${finalProjectId}/tasks`);
      if (!response.ok) {
        console.error('[📥 LOAD_TASKS] Failed to fetch', { projectId: finalProjectId, status: response.status });
        return false;
      }

      const data = await response.json();
      const items: Task[] = data.items || [];

      // Clear and populate internal storage
      this.tasks.clear();
      for (const item of items) {
        // ✅ Load task with fields directly (no value wrapper)
        const { id, templateId, createdAt, updatedAt, projectId: _projectId, value, type, Type, ...directFields } = item;
        const taskType = type !== undefined && type !== null ? type : (Type !== undefined && Type !== null ? Type : undefined);

        // ✅ LOG: Verifica templateId dal database
        console.log('[🔍 TaskRepository][LOAD] 📥 Task caricato dal database', {
          taskId: id,
          itemTemplateId: item.templateId,
          extractedTemplateId: templateId,
          valueTemplateId: value?.templateId,
          directFieldsTemplateId: directFields.templateId,
          valueKeys: value ? Object.keys(value) : [],
          directFieldsKeys: Object.keys(directFields),
          itemKeys: Object.keys(item)
        });

        // ✅ CRITICAL: type is REQUIRED - must be saved correctly in database
        if (taskType === undefined || taskType === null) {
          console.error('[TaskRepository] Task without type - SKIPPED', {
            taskId: id,
            availableFields: Object.keys(item)
          });
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

        // ✅ DEBUG: Log nlpProfile.examples quando carichi dal database
        const firstNodeNlpProfileExamples = task.data?.[0]?.nlpProfile?.examples;
        if (firstNodeNlpProfileExamples || task.data?.[0]?.nlpProfile) {
          console.log('[EXAMPLES] LOAD - From database', {
            taskId: task.id,
            hasData: !!task.data,
            dataLength: task.data?.length || 0,
            firstNodeId: task.data?.[0]?.id,
            hasFirstNodeNlpProfile: !!task.data?.[0]?.nlpProfile,
            firstNodeNlpProfileKeys: task.data?.[0]?.nlpProfile ? Object.keys(task.data[0].nlpProfile) : [],
            hasFirstNodeNlpProfileExamples: !!firstNodeNlpProfileExamples,
            firstNodeNlpProfileExamplesCount: Array.isArray(firstNodeNlpProfileExamples) ? firstNodeNlpProfileExamples.length : 0,
            firstNodeNlpProfileExamples: firstNodeNlpProfileExamples?.slice(0, 3)
          });
        }

        // ✅ LOG: Verifica templateId dopo il merge
        console.log('[🔍 TaskRepository][LOAD] ✅ Task dopo merge', {
          taskId: task.id,
          finalTemplateId: task.templateId,
          itemTemplateId: item.templateId,
          valueHadTemplateId: value?.templateId !== undefined,
          directFieldsHadTemplateId: directFields.templateId !== undefined,
          valueTemplateIdValue: value?.templateId,
          directFieldsTemplateIdValue: directFields.templateId
        });

        // ✅ LOG: Check dataContract in loaded task
        if (task.data && Array.isArray(task.data) && task.data.length > 0) {
          const firstNode = task.data[0];
          const regexPattern = firstNode.dataContract?.contracts?.find((c: any) => c.type === 'regex')?.patterns?.[0];
          console.log('[REGEX] LOAD - From database', {
            taskId: task.id,
            firstNodeId: firstNode.id,
            regexPattern: regexPattern || '(none)'
          });
        }

        // ✅ CLEANUP: Rimuovi constraints/examples vuoti (sono referenziati dal template, non salvati)
        // ✅ Se constraints/examples sono array vuoti, rimuovili (useranno quelli del template)
        if (task.constraints && Array.isArray(task.constraints) && task.constraints.length === 0) {
          delete task.constraints;
          console.log('[🔍 TaskRepository][LOAD] ✅ Cleanup: rimosso constraints vuoto (userà template)', {
            taskId: task.id,
            taskLabel: task.label
          });
        }
        if (task.examples && Array.isArray(task.examples) && task.examples.length === 0) {
          delete task.examples;
          console.log('[🔍 TaskRepository][LOAD] ✅ Cleanup: rimosso examples vuoto (userà template)', {
            taskId: task.id,
            taskLabel: task.label
          });
        }

        // ✅ CRITICAL: Verifica e converte steps structure se necessario
        if (task.steps) {
          // ✅ Se è già un array, è corretto - nessuna azione necessaria
          if (Array.isArray(task.steps)) {
            // Struttura corretta, nessun warning
          } else if (typeof task.steps === 'object') {
            // ✅ Verifica se è la vecchia struttura (dictionary)
            const stepsKeys = Object.keys(task.steps);
            const stepTypeKeys = ['start', 'noMatch', 'noInput', 'confirmation', 'notConfirmed', 'success', 'introduction'];
            const hasWrongStructure = stepsKeys.length === stepTypeKeys.length &&
              stepsKeys.every(key => stepTypeKeys.includes(key));

            if (hasWrongStructure) {
              console.warn('[🔍 TaskRepository][LOAD] ⚠️ Wrong steps structure detected - converting automatically', {
                taskId: task.id,
                oldStepsKeys: stepsKeys
              });

              // ✅ CONVERSIONE AUTOMATICA: Converti dictionary in array MaterializedStep[]
              const stepsDict = task.steps as Record<string, any>;
              const materializedSteps: MaterializedStep[] = [];

              for (const [stepType, stepData] of Object.entries(stepsDict)) {
                if (stepData && typeof stepData === 'object') {
                  materializedSteps.push({
                    id: stepData.id || uuidv4(),
                    templateStepId: stepData.templateStepId || undefined, // ✅ Solo se step derivato
                    escalations: stepData.escalations || []
                  });
                }
              }

              // ✅ Sostituisci steps con la struttura corretta
              task.steps = materializedSteps;

              console.log('[🔍 TaskRepository][LOAD] ✅ Steps converted to array', {
                taskId: task.id,
                newStepsCount: materializedSteps.length
              });
            }
          }
        }

        this.tasks.set(task.id, task);
      }

      // Emit event to notify components that tasks have been loaded
      window.dispatchEvent(new CustomEvent('tasks:loaded', {
        detail: { projectId: finalProjectId, tasksCount: this.tasks.size }
      }));
      return true;
    } catch (error) {
      console.error('[TaskRepository] Error loading tasks', {
        projectId: finalProjectId,
        error: error instanceof Error ? error.message : error
      });
      return false;
    }
  }

  /**
   * Save all Tasks to database
   *
   * @param projectId - Project ID to save tasks for
   * @returns True if saved successfully
   */
  async saveAllTasksToDatabase(projectId?: string): Promise<boolean> {
    try {
      const finalProjectId = projectId || this.getCurrentProjectId();
      if (!finalProjectId) {
        console.warn('[TaskRepository] No project ID available for saving tasks');
        return false;
      }

      const allTasks = Array.from(this.tasks.values());
      if (allTasks.length === 0) {
        return true; // Nothing to save
      }

      // ✅ Prepare items for bulk save (fields directly, no value wrapper)
      const items = allTasks.map(task => {
        // ✅ CRITICAL: type is required - skip tasks without type
        if (task.type === undefined || task.type === null) {
          console.error('[💾 SAVE_ALL] Task without type - SKIPPED', { taskId: task.id });
          return null;
        }

        // ✅ CRITICAL: Extract all fields and REMOVE _id to prevent MongoDB immutable field error
        const { id, templateId, createdAt, updatedAt, _id, ...fields } = task as any;

        // ✅ Validate templateId: must be null or valid GUID (not semantic string)
        const finalTemplateId = templateId === null || templateId === undefined ? null : templateId;

        // ✅ Check if templateId is a semantic string (should be null or GUID)
        if (finalTemplateId !== null && typeof finalTemplateId === 'string') {
          const isSemanticString = ['SayMessage', 'Message', 'DataRequest', 'GetData', 'BackendCall', 'UNDEFINED'].includes(finalTemplateId);
          if (isSemanticString) {
            console.warn('[💾 SAVE_ALL] Task has semantic templateId - converting to null', {
              taskId: task.id,
              templateId: finalTemplateId,
              type: task.type,
              typeName: TaskType[task.type]
            });
            return {
              id: task.id,
              type: task.type,
              templateId: null,  // ✅ Convert semantic string to null
              ...fields
            };
          }
        }

        const itemToSave = {
          id: task.id,
          type: task.type,          // ✅ Enum numerico (0-19) - REQUIRED
          templateId: finalTemplateId,
          ...fields  // ✅ Save fields directly
        };

        // ✅ LOG: Verifica templateId prima del salvataggio
        console.log('[🔍 TaskRepository][SAVE_ALL] 💾 Task da salvare', {
          taskId: task.id,
          taskTemplateId: task.templateId,
          finalTemplateId: finalTemplateId,
          hasTemplateId: !!finalTemplateId,
          fieldsKeys: Object.keys(fields)
        });

        return itemToSave;
      }).filter(item => item !== null);

      console.log('[💾 SAVE_ALL] Sending', {
        projectId: finalProjectId,
        itemsCount: items.length,
        itemsPreview: items.slice(0, 3).map(i => ({
          id: i.id,
          type: i.type,
          typeName: TaskType[i.type],
          templateId: i.templateId
        }))
      });

      const response = await fetch(`/api/projects/${finalProjectId}/tasks/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[💾 SAVE_ALL] Failed', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error('[TaskRepository][SAVE_ALL] Error saving tasks:', error);
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
        console.error('[💾 SAVE_TASK] Missing type - ABORT', { taskId: task.id });
        return false;
      }

      // ✅ Extract all fields except id, _id (MongoDB immutable), templateId, createdAt, updatedAt
      const { id, _id, templateId, createdAt, updatedAt, ...fields } = task;

      // ✅ Se è un'istanza (templateId !== null), filtra solo campi permessi
      // ✅ Campi permessi per istanze: id, templateId, templateVersion, labelKey, steps, createdAt, updatedAt
      // ❌ NON salvare: type, nodes, subNodes, icon, constraints, dataContract, examples, nlpProfile, patterns, valueSchema, allowedContexts, introduction
      const isInstance = task.templateId !== null && task.templateId !== undefined;

      let payload;
      if (isInstance) {
        // ✅ ISTANZA: Salva SOLO campi permessi
        payload = {
          id: task.id,
          templateId: task.templateId,  // ✅ OBBLIGATORIO per istanze
          templateVersion: task.templateVersion || 1,  // ✅ Versione del template
          labelKey: task.labelKey,  // ✅ Chiave di traduzione
          steps: task.steps,  // ✅ Array MaterializedStep[]
          // createdAt e updatedAt vengono gestiti dal backend
        };
      } else {
        // ✅ TEMPLATE: Salva tutti i campi (struttura completa)
        payload = {
          id: task.id,
          type: task.type,          // ✅ Enum numerico (0-19) - REQUIRED
          templateId: null,        // ✅ Template ha sempre templateId = null
          ...fields  // ✅ Save all fields directly (no value wrapper, excluding _id)
        };
      }

      // ✅ CRITICAL: Log steps structure only if wrong (reduce noise)
      if (payload.steps) {
        const stepsKeys = Object.keys(payload.steps);
        const stepTypeKeys = ['start', 'noMatch', 'noInput', 'confirmation', 'notConfirmed', 'success'];
        const hasWrongStructure = stepsKeys.length === stepTypeKeys.length &&
          stepsKeys.every(key => stepTypeKeys.includes(key));

        // ✅ Log solo se struttura sbagliata
        if (hasWrongStructure) {
          console.error('[🔍 TaskRepository][SAVE] ❌ CRITICAL: Saving wrong steps structure!', {
            taskId: task.id,
            stepsKeys,
            stepsKeysAsStrings: stepsKeys.join(', ')
          });
        }
        // ❌ RIMOSSO: log normale (troppo verboso)
      }

      // ✅ Validate payload before stringifying
      try {
        // Check for circular references in steps
        if (payload.steps) {
          const stepsString = JSON.stringify(payload.steps);
          if (stepsString.length > 10 * 1024 * 1024) { // 10MB limit
            console.error('[TaskRepository] Steps too large:', {
              taskId: task.id,
              stepsSize: stepsString.length,
              stepsKeys: Object.keys(payload.steps)
            });
            // Remove steps if too large (should not happen, but safety check)
            delete payload.steps;
          }
        }
      } catch (e) {
        console.error('[TaskRepository] Error validating payload:', e);
        // Remove steps if circular reference or other error
        if (payload.steps) {
          console.warn('[TaskRepository] Removing steps due to serialization error');
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
        const errorText = await response.text();
        let errorJson = null;
        try {
          errorJson = JSON.parse(errorText);
        } catch {
          // Not JSON, use text as is
        }
        console.error('[TaskRepository] Failed to save task:', {
          taskId: task.id,
          status: response.status,
          error: errorJson || errorText.substring(0, 500),
          taskType: task.type,
          hasSteps: !!(task.steps),
          stepsKeys: task.steps ? Object.keys(task.steps) : [],
          hasData: !!(task.data),
          dataLength: task.data ? task.data.length : 0,
          payloadSize: payloadString.length,
          payloadKeys: Object.keys(payload)
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error('[TaskRepository] Error saving task:', { taskId: task.id, error });
      return false;
    }
  }

  /**
   * Get internal tasks count (for debugging)
   */
  getInternalTasksCount(): number {
    return this.tasks.size;
  }
}

// Export singleton instance
export const taskRepository = new TaskRepository();
