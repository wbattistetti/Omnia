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
      return false;
    }

    // ✅ CRITICAL: Preserve type field - never allow it to be removed
    const { type, templateId, ...updatesWithoutTypeAndTemplateId } = updates;

    // ✅ If type is explicitly provided and different, update it
    // ✅ If type is not provided, preserve existing type
    const finalType = type !== undefined ? type : existingTask.type;

    // ✅ CRITICAL: Ensure type is always present
    if (finalType === undefined || finalType === null) {
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

      // Structure validation (silent)
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
      ...(finalData ? { data: finalData } : {}), // ✅ Usa finalData se presente (merge profondo)
      type: finalType,  // ✅ Always preserve/update type - REQUIRED
      templateId: finalTemplateId,  // ✅ Protected templateId
      updatedAt: updates.updatedAt || new Date()
    };


    // ✅ Update internal storage only (in-memory)
    // ✅ NO automatic database save - save only on explicit user action (project:save event)
    this.tasks.set(taskId, updatedTask);


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
          return false;
        }
      } catch (err) {
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
        return false;
      }

      const response = await fetch(`/api/projects/${finalProjectId}/tasks`);
      if (!response.ok) {
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
            // ✅ Verifica se è la vecchia struttura (dictionary)
            const stepsKeys = Object.keys(task.steps);
            const stepTypeKeys = ['start', 'noMatch', 'noInput', 'confirmation', 'notConfirmed', 'success', 'introduction'];
            const hasWrongStructure = stepsKeys.length === stepTypeKeys.length &&
              stepsKeys.every(key => stepTypeKeys.includes(key));

            if (hasWrongStructure) {
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

        return itemToSave;
      }).filter(item => item !== null);

      const response = await fetch(`/api/projects/${finalProjectId}/tasks/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });

      if (!response.ok) {
        return false;
      }

      return true;
    } catch (error) {
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
}

// Export singleton instance
export const taskRepository = new TaskRepository();
