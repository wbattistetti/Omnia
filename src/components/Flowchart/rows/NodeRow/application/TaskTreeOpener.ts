// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { TaskType } from '@types/taskTypes';
import { taskRepository } from '@services/TaskRepository';
import { resolveTaskType } from '../../../utils/taskVisuals';
import type { Row } from '@types/NodeRowTypes';

export interface TaskTreeOpenerDependencies {
  taskEditorCtx: {
    open: (params: {
      id: string;
      type: TaskType;
      label: string;
      instanceId: string;
      taskWizardMode?: 'none' | 'adaptation' | 'full';
      contextualizationTemplateId?: string;
      taskLabel?: string;
    }) => void;
  };
  getProjectId?: () => string | undefined;
  row: Row;
}

export interface TaskTreeOpenerResult {
  success: boolean;
  error?: Error;
}

/**
 * Application service for opening TaskTree editors from NodeRow.
 * Handles all the complex logic for determining taskWizardMode and opening the appropriate editor.
 */
export class TaskTreeOpener {
  constructor(private deps: TaskTreeOpenerDependencies) {}

  /**
   * Opens the TaskTree editor based on the current state of the row.
   * Determines taskWizardMode automatically:
   * - 'none': Task exists
   * - 'adaptation': Template found, no task
   * - 'full': No template, no task
   */
  async open(): Promise<TaskTreeOpenerResult> {
    try {
      const { row, taskEditorCtx, getProjectId } = this.deps;
      const taskType = resolveTaskType(row);

      // Only handle UtteranceInterpretation (DataRequest) for now
      if (taskType !== TaskType.UtteranceInterpretation) {
        return this.handleNonDataRequestTask();
      }

      // Check if task already exists
      let taskForType = row.taskId ? taskRepository.getTask(row.taskId) : null;

      // STATE 1: Task exists → taskWizardMode = 'none'
      if (taskForType) {
        return await this.handleExistingTask(taskForType);
      }

      // STATE 2/3: Task doesn't exist → determine taskWizardMode based on templateId
      const rowMeta = (row as any)?.meta;
      const metaTaskType =
        rowMeta?.type !== undefined && rowMeta?.type !== null
          ? rowMeta.type
          : TaskType.UNDEFINED;
      const metaTemplateId = rowMeta?.templateId || null;
      const projectId = getProjectId?.() || undefined;

      // STATE 2: Template found, no task → taskWizardMode = 'adaptation'
      if (metaTemplateId && metaTaskType === TaskType.UtteranceInterpretation) {
        return await this.handleTemplateFound(metaTemplateId, metaTaskType, projectId);
      }

      // STATE 3: No template, no task → taskWizardMode = 'full'
      if (
        !metaTemplateId &&
        metaTaskType === TaskType.UtteranceInterpretation &&
        row.text &&
        row.text.trim().length >= 3
      ) {
        return await this.handleNoTemplate(projectId);
      }

      // Fallback: Create base task without preview (legacy behavior)
      return await this.handleFallback(metaTaskType, metaTemplateId, projectId, rowMeta);
    } catch (error) {
      console.error('[TaskTreeOpener] Error opening editor:', error);
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  private async handleExistingTask(taskForType: any): Promise<TaskTreeOpenerResult> {
    const { row, taskEditorCtx, getProjectId } = this.deps;
    const finalTaskType = taskForType.type as TaskType;

    taskEditorCtx.open({
      id: String(row.taskId),
      type: finalTaskType,
      label: row.text,
      instanceId: row.id,
      taskWizardMode: 'none',
    });

    // Build TaskTree if necessary
    let taskTree: any = null;
    if (taskForType?.templateId && taskForType.templateId !== 'UNDEFINED') {
      const DialogueTaskService = (await import('@services/DialogueTaskService'))
        .default;
      const template = DialogueTaskService.getTemplate(taskForType.templateId);
      if (template) {
        const { RowHeuristicsService } = await import('@services/RowHeuristicsService');
        const templateType = RowHeuristicsService.getTemplateType(template);
        if (templateType === TaskType.UtteranceInterpretation) {
          const { buildTaskTree } = await import('@utils/taskUtils');
          const projectId = getProjectId?.() || undefined;
          taskTree = await buildTaskTree(taskForType, projectId);
        }
      }
    }

    this.dispatchTaskEditorOpenEvent({
      id: String(row.taskId),
      type: finalTaskType,
      label: row.text,
      taskTree,
      instanceId: row.id,
      templateId: taskForType?.templateId || undefined,
      taskWizardMode: 'none',
    });

    return { success: true };
  }

  private async handleTemplateFound(
    metaTemplateId: string,
    metaTaskType: TaskType,
    projectId: string | undefined
  ): Promise<TaskTreeOpenerResult> {
    const { row, taskEditorCtx } = this.deps;

    try {
      console.log(
        '[🔍 TaskTreeOpener] ✅ CASO 2a: Template trovato dall\'euristica, aprendo ResponseEditor direttamente',
        {
          templateId: metaTemplateId,
          rowText: row.text,
        }
      );

      const DialogueTaskService = (await import('@services/DialogueTaskService'))
        .default;

      if (!DialogueTaskService.isCacheLoaded()) {
        await DialogueTaskService.loadTemplates();
      }

      const template = DialogueTaskService.getTemplate(metaTemplateId);

      if (template) {
        // Create task from template found by heuristics
        const newTask = taskRepository.createTask(
          metaTaskType,
          metaTemplateId,
          { label: row.text || '' },
          row.id,
          projectId
        );

        // Open ResponseEditor with taskWizardMode = 'adaptation'
        taskEditorCtx.open({
          id: String(newTask.id),
          type: metaTaskType,
          label: row.text || '',
          instanceId: row.id,
          taskWizardMode: 'adaptation',
          contextualizationTemplateId: metaTemplateId,
          taskLabel: row.text || '',
        });

        // Emit event to open ResponseEditor tab
        this.dispatchTaskEditorOpenEvent({
          id: String(newTask.id),
          type: metaTaskType,
          label: row.text || '',
          instanceId: row.id,
          templateId: metaTemplateId,
          taskWizardMode: 'adaptation',
          contextualizationTemplateId: metaTemplateId,
          taskLabel: row.text || '',
        });

        return { success: true };
      }
    } catch (err) {
      console.error('[🔍 TaskTreeOpener] ❌ Errore caricamento template:', err);
      // Fallback: continue with wizard
    }

    return { success: false };
  }

  private async handleNoTemplate(
    projectId: string | undefined
  ): Promise<TaskTreeOpenerResult> {
    const { row, taskEditorCtx } = this.deps;

    console.log(
      '[🔍 TaskTreeOpener] ✅ STATO 3: Nessun template, nessun task, aprendo ResponseEditor in modalità wizard full',
      {
        label: row.text,
        labelLength: row.text.trim().length,
      }
    );

    const temporaryId = `wizard-${row.id}-${Date.now()}`;

    console.log('[🔍 TaskTreeOpener][STATO 3] Aprendo ResponseEditor con taskWizardMode = "full"', {
      temporaryId,
      rowId: row.id,
      label: row.text,
      taskWizardMode: 'full',
    });

    taskEditorCtx.open({
      id: temporaryId,
      type: TaskType.UtteranceInterpretation,
      label: row.text || '',
      instanceId: row.id,
      taskWizardMode: 'full',
      taskLabel: row.text || '',
    });

    console.log(
      '[🔍 TaskTreeOpener][STATO 3] Emettendo evento taskEditor:open con taskWizardMode = "full"',
      {
        temporaryId,
        taskWizardMode: 'full',
      }
    );

    this.dispatchTaskEditorOpenEvent({
      id: temporaryId,
      type: TaskType.UtteranceInterpretation,
      label: row.text || '',
      instanceId: row.id,
      taskWizardMode: 'full',
      taskLabel: row.text || '',
    });

    return { success: true };
  }

  private async handleFallback(
    metaTaskType: TaskType,
    metaTemplateId: string | null,
    projectId: string | undefined,
    rowMeta: any
  ): Promise<TaskTreeOpenerResult> {
    const { row, taskEditorCtx, getProjectId } = this.deps;

    const inferredCategory = rowMeta?.inferredCategory || null;

    console.log('🆕 [TaskTreeOpener][LAZY] Creando task usando metadati riga', {
      rowId: row.id,
      metaTaskType,
      metaTaskTypeName: TaskType[metaTaskType],
      metaTemplateId,
      inferredCategory: inferredCategory || null,
    });

    let initialTaskData: any = { label: row.text || '' };

    // CASE 1: If there's inferredCategory (problem-classification, choice, confirmation)
    if (inferredCategory && metaTaskType === TaskType.UtteranceInterpretation) {
      const { v4: uuidv4 } = await import('uuid');
      const {
        getdataLabelForCategory,
        getDefaultValuesForCategory,
        getCurrentProjectLocale,
      } = await import('@utils/categoryPresets');

      initialTaskData.category = inferredCategory;
      initialTaskData.templateId = null;

      const projectLocale = getCurrentProjectLocale();
      const categorydataLabel = getdataLabelForCategory(inferredCategory, projectLocale);

      if (categorydataLabel) {
        const defaultValues = getDefaultValuesForCategory(inferredCategory, projectLocale);

        initialTaskData.data = [
          {
            id: uuidv4(),
            label: categorydataLabel,
            kind: 'generic',
            ...(defaultValues ? { values: defaultValues } : {}),
            subData: [],
            steps: {
              start: {
                escalations: [
                  {
                    tasks: [],
                  },
                ],
              },
            },
          },
        ];

        console.log('✅ [TaskTreeOpener][LAZY] TaskTree creato automaticamente da inferredCategory', {
          category: inferredCategory,
          dataLabel: categorydataLabel,
          hasDefaultValues: !!defaultValues,
        });
      }
    }
    // CASE 2: If there's no category but there's templateId → use template
    else if (metaTemplateId && metaTaskType === TaskType.UtteranceInterpretation) {
      initialTaskData.templateId = metaTemplateId;
      console.log('✅ [TaskTreeOpener][LAZY] Task creato con templateId, data sarà caricato dal template', {
        templateId: metaTemplateId,
      });
    }
    // CASE 3: If there's neither category nor template → open external wizard (don't create task)
    else {
      console.log('✅ [TaskTreeOpener][EXTERNAL_WIZARD] Aprendo wizard esterno (nessun template/categoria)', {
        rowId: row.id,
        rowText: row.text,
      });

      const wizardEvent = new CustomEvent('taskTreeWizard:open', {
        detail: {
          taskLabel: row.text || '',
          taskType:
            metaTaskType === TaskType.UNDEFINED
              ? TaskType.UtteranceInterpretation
              : metaTaskType,
          initialTaskTree: undefined,
          startOnStructure: false,
          rowId: row.id,
          instanceId: row.id,
        },
        bubbles: true,
      });
      document.dispatchEvent(wizardEvent);
      return { success: true };
    }

    // Create base task (with TaskTree if inferredCategory present) - only if there's category or template
    const newTask = taskRepository.createTask(
      metaTaskType,
      metaTemplateId,
      initialTaskData,
      row.id,
      projectId
    );

    let taskForType = newTask;

    // If there's templateId, use centralized function to clone and adapt
    if (metaTemplateId) {
      console.log('[🔍 TaskTreeOpener][LAZY] Clonando struttura dal template', {
        rowId: row.id,
        taskId: row.id,
        templateId: metaTemplateId,
        taskLabel: taskForType?.label,
      });

      try {
        const { loadAndAdaptTaskTreeForExistingTask } = await import(
          '@utils/taskTreeManager'
        );

        const { taskTree, adapted } = await loadAndAdaptTaskTreeForExistingTask(
          taskForType,
          projectId
        );

        console.log(
          '[🔍 TaskTreeOpener][LAZY] TaskTree ricevuto da loadAndAdaptTaskTreeForExistingTask',
          {
            rowId: row.id,
            taskId: row.id,
            taskTreeStepsKeys: Object.keys(taskTree.steps || {}),
            taskTreeStepsCount: Object.keys(taskTree.steps || {}).length,
            mainNodesTemplateIds:
              taskTree.nodes?.map((n: any) => ({
                id: n.id,
                templateId: n.templateId,
                label: n.label,
              })) || [],
            adapted,
          }
        );

        taskRepository.updateTask(
          row.id,
          {
            steps: taskTree.steps,
            metadata: {
              promptsAdapted: adapted || taskForType?.metadata?.promptsAdapted === true,
            },
          },
          projectId
        );

        console.log('[🔍 TaskTreeOpener][LAZY] ✅ Task salvato con steps', {
          rowId: row.id,
          taskId: row.id,
          stepsCount: Object.keys(taskTree.steps || {}).length,
          stepsKeys: Object.keys(taskTree.steps || {}),
          promptsAdapted: adapted || taskForType?.metadata?.promptsAdapted === true,
        });
      } catch (err) {
        console.error('[🔍 TaskTreeOpener][LAZY] ❌ Errore durante clonazione/adattamento', err);
      }
    }

    const finalTaskType = taskForType
      ? (taskForType.type as TaskType)
      : ((row as any)?.meta?.type || TaskType.UtteranceInterpretation);

    taskEditorCtx.open({
      id: String(row.id),
      type: finalTaskType,
      label: row.text,
      instanceId: row.id,
    });

    // Build TaskTree only for DataRequest
    let taskTree: any = null;

    if (taskForType?.templateId && taskForType.templateId !== 'UNDEFINED') {
      const DialogueTaskService = (await import('@services/DialogueTaskService'))
        .default;
      const template = DialogueTaskService.getTemplate(taskForType.templateId);

      if (template) {
        const { RowHeuristicsService } = await import('@services/RowHeuristicsService');
        const templateType = RowHeuristicsService.getTemplateType(template);

        if (templateType === TaskType.UtteranceInterpretation) {
          const { buildTaskTree } = await import('@utils/taskUtils');
          const projectId = getProjectId?.() || undefined;
          taskTree = await buildTaskTree(taskForType, projectId);
          if (!taskTree) {
            taskTree = {
              label: taskForType.label || row.text || 'New Task',
              nodes: [],
            };
          }
        } else {
          taskTree = null;
        }
      } else {
        taskTree = null;
      }
    }

    this.dispatchTaskEditorOpenEvent({
      id: String(row.id),
      type: finalTaskType,
      label: row.text,
      taskTree,
      instanceId: row.id,
      templateId: taskForType?.templateId || undefined,
    });

    return { success: true };
  }

  private async handleNonDataRequestTask(): Promise<TaskTreeOpenerResult> {
    const { row, taskEditorCtx, getProjectId } = this.deps;

    let taskForType = row.taskId ? taskRepository.getTask(row.taskId) : null;

    // If task doesn't exist, create it using row metadata
    if (!taskForType) {
      const rowMeta = (row as any)?.meta;
      const metaTaskType = rowMeta?.type || resolveTaskType(row) || TaskType.SayMessage;
      const metaTemplateId = rowMeta?.templateId || null;
      const projectId = getProjectId?.() || undefined;

      console.log('🆕 [TaskTreeOpener][LAZY] Creando task usando metadati riga', {
        rowId: row.id,
        metaTaskType,
        metaTaskTypeName: TaskType[metaTaskType],
        metaTemplateId,
      });

      taskForType = taskRepository.createTask(
        metaTaskType,
        metaTemplateId,
        metaTaskType === TaskType.SayMessage ? { text: row.text || '' } : undefined,
        row.id,
        projectId
      );

      // If there's templateId, copy steps (escalations) from template
      if (metaTemplateId) {
        console.log('📋 [TaskTreeOpener][LAZY] Copiando steps dal template', {
          templateId: metaTemplateId,
        });
        const DialogueTaskService = (await import('@services/DialogueTaskService'))
          .default;
        const template = DialogueTaskService.getTemplate(metaTemplateId);

        if (template) {
          const { buildTaskTreeNodes } = await import('@utils/taskUtils');
          const nodes = buildTaskTreeNodes(template);
          // Note: data is not saved - structure is rebuilt at runtime from template.subTasksIds
        }
      }
    }

    const taskType = taskForType
      ? (taskForType.type as TaskType)
      : ((row as any)?.meta?.type || resolveTaskType(row) || TaskType.SayMessage);

    const { getEditorFromTaskType } = await import('@types/taskTypes');
    const editorKind = getEditorFromTaskType(taskType);

    taskEditorCtx.open({
      id: String(row.id),
      type: taskType,
      label: row.text,
      instanceId: row.id,
    });

    // Only for DataRequest (editorKind === 'ddt'), prepare TaskTree and emit event
    if (editorKind === 'ddt' && taskType === TaskType.UtteranceInterpretation) {
      let taskTree: any = null;

      if (taskForType?.templateId && taskForType.templateId !== 'UNDEFINED') {
        const DialogueTaskService = (await import('@services/DialogueTaskService'))
          .default;
        const template = DialogueTaskService.getTemplate(taskForType.templateId);

        if (template) {
          const { RowHeuristicsService } = await import('@services/RowHeuristicsService');
          const templateType = RowHeuristicsService.getTemplateType(template);

          if (templateType === TaskType.UtteranceInterpretation) {
            const { buildTaskTree } = await import('@utils/taskUtils');
            const projectId = getProjectId?.() || undefined;
            taskTree = await buildTaskTree(taskForType, projectId);
            if (!taskTree) {
              taskTree = {
                label: taskForType.label || row.text || 'New Task',
                nodes: [],
              };
            }
          } else {
            taskTree = null;
          }
        } else {
          taskTree = null;
        }
      }

      this.dispatchTaskEditorOpenEvent({
        id: String(row.id),
        type: taskType,
        label: row.text,
        taskTree,
        instanceId: row.id,
        templateId: taskForType?.templateId || undefined,
      });
    } else {
      // For other types, emit event without TaskTree
      this.dispatchTaskEditorOpenEvent({
        id: String(row.id),
        type: taskType,
        label: row.text,
        instanceId: row.id,
      });
    }

    return { success: true };
  }

  private dispatchTaskEditorOpenEvent(detail: {
    id: string;
    type: TaskType;
    label: string;
    taskTree?: any;
    instanceId: string;
    templateId?: string;
    taskWizardMode?: 'none' | 'adaptation' | 'full';
    contextualizationTemplateId?: string;
    taskLabel?: string;
  }): void {
    const event = new CustomEvent('taskEditor:open', {
      detail,
      bubbles: true,
    });
    document.dispatchEvent(event);
  }
}
