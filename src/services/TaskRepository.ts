import type { Task, TaskInstance } from '../types/taskTypes';
import { TaskType } from '../types/taskTypes';
import { generateId } from '../utils/idGenerator';
import { getTemplateId } from '../utils/taskHelpers';

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
   * @param fields - Task fields (label, mainData, text, etc.)
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

    console.log('[📝 CREATE_TASK]', {
      taskId: task.id,
      type: task.type,
      typeName: TaskType[task.type],
      templateId: task.templateId,
      hasText: !!task.text
    });

    // Save to internal storage
    this.tasks.set(finalTaskId, task);

    // Save to database if projectId is available
    if (finalProjectId) {
      this.saveTaskToDatabase(task, finalProjectId).catch(err => {
        console.error('[📝 CREATE_TASK] Failed to save:', err);
      });
    }

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
    const { type, ...updatesWithoutType } = updates;

    // ✅ If type is explicitly provided and different, update it
    // ✅ If type is not provided, preserve existing type
    const finalType = type !== undefined ? type : existingTask.type;

    // ✅ CRITICAL: Ensure type is always present
    if (finalType === undefined || finalType === null) {
      console.error(`[TaskRepository] Cannot update task ${taskId} - type field is missing. This task is invalid.`);
      return false;
    }

    // Update in internal storage (merge fields directly, no value wrapper)
    const updatedTask: Task = {
      ...existingTask,
      ...updatesWithoutType,
      type: finalType,  // ✅ Always preserve/update type - REQUIRED
      updatedAt: updates.updatedAt || new Date()
    };
    this.tasks.set(taskId, updatedTask);

    // ✅ Save to database if projectId is available
    const finalProjectId = projectId || this.getCurrentProjectId();
    if (finalProjectId) {
      this.saveTaskToDatabase(updatedTask, finalProjectId).catch(err => {
        console.error('[TaskRepository] Failed to save updated task to database:', err);
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
      console.log('[📥 LOAD_TASKS] Fetched', { count: items.length });

      // Clear and populate internal storage
      this.tasks.clear();
      for (const item of items) {
        // ✅ Load task with fields directly (no value wrapper)
        const { id, templateId, createdAt, updatedAt, projectId: _projectId, value, type, Type, ...directFields } = item;
        const taskType = type !== undefined && type !== null ? type : (Type !== undefined && Type !== null ? Type : undefined);

        console.log('[📥 LOAD_TASKS] Processing', {
          taskId: id,
          type: taskType,
          typeName: taskType !== undefined ? TaskType[taskType] : 'undefined',
          templateId
        });

        // ✅ CRITICAL: type is REQUIRED - must be saved correctly in database
        if (taskType === undefined || taskType === null) {
          console.error('[📥 LOAD_TASKS] Task without type - SKIPPED', {
            taskId: id,
            availableFields: Object.keys(item)
          });
          continue;
        }

        const task: Task = {
          id: item.id,
          type: taskType,                // ✅ Enum numerico (0-19) - REQUIRED
          templateId: item.templateId ?? null,
          ...(value || {}),  // ✅ Backward compatibility: flatten value if present
          ...directFields,   // ✅ Use direct fields (mainData, label, stepPrompts, ecc.)
          createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined
        };

        console.log('[📥 LOAD_TASKS] Loaded', {
          taskId: task.id,
          type: task.type,
          typeName: TaskType[task.type],
          templateId: task.templateId,
          hasText: !!task.text
        });

        this.tasks.set(task.id, task);
      }

      // Emit event to notify components that tasks have been loaded
      window.dispatchEvent(new CustomEvent('tasks:loaded', {
        detail: { projectId: finalProjectId, tasksCount: this.tasks.size }
      }));

      console.log('[📥 LOAD_TASKS] Complete', { totalTasks: this.tasks.size });
      return true;
    } catch (error) {
      console.error('[📥 LOAD_TASKS] Error', {
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

        // Extract all fields except id, templateId, createdAt, updatedAt
        const { id, templateId, createdAt, updatedAt, ...fields } = task;

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

        return {
          id: task.id,
          type: task.type,          // ✅ Enum numerico (0-19) - REQUIRED
          templateId: finalTemplateId,
          ...fields  // ✅ Save fields directly
        };
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

      // ✅ Extract all fields except id, templateId, createdAt, updatedAt
      const { id, templateId, createdAt, updatedAt, ...fields } = task;

      const payload = {
        id: task.id,
        type: task.type,          // ✅ Enum numerico (0-19) - REQUIRED
        templateId: task.templateId ?? null,
        ...fields  // ✅ Save fields directly (no value wrapper)
      };

      console.log('[💾 SAVE_TASK] Saving', {
        taskId: task.id,
        type: task.type,
        typeName: TaskType[task.type],
        templateId: task.templateId,
        hasText: !!task.text
      });

      const response = await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.error('[💾 SAVE_TASK] Failed', { taskId: task.id, status: response.status });
        return false;
      }

      console.log('[💾 SAVE_TASK] Success', { taskId: task.id });
      return true;
    } catch (error) {
      console.error('[💾 SAVE_TASK] Error', { taskId: task.id, error });
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
