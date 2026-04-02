// Application layer: TaskEditor event handler
// Handles taskEditor:open events and prepares DockTab

import type { DockTab, DockTabTaskEditor } from '@dock/types';
import type { Task, TaskType, TaskTree } from '@types/taskTypes';
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
          if (!task) {
            task = taskRepository.createTask(
              taskMeta.type,
              event.templateId ?? null,
              {
                label: event.label || event.name || 'New Task',
                steps:
                  preparedTaskTree.steps &&
                  typeof preparedTaskTree.steps === 'object' &&
                  !Array.isArray(preparedTaskTree.steps)
                    ? preparedTaskTree.steps
                    : {},
              },
              instanceId,
              this.params.pdUpdate?.getCurrentProjectId() || this.params.currentProjectId || undefined
            );
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
    if (
      event.taskWizardMode &&
      (event.taskWizardMode === 'none' ||
        event.taskWizardMode === 'adaptation' ||
        event.taskWizardMode === 'full' ||
        event.taskWizardMode === 'pending')
    ) {
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

    // ✅ FIX: Se è adaptation mode, NON preparare il taskTree qui
    // Il wizard lo farà quando l'utente clicca "Sì" (creerà task, clonerà step, adatterà prompt)
    if (taskMeta.taskWizardMode === 'adaptation') {
      console.log('[TaskEditorEventHandler] ⏸️ Adaptation mode: wizard preparerà il taskTree (task e step verranno creati al click su "Sì")', {
        instanceId,
        templateId: taskMeta.contextualizationTemplateId
      });
      return null; // Il wizard creerà il task e clonerà gli step
    }

    // Use TaskTree from event if present
    let taskTree = event.taskTree;

    const projectIdForTask =
      this.params.pdUpdate?.getCurrentProjectId() || this.params.currentProjectId || undefined;

    if (taskTree) {
      // Save overrides to taskRepository
      let task = taskRepository.getTask(instanceId);
      if (!task) {
        task = taskRepository.createTask(
          taskMeta.type,
          event.templateId ?? null,
          {
            label: event.label || event.name || 'New Task',
            steps: taskTree.steps && typeof taskTree.steps === 'object' && !Array.isArray(taskTree.steps)
              ? taskTree.steps
              : {},
          },
          instanceId,
          projectIdForTask
        );
      }
      if (task) {
        // ✅ SIMPLIFIED: Save directly from taskTree (no extractTaskOverrides needed)
        const updates: Partial<Task> = {
          steps: taskTree.steps ?? {},
          ...(taskTree.labelKey || taskTree.label ? { labelKey: taskTree.labelKey || taskTree.label } : {}),
          templateId: event.templateId || task.templateId,
        };
        taskRepository.updateTask(instanceId, updates, this.params.pdUpdate?.getCurrentProjectId());
      }
      return taskTree;
    }

    // Load TaskTree from task — always register instance in repository (lazy row → real task)
    let task = taskRepository.getTask(instanceId);
    if (!task) {
      task = taskRepository.createTask(
        taskMeta.type,
        event.templateId ?? null,
        {
          label: event.label || event.name || 'New Task',
          steps: {},
        },
        instanceId,
        projectIdForTask
      );
    }

    if (task && task.templateId) {
      try {
        const { buildTaskTreeFromRepository } = await import('@utils/taskUtils');
        const projectId = this.params.currentProjectId || undefined;
        const result = await buildTaskTreeFromRepository(instanceId, projectId);
        if (result) {
          taskTree = result.taskTree;
          task = result.instance;
        }
      } catch (err) {
        console.error('[TaskEditorEventHandler] Error loading TaskTree from template:', err);
      }
    }

    // Create minimal TaskTree if task exists but no TaskTree loaded (wizard full, no template, materialize failed)
    if (task && !taskTree) {
      const stepsFromTask =
        task.steps && typeof task.steps === 'object' && !Array.isArray(task.steps) ? task.steps : {};
      taskTree = {
        label: event.label || event.name || 'New Task',
        nodes: [],
        steps: stepsFromTask,
      };
      taskRepository.updateTask(
        instanceId,
        { label: taskTree.label },
        this.params.pdUpdate?.getCurrentProjectId(),
        { merge: true }
      );
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

    const flowId = String(event.flowId ?? '').trim() || undefined;
    return {
      id: tabId,
      title,
      type: 'taskEditor',
      task: taskMeta,
      ...(flowId ? { flowId } : {}),
      headerColor,
      toolbarButtons: [],
    } as DockTabTaskEditor;
  }
}
