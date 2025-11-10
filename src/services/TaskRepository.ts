import type { Task } from '../types/taskTypes';
import { instanceRepository, type ActInstance } from './InstanceRepository';
import { generateId } from '../utils/idGenerator';
import type { ProblemIntent } from '../types/project';
import { taskTemplateService } from './TaskTemplateService';

/**
 * TaskRepository: Primary repository for Task data
 *
 * Manages Task objects (new model) with internal storage.
 * Uses InstanceRepository internally for database operations (backward compatibility with existing database format).
 * All components use TaskRepository, which handles conversion between Task and ActInstance formats.
 */
class TaskRepository {
  // Internal storage for Task objects
  private tasks = new Map<string, Task>();
  /**
   * Map ActType/actId to TaskTemplate action ID
   */
  private mapActIdToAction(actId: string, actType?: string): string {
    // Direct mapping for known ActTypes
    const actTypeMapping: Record<string, string> = {
      'Message': 'SayMessage',
      'DataRequest': 'GetData',
      'ProblemClassification': 'ClassifyProblem',
      'BackendCall': 'callBackend',
      'Summarizer': 'riepiloga',
      'Negotiation': 'negozia',
      'AIAgent': 'aiAgent'
    };

    if (actType && actTypeMapping[actType]) {
      return actTypeMapping[actType];
    }

    // Try to infer from actId pattern
    if (actId.toLowerCase().includes('message') || actId === 'Message') {
      return 'SayMessage';
    }
    if (actId.toLowerCase().includes('data') || actId === 'DataRequest') {
      return 'GetData';
    }
    if (actId.toLowerCase().includes('problem') || actId === 'ProblemClassification') {
      return 'ClassifyProblem';
    }
    if (actId.toLowerCase().includes('backend') || actId === 'BackendCall') {
      return 'callBackend';
    }

    // Default: use actId as-is (will need template mapping later)
    return actId;
  }

  /**
   * Convert ActInstance to Task
   */
  private instanceToTask(instance: ActInstance, actType?: string): Task {
    const action = this.mapActIdToAction(instance.actId, actType);
    const value: Record<string, any> = {};

    // Map instance data to Task.value based on action type
    if (action === 'SayMessage' || action === 'Message') {
      // Message: value.text
      if (instance.message?.text) {
        value.text = instance.message.text;
      }
    } else if (action === 'GetData' || action === 'DataRequest') {
      // GetData: value.ddt
      if (instance.ddt) {
        value.ddt = instance.ddt;
      }
    } else if (action === 'ClassifyProblem' || action === 'ProblemClassification') {
      // ClassifyProblem: value.intents AND value.ddt (messages are stored in DDT)
      if (instance.problemIntents && instance.problemIntents.length > 0) {
        value.intents = instance.problemIntents;
      }
      // FIX: Include DDT for ProblemClassification (messages are stored in DDT.steps)
      if (instance.ddt) {
        value.ddt = instance.ddt;
      }
    } else if (action === 'callBackend' || action === 'BackendCall') {
      // BackendCall: value.config
      value.config = {};
    } else {
      // Generic: preserve all instance data
      if (instance.ddt) value.ddt = instance.ddt;
      if (instance.message) value.message = instance.message;
      if (instance.problemIntents) value.intents = instance.problemIntents;
    }

    return {
      id: instance.instanceId,
      action,
      value: Object.keys(value).length > 0 ? value : undefined,
      createdAt: instance.createdAt,
      updatedAt: instance.updatedAt
    };
  }

  /**
   * Convert Task to ActInstance (for saving)
   */
  private taskToInstance(task: Task, originalInstance?: ActInstance): ActInstance {
    // Determine actId from action (reverse mapping)
    const actId = this.mapActionToActId(task.action, originalInstance?.actId);

    const instance: ActInstance = {
      instanceId: task.id,
      actId,
      problemIntents: task.value?.intents || originalInstance?.problemIntents || [],
      ddt: task.value?.ddt || originalInstance?.ddt,
      message: task.value?.text ? { text: task.value.text } : (task.value?.message || originalInstance?.message),
      createdAt: task.createdAt || originalInstance?.createdAt || new Date(),
      updatedAt: task.updatedAt || new Date()
    };

    return instance;
  }

  /**
   * Map TaskTemplate action ID back to actId (for database compatibility)
   */
  private mapActionToActId(action: string, fallbackActId?: string): string {
    // Reverse mapping
    const actionMapping: Record<string, string> = {
      'SayMessage': 'Message',
      'GetData': 'DataRequest',
      'ClassifyProblem': 'ProblemClassification',
      'callBackend': 'BackendCall',
      'riepiloga': 'Summarizer',
      'negozia': 'Negotiation',
      'aiAgent': 'AIAgent'
    };

    return actionMapping[action] || fallbackActId || action;
  }

  /**
   * Get Task by ID
   */
  getTask(taskId: string, actType?: string): Task | null {
    // Check internal storage first
    const cachedTask = this.tasks.get(taskId);
    if (cachedTask) {
      return cachedTask;
    }

    // If not in cache, load from InstanceRepository and sync
    const instance = instanceRepository.getInstance(taskId);
    if (!instance) {
      return null;
    }

    const task = this.instanceToTask(instance, actType);

    // Sync to internal storage
    this.tasks.set(taskId, task);
    return task;
  }

  /**
   * Create a new Task
   */
  createTask(action: string, value?: Record<string, any>, taskId?: string, projectId?: string): Task {
    const actId = this.mapActionToActId(action);
    const finalTaskId = taskId || generateId();

    // Extract data from value based on action
    let initialIntents: ProblemIntent[] | undefined;
    let initialDDT: any;
    let initialMessage: { text: string } | undefined;

    if (action === 'SayMessage' || action === 'Message') {
      initialMessage = value?.text ? { text: value.text } : undefined;
    } else if (action === 'GetData' || action === 'DataRequest') {
      initialDDT = value?.ddt;
    } else if (action === 'ClassifyProblem' || action === 'ProblemClassification') {
      initialIntents = value?.intents;
    }

    // Create Task in internal storage
    const task: Task = {
      id: finalTaskId,
      action,
      value: value || undefined,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save to internal storage
    this.tasks.set(finalTaskId, task);

    // Sync with InstanceRepository (for database compatibility)
    const instance = instanceRepository.createInstance(
      actId,
      initialIntents,
      finalTaskId,
      projectId
    );

    // Set DDT and message if provided
    if (initialDDT) {
      instanceRepository.updateDDT(finalTaskId, initialDDT, projectId);
    }
    if (initialMessage) {
      instanceRepository.updateInstance(finalTaskId, { message: initialMessage }, projectId);
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
      // If not in cache, try to load from InstanceRepository
      const instance = instanceRepository.getInstance(taskId);
      if (!instance) {
        console.warn('[TaskRepository] Task not found:', taskId);
        return false;
      }
      // Sync to internal storage
      const task = this.instanceToTask(instance);
      this.tasks.set(taskId, task);
    }

    // Update in internal storage
    const currentTask = this.tasks.get(taskId)!;
    const updatedTask: Task = {
      ...currentTask,
      ...updates,
      updatedAt: updates.updatedAt || new Date(),
      // Merge value: if updates.value is undefined, keep currentTask.value
      // If updates.value is defined, do deep merge
      value: updates.value !== undefined
        ? { ...(currentTask.value || {}), ...updates.value }
        : currentTask.value
    };
    this.tasks.set(taskId, updatedTask);

    // Sync with InstanceRepository (for database compatibility)
    const instanceUpdates: Partial<ActInstance> = {};

    if (updates.value) {
      if (updates.value.text !== undefined) {
        instanceUpdates.message = { text: updates.value.text };
      }
      if (updates.value.ddt !== undefined) {
        instanceUpdates.ddt = updates.value.ddt;
      }
      if (updates.value.intents !== undefined) {
        instanceUpdates.problemIntents = updates.value.intents;
      }
    }

    if (updates.updatedAt) {
      instanceUpdates.updatedAt = updates.updatedAt;
    }

    // Update in InstanceRepository (in-memory only)
    const result = instanceRepository.updateInstance(taskId, instanceUpdates);

    // If projectId provided, also save to database
    if (result && projectId) {
      const updatedInstance = instanceRepository.getInstance(taskId);
      if (updatedInstance) {
        instanceRepository.updateInstanceInDatabase(updatedInstance, projectId).catch(err => {
          console.error('[TaskRepository] Failed to save to database:', err);
        });
      }
    }

    return result;
  }

  /**
   * Update Task value (convenience method)
   */
  updateTaskValue(taskId: string, value: Record<string, any>, projectId?: string): boolean {
    return this.updateTask(taskId, { value, updatedAt: new Date() }, projectId);
  }

  /**
   * Delete Task
   */
  deleteTask(taskId: string, projectId?: string): boolean {
    // Remove from internal storage
    const deleted = this.tasks.delete(taskId);

    // Sync with InstanceRepository
    const instanceDeleted = instanceRepository.deleteInstance(taskId);

    return deleted || instanceDeleted;
  }

  /**
   * Check if Task exists
   */
  hasTask(taskId: string): boolean {
    // Check internal storage first
    if (this.tasks.has(taskId)) {
      return true;
    }

    // If not in cache, check InstanceRepository
    return instanceRepository.getInstance(taskId) !== undefined;
  }

  /**
   * Get all Tasks
   */
  getAllTasks(): Task[] {
    // If internal storage is empty, sync from InstanceRepository
    if (this.tasks.size === 0) {
      const allInstances = instanceRepository.getAllInstances();
      for (const instance of allInstances) {
        const action = taskTemplateService.mapActionIdToTemplateId(instance.actId);
        const task = this.instanceToTask(instance, action);
        this.tasks.set(task.id, task);
      }
    }

    // Return all tasks from internal storage
    return Array.from(this.tasks.values());
  }

  /**
   * Load all Tasks from database
   *
   * @param projectId - Project ID to load tasks for
   * @returns True if loaded successfully
   */
  async loadAllTasksFromDatabase(projectId?: string): Promise<boolean> {
    try {
      // Load from InstanceRepository (database compatibility)
      const loaded = await instanceRepository.loadInstancesFromDatabase(projectId);

      if (loaded) {
        // Sync internal storage with InstanceRepository
        const allInstances = instanceRepository.getAllInstances();
        this.tasks.clear();

        for (const instance of allInstances) {
          const action = taskTemplateService.mapActionIdToTemplateId(instance.actId);
          const task = this.instanceToTask(instance, action);
          this.tasks.set(task.id, task);
        }

        // Emit event to notify components that tasks have been loaded
        window.dispatchEvent(new CustomEvent('tasks:loaded', {
          detail: { projectId, tasksCount: this.tasks.size }
        }));
      }

      return loaded;
    } catch (error) {
      console.error('[TaskRepository][LOAD_ALL] Error loading tasks:', error);
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
      // Save via InstanceRepository (database compatibility)
      const saved = await instanceRepository.saveAllInstancesToDatabase(projectId);

      if (saved) {
        // Sync internal storage with InstanceRepository
        const allInstances = instanceRepository.getAllInstances();
        this.tasks.clear();

        for (const instance of allInstances) {
          const action = taskTemplateService.mapActionIdToTemplateId(instance.actId);
          const task = this.instanceToTask(instance, action);
          this.tasks.set(task.id, task);
        }
      }

      return saved;
    } catch (error) {
      console.error('[TaskRepository][SAVE_ALL] Error saving tasks:', error);
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

