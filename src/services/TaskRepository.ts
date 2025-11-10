import type { Task } from '../types/taskTypes';
import { instanceRepository, type ActInstance } from './InstanceRepository';
import { generateId } from '../utils/idGenerator';
import type { ProblemIntent } from '../types/project';

/**
 * TaskRepository: Wrapper around InstanceRepository
 * Converts between ActInstance (old) and Task (new) formats
 *
 * This service is added alongside InstanceRepository for gradual migration
 * - All operations go through InstanceRepository (maintains compatibility)
 * - Conversion happens in memory only
 * - No data is lost or duplicated
 */
class TaskRepository {
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
      // ClassifyProblem: value.intents
      if (instance.problemIntents && instance.problemIntents.length > 0) {
        value.intents = instance.problemIntents;
      }
    } else if (action === 'callBackend' || action === 'BackendCall') {
      // BackendCall: value.config (placeholder, will be populated from instance data)
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
   * Map TaskTemplate action ID back to actId (for backward compatibility)
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
   * Converts from InstanceRepository on-the-fly
   */
  getTask(taskId: string, actType?: string): Task | null {
    const instance = instanceRepository.getInstance(taskId);
    if (!instance) {
      return null;
    }

    return this.instanceToTask(instance, actType);
  }

  /**
   * Create a new Task
   * Creates underlying ActInstance in InstanceRepository
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

    // Create instance in InstanceRepository
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

    // Convert to Task
    return this.instanceToTask(instance, action);
  }

  /**
   * Update Task
   * Updates underlying ActInstance in InstanceRepository
   */
  updateTask(taskId: string, updates: Partial<Task>, projectId?: string): boolean {
    const existingInstance = instanceRepository.getInstance(taskId);
    if (!existingInstance) {
      console.warn('[TaskRepository] Task not found:', taskId);
      return false;
    }

    // Convert Task updates to ActInstance updates
    const instanceUpdates: Partial<ActInstance> = {};

    if (updates.value) {
      // Map value updates to instance fields
      // NOTE: We use updateInstance directly to avoid circular calls
      // InstanceRepository.updateMessage/updateDDT/updateIntents will sync back to TaskRepository
      // So we only update the instance directly here
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
   * Deletes underlying ActInstance from InstanceRepository
   * Note: Database deletion will be handled by InstanceRepository's saveAllInstancesToDatabase
   */
  deleteTask(taskId: string, projectId?: string): boolean {
    // Delete from InstanceRepository (in-memory)
    // Database cleanup will happen when saveAllInstancesToDatabase is called
    return instanceRepository.deleteInstance(taskId);
  }

  /**
   * Check if Task exists
   */
  hasTask(taskId: string): boolean {
    return instanceRepository.getInstance(taskId) !== undefined;
  }

  /**
   * Get all Tasks (converts all instances)
   */
  getAllTasks(): Task[] {
    // Get all instances from InstanceRepository and convert to Tasks
    const allInstances = instanceRepository.getAllInstances();
    const tasks: Task[] = [];

    for (const instance of allInstances) {
      const action = taskTemplateService.mapActionIdToTemplateId(instance.actId);
      tasks.push(this.instanceToTask(instance, action));
    }

    return tasks;
  }
}

// Export singleton instance
export const taskRepository = new TaskRepository();

