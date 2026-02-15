// Application layer: TaskEditor event handler
// Handles taskEditor:open events and prepares DockTab

import type { DockTab, DockTabTaskEditor } from '@dock/types';
import type { TaskType, TaskTree } from '@types/taskTypes';
import type { TaskMeta, TaskWizardMode } from '@taskEditor/EditorHost/types';
import { resolveEditorKind } from '@taskEditor/EditorHost/resolveKind';
import { taskRepository } from '@services/TaskRepository';
import { activateTab } from '@dock/ops';
import type { TaskEditorOpenEvent } from '../../domain/editorEvents';
import { validateTaskEditorEvent } from '../../domain/editorEvents';

/**
 * Maps editor kind to header color
 */
function getHeaderColor(editorKind: string): string {
  const colors: Record<string, string> = {
    message: '#059669',
    ddt: '#9a4f00',
    backend: '#94a3b8',
    intent: '#f59e0b',
    aiagent: '#a855f7',
    summarizer: '#06b6d4',
    negotiation: '#6366f1',
  };
  return colors[editorKind] || '#6b7280';
}

/**
 * Maps editor kind to default title
 */
function getDefaultTitle(editorKind: string): string {
  const titles: Record<string, string> = {
    message: 'Message',
    ddt: 'Response Editor',
    backend: 'Backend Call',
    intent: 'Problem Classification',
    aiagent: 'AI Agent',
    summarizer: 'Summarizer',
    negotiation: 'Negotiation',
  };
  return titles[editorKind] || 'Editor';
}

export interface TaskEditorEventHandlerParams {
  currentProjectId?: string;
  pdUpdate: any;
}

export class TaskEditorEventHandler {
  constructor(private params: TaskEditorEventHandlerParams) {}

  /**
   * Handles taskEditor:open event
   */
  async handle(event: TaskEditorOpenEvent): Promise<{
    tabId: string;
    dockTab: DockTabTaskEditor;
    preparedTaskTree: TaskTree | null;
    onExisting?: (tree: any, tabId: string) => any;
  }> {
    // Validate event
    if (!validateTaskEditorEvent(event)) {
      throw new Error('Invalid TaskEditorOpenEvent');
    }

    const instanceId = event.instanceId || event.id;
    const editorKind = resolveEditorKind({
      type: event.type,
      id: event.id,
      label: event.label || event.name || '',
    });

    // Build TaskMeta
    const taskMeta = this.buildTaskMeta(event);

    // Prepare TaskTree if needed
    const preparedTaskTree = await this.prepareTaskTree(event, taskMeta, instanceId, editorKind);

    // Build DockTab
    const tabId = `act_${event.id}`;
    const dockTab = this.buildDockTab(event, taskMeta, editorKind, tabId);

    // Build onExisting handler for ddt editor kind
    const onExisting = editorKind === 'ddt' && preparedTaskTree
      ? (tree: any, tabId: string) => {
          // Save TaskTree to taskRepository when tab already exists
          let task = taskRepository.getTask(instanceId);
          if (!task && event.templateId) {
            task = taskRepository.createTask(taskMeta.type, event.templateId, undefined, instanceId);
          }
          if (task) {
            const { steps: _, ...preparedTaskTreeWithoutSteps } = preparedTaskTree;
            taskRepository.updateTask(instanceId, {
              ...preparedTaskTreeWithoutSteps,
              templateId: event.templateId || task.templateId,
            }, this.params.pdUpdate?.getCurrentProjectId());
          }
          return activateTab(tree, tabId);
        }
      : undefined;

    return {
      tabId,
      dockTab,
      preparedTaskTree,
      onExisting,
    };
  }

  /**
   * Builds TaskMeta from event
   */
  private buildTaskMeta(event: TaskEditorOpenEvent): TaskMeta {
    const taskType = event.type as TaskType;

    // Determine taskWizardMode
    let taskWizardMode: TaskWizardMode | undefined;
    if (event.taskWizardMode && (event.taskWizardMode === 'none' || event.taskWizardMode === 'adaptation' || event.taskWizardMode === 'full')) {
      taskWizardMode = event.taskWizardMode;
      console.log('[TaskEditorEventHandler] ✅ taskWizardMode esplicito dall\'evento', {
        eventId: event.id,
        taskWizardMode: event.taskWizardMode,
        wizardMode: taskWizardMode
      });
    } else {
      // Backward compatibility: derive from boolean flags
      if (event.needsTaskBuilder === true) {
        taskWizardMode = 'full';
      } else if (event.needsTaskContextualization === true) {
        taskWizardMode = 'adaptation';
      } else {
        taskWizardMode = 'none';
      }
      console.log('[TaskEditorEventHandler] 📊 taskWizardMode derivato da boolean flags', {
        eventId: event.id,
        needsTaskBuilder: event.needsTaskBuilder,
        needsTaskContextualization: event.needsTaskContextualization,
        wizardMode: taskWizardMode
      });
    }

    const taskMeta: TaskMeta = {
      id: event.id,
      type: taskType,
      label: event.label || event.name || 'Task',
      instanceId: event.instanceId || event.id,
      taskWizardMode,
      needsTaskContextualization: event.needsTaskContextualization === true,
      needsTaskBuilder: event.needsTaskBuilder === true,
      contextualizationTemplateId: event.contextualizationTemplateId || undefined,
      taskLabel: event.taskLabel || event.label || event.name || undefined,
    };

    console.log('[TaskEditorEventHandler] 📋 TaskMeta costruito', {
      taskMetaId: taskMeta.id,
      taskMetaType: taskMeta.type,
      taskWizardMode: taskMeta.taskWizardMode,
      contextualizationTemplateId: taskMeta.contextualizationTemplateId,
      taskLabel: taskMeta.taskLabel,
      taskMetaKeys: Object.keys(taskMeta)
    });

    return taskMeta;
  }

  /**
   * Prepares TaskTree for ddt editor kind
   */
  private async prepareTaskTree(
    event: TaskEditorOpenEvent,
    taskMeta: TaskMeta,
    instanceId: string,
    editorKind: string
  ): Promise<TaskTree | null> {
    if (editorKind !== 'ddt') {
      return null;
    }

    // Use TaskTree from event if present
    let taskTree = event.taskTree;

    if (taskTree) {
      // Save overrides to taskRepository
      let task = taskRepository.getTask(instanceId);
      if (!task && event.templateId) {
        task = taskRepository.createTask(taskMeta.type, event.templateId, undefined, instanceId);
      }
      if (task) {
        const { extractTaskOverrides } = await import('@utils/taskUtils');
        const overrides = await extractTaskOverrides(task, taskTree, this.params.pdUpdate?.getCurrentProjectId() || undefined);
        taskRepository.updateTask(instanceId, {
          ...overrides,
          templateId: event.templateId || task.templateId,
        }, this.params.pdUpdate?.getCurrentProjectId());
      }
      return taskTree;
    }

    // Load TaskTree from task
    let task = taskRepository.getTask(instanceId);
    if (!task && event.templateId) {
      task = taskRepository.createTask(taskMeta.type, event.templateId, {
        label: event.label || 'New Task',
      }, instanceId);
    }

            if (task && task.templateId) {
              try {
                const { buildTaskTree } = await import('@utils/taskUtils');
                const projectId = this.params.currentProjectId || undefined;
                taskTree = await buildTaskTree(task, projectId);
                // Reload task after buildTaskTree (it may have updated steps)
                task = taskRepository.getTask(instanceId);
              } catch (err) {
                console.error('[TaskEditorEventHandler] Error loading TaskTree from template:', err);
              }
            }

    // Create empty TaskTree if task exists but no TaskTree loaded
    if (task && !taskTree) {
      taskTree = { label: event.label || 'New Task', nodes: [] };
      taskRepository.updateTask(instanceId, {
        label: taskTree.label,
      }, this.params.pdUpdate?.getCurrentProjectId());
    }

    return task ? taskTree : null;
  }

  /**
   * Builds DockTab based on editorKind
   */
  private buildDockTab(
    event: TaskEditorOpenEvent,
    taskMeta: TaskMeta,
    editorKind: string,
    tabId: string
  ): DockTabTaskEditor {
    const headerColor = getHeaderColor(editorKind);
    const defaultTitle = getDefaultTitle(editorKind);
    const title = event.label || event.name || defaultTitle;

    return {
      id: tabId,
      title,
      type: 'taskEditor',
      task: taskMeta,
      headerColor,
      toolbarButtons: [],
    } as DockTabTaskEditor;
  }
}
