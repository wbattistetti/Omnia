// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { TaskType, type Task, getEditorFromTaskType } from '@types/taskTypes';
import { taskRepository } from '@services/TaskRepository';
import { createDefaultAIAgentTaskPayload } from '../../../../TaskEditor/EditorHost/editors/aiAgentEditor/createDefaultAIAgentTaskPayload';
import { resolveTaskType } from '../../../utils/taskVisuals';
import type { Row } from '@types/NodeRowTypes';
import type { NodeRowData } from '@types/project';
import { flushSemanticDraftToTaskOnTaskCreated } from '@utils/semanticValuesRowState';
import { ensureTaskExists } from '@utils/ensureTaskExists';
import { hasValidTemplateIdRef } from '@utils/taskKind';

/** DevTools: localStorage.setItem('omnia.debug.taskTreeOpener', '1') */
function isTaskTreeOpenerDebugEnabled(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('omnia.debug.taskTreeOpener') === '1';
  } catch {
    return false;
  }
}

export interface TaskTreeOpenerDependencies {
  taskEditorCtx: {
    open: (params: {
      id: string;  // ALWAYS equals row.id (which equals task.id when task exists)
      type: TaskType;
      label: string;
      taskWizardMode?: 'none' | 'adaptation' | 'full' | 'pending';
      contextualizationTemplateId?: string;
      contextualizationTemplateName?: string;
      taskLabel?: string;
    }) => void;
  };
  getProjectId?: () => string | undefined;
  /** Flow canvas id for the node row (per-flow variable namespace when opening the task editor). */
  flowCanvasId?: string;
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
   * True when the task is still a fresh standalone shell (no structure/steps yet).
   * Used to offer wizard adaptation when row heuristics reference a template.
   */
  private isPristineStandaloneTask(task: Task): boolean {
    const noTemplate = !task.templateId || task.templateId === 'UNDEFINED';
    const noSteps = !task.steps || Object.keys(task.steps).length === 0;
    const noNodes = !task.subTasks || task.subTasks.length === 0;
    return noTemplate && noSteps && noNodes;
  }

  /**
   * Opens the TaskTree editor based on the current state of the row.
   * Task is always ensured in the repository first; wizard full is UI-only (never a missing-task fallback).
   */
  async open(): Promise<TaskTreeOpenerResult> {
    try {
      const { row, taskEditorCtx, getProjectId } = this.deps;
      const taskType = resolveTaskType(row);
      const projectId = getProjectId?.() || undefined;

      // Hot-path trace is opt-in only; detailed payload allocation is expensive.
      const taskId = row.id; // row.id === task.id
      const existingTask = taskRepository.getTask(taskId);
      const traceOpen =
        import.meta.env.DEV &&
        (() => {
          try {
            return typeof localStorage !== 'undefined' && localStorage.getItem('omnia:traceTaskTreeOpen') === '1';
          } catch {
            return false;
          }
        })();
      if (traceOpen) {
        console.info('[TaskTreeOpener] open', {
          rowId: row.id,
          rowText: row.text,
          projectId,
          taskType,
          taskExists: !!existingTask,
          templateId: existingTask?.templateId ?? null,
        });
      }

      // Only handle UtteranceInterpretation (DataRequest) for now
      if (taskType !== TaskType.UtteranceInterpretation) {
        return this.handleNonDataRequestTask();
      }

      const taskForType = ensureTaskExists(row.id, {
        taskType: TaskType.UtteranceInterpretation,
        projectId,
        label: row.text || '',
      });

      const rowHeuristics = (row as any)?.heuristics;
      const metaTaskType =
        rowHeuristics?.type !== undefined && rowHeuristics?.type !== null
          ? rowHeuristics.type
          : TaskType.UNDEFINED;
      const metaTemplateId = rowHeuristics?.templateId || null;

      console.log('[🔍 TaskTreeOpener] 📊 OPEN: task ensured + heuristics', {
        rowId: row.id,
        metaTaskType,
        metaTemplateId,
        pristine: this.isPristineStandaloneTask(taskForType),
      });

      if (
        metaTemplateId &&
        metaTaskType === TaskType.UtteranceInterpretation &&
        this.isPristineStandaloneTask(taskForType)
      ) {
        return await this.handleTemplateFound(metaTemplateId, metaTaskType, projectId);
      }

      if (metaTaskType === TaskType.UNDEFINED) {
        return {
          success: false,
          error: new Error('Tipo non definito. Seleziona manualmente il tipo prima di aprire l\'editor.')
        };
      }

      return await this.handleExistingTask(taskForType);
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

    let taskTree: any = null;
    const DialogueTaskService = (await import('@services/DialogueTaskService')).default;

    const resolvedTemplate = hasValidTemplateIdRef(taskForType)
      ? DialogueTaskService.findTemplateInCache(String(taskForType.templateId).trim())
      : null;

    if (resolvedTemplate) {
      const { RowHeuristicsService } = await import('@services/RowHeuristicsService');
      const templateType = RowHeuristicsService.getTemplateType(resolvedTemplate);
      if (templateType === TaskType.UtteranceInterpretation) {
        const { buildTaskTreeFromRepository } = await import('@utils/taskUtils');
        const projectId = getProjectId?.() || undefined;
        const result = await buildTaskTreeFromRepository(row.id, projectId);
        if (result) {
          taskTree = result.taskTree;
        }
      }
    }

    const editorKind = getEditorFromTaskType(finalTaskType);
    const hasStructureNodes = !!(taskTree?.nodes && taskTree.nodes.length > 0);
    const usePendingChoice =
      editorKind === 'ddt' &&
      !hasStructureNodes &&
      this.isPristineStandaloneTask(taskForType as Task);
    const taskWizardModeForOpen = usePendingChoice ? 'pending' : 'none';

    if (usePendingChoice) {
      console.log('[ResponseEditor] Nessun embedding match — UI standard (manuale / wizard)');
    }

    taskEditorCtx.open({
      id: row.id,  // ALWAYS equals task.id
      type: finalTaskType,
      label: row.text,
      taskWizardMode: taskWizardModeForOpen,
    });

    this.dispatchTaskEditorOpenEvent({
      id: row.id,  // ALWAYS equals task.id
      type: finalTaskType,
      label: row.text,
      taskTree,
      templateId: resolvedTemplate ? taskForType.templateId : undefined,
      taskWizardMode: taskWizardModeForOpen,
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

      // ✅ CRITICAL: Reset wizard state BEFORE opening editor
      const { useWizardStore } = await import('../../../../../../TaskBuilderAIWizard/store/wizardStore');
      const wizard = useWizardStore.getState();

      // 1. Reset completo
      wizard.reset();

      // 2. Initialize from task instance (if exists) - currently does nothing, available for future use
      const existingTask = taskRepository.getTask(row.id);
      if (existingTask) {
        wizard.initializeFromInstance(existingTask);
      }

      const DialogueTaskService = (await import('@services/DialogueTaskService'))
        .default;

      if (!DialogueTaskService.isCacheLoaded()) {
        await DialogueTaskService.loadTemplates();
      }

      let template = DialogueTaskService.getTemplate(metaTemplateId);

      if (!template && projectId) {
        const { loadTemplateFromProject } = await import('@utils/taskUtils');
        const fromProject = await loadTemplateFromProject(metaTemplateId, projectId);
        if (fromProject) {
          DialogueTaskService.registerExternalTemplates([fromProject as any]);
          template = DialogueTaskService.getTemplate(metaTemplateId);
        }
      }

      console.log('[🔍 TaskTreeOpener] 🔍 DEBUG: Template lookup result', {
        metaTemplateId,
        templateFound: !!template,
        templateLabel: template?.label,
        templateType: template?.type,
        cacheLoaded: DialogueTaskService.isCacheLoaded()
      });

      if (template) {
        const templateDisplayName =
          (template.label || template.name || metaTemplateId).trim();
        console.log(
          `[ResponseEditor] Embedding match trovato: ${templateDisplayName} — opzione adattamento disponibile`
        );

        taskEditorCtx.open({
          id: row.id,
          type: metaTaskType,
          label: row.text || '',
          taskWizardMode: 'pending',
          contextualizationTemplateId: metaTemplateId,
          contextualizationTemplateName: templateDisplayName,
          taskLabel: row.text || '',
        });

        this.dispatchTaskEditorOpenEvent({
          id: row.id,
          type: metaTaskType,
          label: row.text || '',
          taskWizardMode: 'pending',
          contextualizationTemplateId: metaTemplateId,
          contextualizationTemplateName: templateDisplayName,
          taskLabel: row.text || '',
        });

        return { success: true };
      }
      console.error('[🔍 TaskTreeOpener] ❌ Template not found after cache and project load', {
        metaTemplateId,
        projectId,
        cacheLoaded: DialogueTaskService.isCacheLoaded(),
      });
    } catch (err) {
      console.error('[🔍 TaskTreeOpener] ❌ Errore caricamento template:', err);
    }

    const existing = taskRepository.getTask(row.id);
    if (existing) {
      return this.handleExistingTask(existing);
    }
    return { success: false };
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

      if (isTaskTreeOpenerDebugEnabled()) {
        console.info('[Omnia][TaskTreeOpener][LAZY] create task from row metadata', {
          rowId: row.id,
          metaTaskType,
          metaTaskTypeName: TaskType[metaTaskType],
          metaTemplateId,
        });
      }

      const initialFields: Partial<Task> | undefined =
        metaTaskType === TaskType.AIAgent
          ? (createDefaultAIAgentTaskPayload() as Partial<Task>)
          : undefined;

      taskForType = taskRepository.createTask(
        metaTaskType,
        metaTemplateId,
        initialFields,
        row.id,
        projectId
      );

      flushSemanticDraftToTaskOnTaskCreated(row as unknown as NodeRowData, row.id);

      // If there's templateId, copy steps (escalations) from template
      if (metaTemplateId) {
        if (isTaskTreeOpenerDebugEnabled()) {
          console.info('[Omnia][TaskTreeOpener][LAZY] copy steps from template', {
            templateId: metaTemplateId,
          });
        }
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
    taskWizardMode?: 'none' | 'adaptation' | 'full' | 'pending';
    contextualizationTemplateId?: string;
    contextualizationTemplateName?: string;
    taskLabel?: string;
  }): void {
    const flowId = String(this.deps.flowCanvasId ?? '').trim();
    const event = new CustomEvent('taskEditor:open', {
      detail: {
        ...detail,
        ...(flowId ? { flowId } : {}),
      },
      bubbles: true,
    });
    document.dispatchEvent(event);
  }
}
