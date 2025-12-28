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
   */
  getTask(taskId: string): Task | null {
    // Check internal storage first
    const cachedTask = this.tasks.get(taskId);
    if (cachedTask) {
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

    const task: Task = {
      id: finalTaskId,
      type: type,                // ✅ Enum numerico (0-19) - COMPORTAMENTO
      templateId: templateId,     // ✅ null = standalone, GUID = referenzia un altro Task
      ...(fields || {}),          // ✅ Campi diretti (niente wrapper value)
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save to internal storage
    this.tasks.set(finalTaskId, task);

    // Save to database if projectId is available
    if (finalProjectId) {
      this.saveTaskToDatabase(task, finalProjectId).catch(err => {
        console.error('[TaskRepository] Failed to save task to database:', err);
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

    // Update in internal storage (merge fields directly, no value wrapper)
    const updatedTask: Task = {
      ...existingTask,
      ...updates,
      updatedAt: updates.updatedAt || new Date()
    };
    this.tasks.set(taskId, updatedTask);

    // ✅ NO automatic save to database - user must click "Save" explicitly
    // The save will happen when user clicks the Save button in the UI

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
    const startTime = performance.now();
    const finalProjectId = projectId || this.getCurrentProjectId();
    console.log(`[PERF][${new Date().toISOString()}] 📋 START loadAllTasksFromDatabase`, { projectId: finalProjectId });

    try {
      if (!finalProjectId) {
        console.warn('[TaskRepository] No project ID available for loading tasks');
        return false;
      }

      const fetchStart = performance.now();
      const response = await fetch(`/api/projects/${finalProjectId}/tasks`);
      if (!response.ok) {
        const duration = performance.now() - startTime;
        console.error(`[PERF][${new Date().toISOString()}] ❌ ERROR loadAllTasksFromDatabase`, {
          duration: `${duration.toFixed(2)}ms`,
          projectId: finalProjectId,
          status: response.status
        });
        return false;
      }

      const jsonStart = performance.now();
      const data = await response.json();
      const items: Task[] = data.items || [];
      console.log(`[PERF][${new Date().toISOString()}] ✅ END fetch tasks`, {
        fetchDuration: `${(performance.now() - fetchStart).toFixed(2)}ms`,
        jsonParseDuration: `${(performance.now() - jsonStart).toFixed(2)}ms`,
        itemsCount: items.length
      });

      // Clear and populate internal storage
      const processStart = performance.now();
      this.tasks.clear();
      for (const item of items) {
        // Map database document to Task
        // templateId is required - no fallback on action
        if (!item.templateId) {
          console.warn('[TaskRepository] Task without templateId (skipping):', item.id);
          continue;
        }

        // ✅ Load task with fields directly (no value wrapper)
        // ✅ If item has value wrapper (old format), flatten it for backward compatibility
        // ✅ Otherwise, use fields directly
        const { id, templateId, createdAt, updatedAt, projectId: _projectId, value, ...directFields } = item;
        const task: Task = {
          id: item.id,
          templateId: item.templateId ?? null,
          ...(value || {}),  // ✅ Backward compatibility: flatten value if present
          ...directFields,   // ✅ Use direct fields (mainData, label, stepPrompts, ecc.)
          createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined
        };
        this.tasks.set(task.id, task);
      }
      console.log(`[PERF][${new Date().toISOString()}] ✅ END process tasks`, {
        processDuration: `${(performance.now() - processStart).toFixed(2)}ms`,
        tasksCount: this.tasks.size
      });

      // Emit event to notify components that tasks have been loaded
      window.dispatchEvent(new CustomEvent('tasks:loaded', {
        detail: { projectId: finalProjectId, tasksCount: this.tasks.size }
      }));

      const totalDuration = performance.now() - startTime;
      console.log(`[PERF][${new Date().toISOString()}] 🎉 COMPLETE loadAllTasksFromDatabase`, {
        projectId: finalProjectId,
        totalDuration: `${totalDuration.toFixed(2)}ms`,
        totalDurationSeconds: `${(totalDuration / 1000).toFixed(2)}s`,
        tasksCount: this.tasks.size
      });

      return true;
    } catch (error) {
      const totalDuration = performance.now() - startTime;
      console.error(`[PERF][${new Date().toISOString()}] ❌ ERROR loadAllTasksFromDatabase`, {
        duration: `${totalDuration.toFixed(2)}ms`,
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
        // Extract all fields except id, templateId, createdAt, updatedAt
        const { id, templateId, createdAt, updatedAt, ...fields } = task;
        return {
          id: task.id,
          templateId: task.templateId ?? null,
          ...fields  // ✅ Save fields directly
        };
      });

      const response = await fetch(`/api/projects/${finalProjectId}/tasks/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });

      if (!response.ok) {
        console.error('[TaskRepository] Failed to save tasks to database');
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
      // ✅ Extract all fields except id, templateId, createdAt, updatedAt
      const { id, templateId, createdAt, updatedAt, ...fields } = task;

      const response = await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: task.id,
          templateId: task.templateId ?? null,
          ...fields  // ✅ Save fields directly (no value wrapper)
        })
      });

      if (!response.ok) {
        console.error('[TaskRepository] Failed to save task to database');
        return false;
      }

      return true;
    } catch (error) {
      console.error('[TaskRepository] Error saving task to database:', error);
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
