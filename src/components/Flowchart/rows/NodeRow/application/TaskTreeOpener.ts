// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { TaskType } from '@types/taskTypes';
import { taskRepository } from '@services/TaskRepository';
import { resolveTaskType } from '../../../utils/taskVisuals';
import type { Row } from '@types/NodeRowTypes';

export interface TaskTreeOpenerDependencies {
  taskEditorCtx: {
    open: (params: {
      id: string;  // ALWAYS equals row.id (which equals task.id when task exists)
      type: TaskType;
      label: string;
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
      const projectId = getProjectId?.() || undefined;

      // ✅ CRITICAL: Log repository state and check if instance should exist
      const allTasksBefore = taskRepository.getAllTasks();
      const taskInRepository = taskRepository.getTask(row.id);
      const matchingTask = allTasksBefore.find(t => t.id === row.id);

      console.log('[TaskTreeOpener] 🔍 CHECKING FOR INSTANCE', {
        projectId,
        rowId: row.id,
        rowIdLength: row.id.length,
        rowText: row.text,
        repositorySize: allTasksBefore.length,
        allTaskIds: allTasksBefore.map(t => t.id),
        matchingTaskFound: !!matchingTask,
        matchingTaskDetails: matchingTask ? {
          id: matchingTask.id,
          idLength: matchingTask.id.length,
          templateId: matchingTask.templateId,
          type: matchingTask.type,
          hasSteps: matchingTask.steps ? Object.keys(matchingTask.steps).length > 0 : false,
          label: matchingTask.label,
        } : null,
        timestamp: new Date().toISOString(),
      });

      // ✅ LOG: OPEN TRACE - START
      console.log('[TaskTreeOpener] 🔍 OPEN TRACE - START - SUMMARY', {
        rowId: row.id,
        rowText: row.text,
        taskType: taskType,
        projectId: projectId,
        foundTask: !!taskInRepository,
        foundMatchingTask: !!matchingTask,
        totalTasksInRepository: allTasksBefore.length,
        rowIdInTaskIds: allTasksBefore.some(t => t.id === row.id),
        timestamp: new Date().toISOString(),
      });

      // ✅ EXPANDED LOGS: Mostra tutti i dati completi
      console.log('[TaskTreeOpener] 🔍 ROW DETAILS', {
        rowId: row.id,
        rowText: row.text,
        rowIdLength: row.id.length,
      });

      console.log('[TaskTreeOpener] 🔍 TASK IN REPOSITORY (by row.id)', taskInRepository ? {
        id: taskInRepository.id,
        idLength: taskInRepository.id.length,
        templateId: taskInRepository.templateId,
        type: taskInRepository.type,
        hasSteps: taskInRepository.steps ? Object.keys(taskInRepository.steps).length > 0 : false,
        stepsKeys: taskInRepository.steps ? Object.keys(taskInRepository.steps) : [],
        label: taskInRepository.label || taskInRepository.value?.label,
        idsMatch: taskInRepository.id === row.id,
      } : null);

      console.log('[TaskTreeOpener] 🔍 ALL TASK IDs IN REPOSITORY', allTasksBefore.map(t => t.id));
      console.log('[TaskTreeOpener] 🔍 ALL TASK DETAILS IN REPOSITORY', allTasksBefore.map(t => ({
        id: t.id,
        idLength: t.id.length,
        templateId: t.templateId,
        type: t.type,
        label: t.label || t.value?.label,
        idMatchesRowId: t.id === row.id,
        idEqualsRowId: t.id === row.id,
        idStartsWithRowId: t.id.startsWith(row.id.split('-')[0]),
      })));

      if (matchingTask) {
        console.log('[TaskTreeOpener] 🔍 MATCHING TASK FOUND', {
          id: matchingTask.id,
          idLength: matchingTask.id.length,
          templateId: matchingTask.templateId,
          type: matchingTask.type,
          label: matchingTask.label || matchingTask.value?.label,
          hasSteps: matchingTask.steps ? Object.keys(matchingTask.steps).length > 0 : false,
          idsMatch: matchingTask.id === row.id,
        });
      } else {
        console.log('[TaskTreeOpener] 🔍 NO MATCHING TASK FOUND - Searching for similar IDs...');
        // Cerca task con ID simili (per debugging)
        const similarTasks = allTasksBefore.filter(t => {
          const rowIdBase = row.id.split('-')[0];
          const taskIdBase = t.id.split('-')[0];
          return rowIdBase === taskIdBase || t.id.includes(rowIdBase) || row.id.includes(taskIdBase);
        });
        if (similarTasks.length > 0) {
          console.log('[TaskTreeOpener] 🔍 SIMILAR TASK IDs FOUND', similarTasks.map(t => ({
            id: t.id,
            idLength: t.id.length,
            templateId: t.templateId,
            type: t.type,
            label: t.label || t.value?.label,
            rowIdBase: row.id.split('-')[0],
            taskIdBase: t.id.split('-')[0],
          })));
        } else {
          console.log('[TaskTreeOpener] 🔍 NO SIMILAR TASK IDs FOUND', {
            rowId: row.id,
            rowIdBase: row.id.split('-')[0],
            allTaskIdBases: allTasksBefore.map(t => t.id.split('-')[0]),
          });
        }
      }

      // Only handle UtteranceInterpretation (DataRequest) for now
      if (taskType !== TaskType.UtteranceInterpretation) {
        return this.handleNonDataRequestTask();
      }

      // Check if task already exists - ALWAYS use row.id (task.id === row.id)
      let taskForType = taskRepository.getTask(row.id);

      console.log('[🔍 TaskTreeOpener] 📊 DEBUG: Verifica stato task', {
        rowId: row.id,
        rowText: row.text,
        taskExists: !!taskForType,
        taskId: taskForType?.id,
        taskTemplateId: taskForType?.templateId,
        taskPromptsAdapted: taskForType?.metadata?.promptsAdapted
      });

      // STATE 1: Task exists → taskWizardMode = 'none'
      if (taskForType) {
        console.log('[🔍 TaskTreeOpener] ✅ STATE 1: Task esiste → taskWizardMode = "none"', {
          taskId: taskForType.id,
          taskTemplateId: taskForType.templateId,
          promptsAdapted: taskForType.metadata?.promptsAdapted
        });
        return await this.handleExistingTask(taskForType);
      }

      // STATE 2/3: Task doesn't exist → determine taskWizardMode based on templateId
      const rowHeuristics = (row as any)?.heuristics;
      const metaTaskType =
        rowHeuristics?.type !== undefined && rowHeuristics?.type !== null
          ? rowHeuristics.type
          : TaskType.UNDEFINED;
      const metaTemplateId = rowHeuristics?.templateId || null;

      console.log('[🔍 TaskTreeOpener] 📊 DEBUG: Euristica trovata', {
        rowId: row.id,
        rowText: row.text,
        metaTaskType,
        metaTemplateId,
        hasHeuristics: !!rowHeuristics,
        heuristicsKeys: rowHeuristics ? Object.keys(rowHeuristics) : []
      });

      // STATE 2: Template found, no task → taskWizardMode = 'adaptation'
      if (metaTemplateId && metaTaskType === TaskType.UtteranceInterpretation) {
        console.log('[🔍 TaskTreeOpener] ✅ STATE 2: Template trovato, task NON esiste → taskWizardMode = "adaptation"', {
          rowId: row.id,
          rowText: row.text,
          metaTemplateId,
          metaTaskType
        });
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
      return await this.handleFallback(metaTaskType, metaTemplateId, projectId, rowHeuristics);
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
      id: row.id,  // ALWAYS equals task.id
      type: finalTaskType,
      label: row.text,
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
      id: row.id,  // ALWAYS equals task.id
      type: finalTaskType,
      label: row.text,
      taskTree,
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
          rowId: row.id,
        }
      );

      const DialogueTaskService = (await import('@services/DialogueTaskService'))
        .default;

      if (!DialogueTaskService.isCacheLoaded()) {
        await DialogueTaskService.loadTemplates();
      }

      const template = DialogueTaskService.getTemplate(metaTemplateId);

      if (template) {
        console.log('[🔍 TaskTreeOpener] 📋 Template caricato, creando task...', {
          templateId: metaTemplateId,
          templateLabel: template.label || template.name,
          rowId: row.id,
          rowText: row.text
        });

        // Create task from template found by heuristics
        const newTask = taskRepository.createTask(
          metaTaskType,
          metaTemplateId,
          { label: row.text || '' },
          row.id,
          projectId
        );

        console.log('[🔍 TaskTreeOpener] ✅ Task creato, aprendo ResponseEditor con taskWizardMode = "adaptation"', {
          taskId: newTask.id,
          taskTemplateId: newTask.templateId,
          taskLabel: newTask.label,
          taskWizardMode: 'adaptation',
          contextualizationTemplateId: metaTemplateId,
          taskLabel: row.text || ''
        });

        // Open ResponseEditor with taskWizardMode = 'adaptation'
        taskEditorCtx.open({
          id: row.id,  // ALWAYS equals task.id
          type: metaTaskType,
          label: row.text || '',
          taskWizardMode: 'adaptation',
          contextualizationTemplateId: metaTemplateId,
          taskLabel: row.text || '',
        });

        // Emit event to open ResponseEditor tab
        this.dispatchTaskEditorOpenEvent({
          id: row.id,  // ALWAYS equals task.id
          type: metaTaskType,
          label: row.text || '',
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
        rowId: row.id,
      }
    );

    // ✅ CRITICAL: Use row.id as task ID (task.id === row.id ALWAYS)
    // The wizard will create the task with this ID when completed
    // ✅ NOTE: taskWizardMode is just a flag - orchestrator controls when wizard actually starts
    // TaskTreeOpener does NOT start the wizard directly - it only sets the flag
    // The orchestrator (via useWizardIntegrationOrchestrated) will start the wizard when it sees taskWizardMode === 'full'
    taskEditorCtx.open({
      id: row.id,  // ALWAYS equals task.id (wizard will create task with this ID)
      type: TaskType.UtteranceInterpretation,
      label: row.text || '',
      taskWizardMode: 'full', // ✅ Flag only - orchestrator controls actual wizard start
      taskLabel: row.text || '',
    });

    console.log(
      '[🔍 TaskTreeOpener][STATO 3] Emettendo evento taskEditor:open con taskWizardMode = "full"',
      {
        rowId: row.id,
        taskWizardMode: 'full',
      }
    );

    this.dispatchTaskEditorOpenEvent({
      id: row.id,  // ALWAYS equals task.id (wizard will create task with this ID)
      type: TaskType.UtteranceInterpretation,
      label: row.text || '',
      taskWizardMode: 'full',
      taskLabel: row.text || '',
    });

    return { success: true };
  }

  private async handleFallback(
    metaTaskType: TaskType,
    metaTemplateId: string | null,
    projectId: string | undefined,
    rowHeuristics: any
  ): Promise<TaskTreeOpenerResult> {
    const { row, taskEditorCtx, getProjectId } = this.deps;

    const inferredCategory = rowHeuristics?.inferredCategory || null;

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
          rowId: row.id,  // ALWAYS equals task.id
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
      : ((row as any)?.heuristics?.type || TaskType.UtteranceInterpretation);

    taskEditorCtx.open({
      id: row.id,  // ALWAYS equals task.id
      type: finalTaskType,
      label: row.text,
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
      id: row.id,  // ALWAYS equals task.id
      type: finalTaskType,
      label: row.text,
      taskTree,
      templateId: taskForType?.templateId || undefined,
    });

    return { success: true };
  }

  private async handleNonDataRequestTask(): Promise<TaskTreeOpenerResult> {
    const { row, taskEditorCtx, getProjectId } = this.deps;

    // Check if task exists - ALWAYS use row.id (task.id === row.id)
    let taskForType = taskRepository.getTask(row.id);

    // If task doesn't exist, create it using row heuristics
    if (!taskForType) {
      const rowHeuristics = (row as any)?.heuristics;
      const metaTaskType = rowHeuristics?.type || resolveTaskType(row) || TaskType.SayMessage;
      const metaTemplateId = rowHeuristics?.templateId || null;
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
      : ((row as any)?.heuristics?.type || resolveTaskType(row) || TaskType.SayMessage);

    const { getEditorFromTaskType } = await import('@types/taskTypes');
    const editorKind = getEditorFromTaskType(taskType);

    taskEditorCtx.open({
      id: row.id,  // ALWAYS equals task.id
      type: taskType,
      label: row.text,
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
        id: row.id,  // ALWAYS equals task.id
        type: taskType,
        label: row.text,
        taskTree,
        templateId: taskForType?.templateId || undefined,
      });
    } else {
      // For other types, emit event without TaskTree
      this.dispatchTaskEditorOpenEvent({
        id: row.id,  // ALWAYS equals task.id
        type: taskType,
        label: row.text,
      });
    }

    return { success: true };
  }

  private dispatchTaskEditorOpenEvent(detail: {
    id: string;  // ALWAYS equals row.id (which equals task.id when task exists)
    type: TaskType;
    label: string;
    taskTree?: any;
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
