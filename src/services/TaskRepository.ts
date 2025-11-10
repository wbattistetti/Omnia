import type { Task } from '../types/taskTypes';
import { instanceRepository, type ActInstance } from './InstanceRepository';
import { generateId } from '../utils/idGenerator';
import type { ProblemIntent } from '../types/project';
import { taskTemplateService } from './TaskTemplateService';

/**
 * TaskRepository: Wrapper around InstanceRepository
 * Converts between ActInstance (old) and Task (new) formats
 *
 * This service is added alongside InstanceRepository for gradual migration
 * - All operations go through InstanceRepository (maintains compatibility)
 * - Conversion happens in memory only
 * - No data is lost or duplicated
 *
 * FASE 1A: Aggiunto storage interno per futura indipendenza
 * - tasks: Map interna per storage diretto (non ancora usata, solo preparazione)
 * - Metodi loadAllTasksFromDatabase/saveAllTasksToDatabase per gestione diretta DB
 */
class TaskRepository {
  // FASE 1A: Storage interno (preparazione per futura indipendenza)
  // Per ora non usato, manteniamo compatibilità con InstanceRepository
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
   * FASE 1B: Usa storage interno, sincronizza con InstanceRepository se necessario
   */
  getTask(taskId: string, actType?: string): Task | null {
    // FASE 1B: Prima controlla storage interno
    const cachedTask = this.tasks.get(taskId);
    if (cachedTask) {
      return cachedTask;
    }

    // Se non in cache, carica da InstanceRepository e sincronizza
    const instance = instanceRepository.getInstance(taskId);
    if (!instance) {
      return null;
    }

    const task = this.instanceToTask(instance, actType);
    // Sincronizza nello storage interno
    this.tasks.set(taskId, task);
    return task;
  }

  /**
   * Create a new Task
   * FASE 1B: Crea nello storage interno E in InstanceRepository (sincronizzazione)
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

    // FASE 1B: Crea Task nello storage interno
    const task: Task = {
      id: finalTaskId,
      action,
      value: value || undefined,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Salva nello storage interno
    this.tasks.set(finalTaskId, task);

    // FASE 1B: Sincronizza con InstanceRepository (per sicurezza durante migrazione)
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
   * FASE 1B: Aggiorna nello storage interno E in InstanceRepository (sincronizzazione)
   */
  updateTask(taskId: string, updates: Partial<Task>, projectId?: string): boolean {
    // FASE 1B: Prima controlla storage interno
    const existingTask = this.tasks.get(taskId);
    if (!existingTask) {
      // Se non in cache, prova a caricare da InstanceRepository
      const instance = instanceRepository.getInstance(taskId);
      if (!instance) {
        console.warn('[TaskRepository] Task not found:', taskId);
        return false;
      }
      // Sincronizza nello storage interno
      const task = this.instanceToTask(instance);
      this.tasks.set(taskId, task);
    }

    // Aggiorna nello storage interno
    const currentTask = this.tasks.get(taskId)!;
    const updatedTask: Task = {
      ...currentTask,
      ...updates,
      updatedAt: updates.updatedAt || new Date(),
      // Merge value: se updates.value è undefined, mantieni currentTask.value
      // Se updates.value è definito, fa merge profondo
      value: updates.value !== undefined
        ? { ...(currentTask.value || {}), ...updates.value }
        : currentTask.value
    };
    this.tasks.set(taskId, updatedTask);

    // FASE 1B: Sincronizza con InstanceRepository (per sicurezza durante migrazione)
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
   * FASE 1B: Rimuove da storage interno E da InstanceRepository (sincronizzazione)
   */
  deleteTask(taskId: string, projectId?: string): boolean {
    // FASE 1B: Rimuovi da storage interno
    const deleted = this.tasks.delete(taskId);

    // FASE 1B: Sincronizza con InstanceRepository
    const instanceDeleted = instanceRepository.deleteInstance(taskId);

    return deleted || instanceDeleted;
  }

  /**
   * Check if Task exists
   * FASE 1B: Controlla prima storage interno, poi InstanceRepository
   */
  hasTask(taskId: string): boolean {
    // FASE 1B: Prima controlla storage interno
    if (this.tasks.has(taskId)) {
      return true;
    }

    // Se non in cache, controlla InstanceRepository
    return instanceRepository.getInstance(taskId) !== undefined;
  }

  /**
   * Get all Tasks
   * FASE 1B: Usa storage interno, sincronizza con InstanceRepository se necessario
   */
  getAllTasks(): Task[] {
    // FASE 1B: Se storage interno è vuoto, sincronizza da InstanceRepository
    if (this.tasks.size === 0) {
      const allInstances = instanceRepository.getAllInstances();
      for (const instance of allInstances) {
        const action = taskTemplateService.mapActionIdToTemplateId(instance.actId);
        const task = this.instanceToTask(instance, action);
        this.tasks.set(task.id, task);
      }
    }

    // Ritorna tutti i task dallo storage interno
    return Array.from(this.tasks.values());
  }

  // ============================================
  // FASE 1A: Metodi per gestione database diretta
  // (Preparazione per futura indipendenza da InstanceRepository)
  // ============================================

  /**
   * Load all Tasks from database directly
   * FASE 1A: Metodo preparato per futura indipendenza
   * Per ora mantiene compatibilità: carica da InstanceRepository e sincronizza storage interno
   *
   * @param projectId - Project ID to load tasks for
   * @returns True if loaded successfully
   */
  async loadAllTasksFromDatabase(projectId?: string): Promise<boolean> {
    try {
      // FASE 1A: Per ora carichiamo da InstanceRepository (compatibilità)
      // In futuro questo metodo caricherà direttamente dal database
      const loaded = await instanceRepository.loadInstancesFromDatabase(projectId);

      if (loaded) {
        // Sincronizza storage interno con InstanceRepository
        // (preparazione per futura indipendenza)
        const allInstances = instanceRepository.getAllInstances();
        this.tasks.clear();

        for (const instance of allInstances) {
          const action = taskTemplateService.mapActionIdToTemplateId(instance.actId);
          const task = this.instanceToTask(instance, action);
          this.tasks.set(task.id, task);
        }

        console.log('[TaskRepository][LOAD_ALL] Loaded and synced', {
          projectId,
          tasksCount: this.tasks.size,
          instancesCount: allInstances.length
        });
      }

      return loaded;
    } catch (error) {
      console.error('[TaskRepository][LOAD_ALL] Error loading tasks:', error);
      return false;
    }
  }

  /**
   * Save all Tasks to database directly
   * FASE 1A: Metodo preparato per futura indipendenza
   * Per ora mantiene compatibilità: salva tramite InstanceRepository
   *
   * @param projectId - Project ID to save tasks for
   * @returns True if saved successfully
   */
  async saveAllTasksToDatabase(projectId?: string): Promise<boolean> {
    try {
      // FASE 1A: Per ora salviamo tramite InstanceRepository (compatibilità)
      // In futuro questo metodo salverà direttamente nel database
      const saved = await instanceRepository.saveAllInstancesToDatabase(projectId);

      if (saved) {
        // Sincronizza storage interno con InstanceRepository
        // (preparazione per futura indipendenza)
        const allInstances = instanceRepository.getAllInstances();
        this.tasks.clear();

        for (const instance of allInstances) {
          const action = taskTemplateService.mapActionIdToTemplateId(instance.actId);
          const task = this.instanceToTask(instance, action);
          this.tasks.set(task.id, task);
        }

        console.log('[TaskRepository][SAVE_ALL] Saved and synced', {
          projectId,
          tasksCount: this.tasks.size,
          instancesCount: allInstances.length
        });
      }

      return saved;
    } catch (error) {
      console.error('[TaskRepository][SAVE_ALL] Error saving tasks:', error);
      return false;
    }
  }

  /**
   * Get internal tasks count (for debugging)
   * FASE 1A: Metodo di utilità per verificare lo stato dello storage interno
   */
  getInternalTasksCount(): number {
    return this.tasks.size;
  }
}

// Export singleton instance
export const taskRepository = new TaskRepository();

