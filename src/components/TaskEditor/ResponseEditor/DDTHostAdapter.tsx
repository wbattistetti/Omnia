import React from 'react';
import type { EditorProps } from '../EditorHost/types';
import ResponseEditor from './index';
import { taskRepository } from '../../../services/TaskRepository';
import { useProjectDataUpdate } from '../../../context/ProjectDataContext';
import { flowchartVariablesService } from '../../../services/FlowchartVariablesService';
import { getTemplateId } from '../../../utils/taskHelpers';
import { buildTaskTree } from '../../../utils/taskUtils';
import { TaskType, taskIdToTaskType, getEditorFromTaskType } from '../../../types/taskTypes';
import type { TaskTree } from '../../../types/taskTypes';

export default function DDTHostAdapter({ task: taskMeta, onClose, hideHeader, onToolbarUpdate, registerOnClose }: EditorProps) { // ✅ PATTERN CENTRALIZZATO: Accetta hideHeader e onToolbarUpdate
  // ✅ ARCHITETTURA ESPERTO: Verifica che questo componente sia usato solo per DDT
  // Se il task è di tipo Message, questo componente NON dovrebbe essere montato
  if (taskMeta?.type !== undefined && taskMeta.type !== null) {
    const editorKind = getEditorFromTaskType(taskMeta.type);
    if (editorKind === 'message') {
      console.error('❌ [DDTHostAdapter] ERRORE CRITICO: Questo componente è stato montato per un task Message!', {
        taskId: taskMeta.id,
        taskType: taskMeta.type,
        taskTypeName: TaskType[taskMeta.type],
        editorKind,
        taskLabel: taskMeta.label
      });
      return (
        <div className="h-full w-full bg-red-900 text-white p-4 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-bold mb-2">Errore Architetturale</h2>
            <p>DDTHostAdapter montato per task Message</p>
            <p className="text-sm mt-2">Task Type: {TaskType[taskMeta.type]} ({taskMeta.type})</p>
            <p className="text-sm">Dovrebbe usare TextMessageEditor invece</p>
          </div>
        </div>
      );
    }
  }
  // Ottieni projectId corrente per salvare le istanze nel progetto corretto
  const pdUpdate = useProjectDataUpdate();
  const currentProjectId = pdUpdate?.getCurrentProjectId() || null;
  const instanceKey = React.useMemo(() => taskMeta.instanceId || taskMeta.id, [taskMeta.instanceId, taskMeta.id]); // ✅ RINOMINATO: act → taskMeta

  // ✅ FIX: Carica task in modo sincrono nel render iniziale (getTask è sincrono)
  // Non usare useTaskInstance che introduce delay inutile con useEffect
  const fullTask = React.useMemo(() => {
    if (!instanceKey) return null;
    try {
      const loaded = taskRepository.getTask(instanceKey);

      return loaded;
    } catch (error) {
      console.error('[DDTHostAdapter] Error loading task:', error);
      return null;
    }
  }, [instanceKey]);

  // ✅ TaskTree state (sostituisce ddt)
  const [taskTree, setTaskTree] = React.useState<TaskTree | null>(null);
  const [taskTreeLoading, setTaskTreeLoading] = React.useState(true);

  // ✅ ARCHITETTURA ESPERTO: Carica TaskTree async usando buildTaskTree
  React.useEffect(() => {
    const loadTaskTree = async () => {
      if (!fullTask) {
        setTaskTreeLoading(false);
        return;
      }

      try {
        setTaskTreeLoading(true);

        // ✅ Usa buildTaskTree per costruire TaskTree da template + instance
        const tree = await buildTaskTree(fullTask, currentProjectId || undefined);

        // ✅ TaskTree caricato
        if (tree) {
          setTaskTree(tree);

          console.log('[🔍 DDTHostAdapter] ✅ TaskTree caricato', {
            taskId: fullTask.id,
            taskTreeNodesLength: tree.nodes?.length || 0,
            mainNodesTemplateIds: tree.nodes?.map((n: any) => ({
              id: n.id,
              templateId: n.templateId,
              label: n.label
            })) || [],
            hasSteps: !!tree.steps,
            stepsType: typeof tree.steps,
            stepsKeys: tree.steps ? Object.keys(tree.steps) : []
          });
        } else {
          setTaskTree(null);
        }
      } catch (error) {
        console.error('[DDTHostAdapter] Error loading TaskTree:', error);
        setTaskTree(null);
      } finally {
        setTaskTreeLoading(false);
      }
    };

    loadTaskTree();
  }, [fullTask, currentProjectId]);

  // ✅ ARCHITETTURA ESPERTO: Loading solo se serve async
  const loading = taskTreeLoading;

  // 3. Quando completi il wizard, salva nel Task E aggiorna lo state
  const handleComplete = React.useCallback(async (finalDDTOrTaskTree: any) => {
    // ✅ NUOVO: Supporta sia DDT (backward compatibility) che TaskTree
    const finalTaskTree: TaskTree = finalDDTOrTaskTree.nodes
      ? finalDDTOrTaskTree as TaskTree
      : {
          label: finalDDTOrTaskTree.label || '',
          nodes: finalDDTOrTaskTree.data || [],
          steps: finalDDTOrTaskTree.steps || {},
          constraints: finalDDTOrTaskTree.constraints,
          dataContract: finalDDTOrTaskTree.dataContract,
          introduction: finalDDTOrTaskTree.introduction
        };

    console.log('[DDTHostAdapter][handleComplete] 🔍 finalTaskTree received', {
      instanceKey,
      hasTaskTree: !!finalTaskTree,
      nodesLength: finalTaskTree.nodes?.length || 0,
      hasSteps: !!finalTaskTree.steps,
      stepsKeys: finalTaskTree.steps ? Object.keys(finalTaskTree.steps) : []
    });

    // ✅ Salva TaskTree nel Task usando extractTaskOverrides
    const hasTaskTree = finalTaskTree && Object.keys(finalTaskTree).length > 0 && finalTaskTree.nodes && finalTaskTree.nodes.length > 0;
    if (hasTaskTree) {
      // ✅ DEBUG: Verifica taskInstance prima del salvataggio
      let taskInstance = taskRepository.getTask(instanceKey);
      console.log('[DDTHostAdapter][handleComplete] 🔍 taskInstance before save', {
        instanceKey,
        hasTaskInstance: !!taskInstance,
        taskInstanceHasSteps: !!taskInstance?.steps,
        taskInstanceStepsKeys: taskInstance?.steps ? Object.keys(taskInstance.steps) : [],
        taskInstanceStepsCount: taskInstance?.steps ? Object.keys(taskInstance.steps).length : 0
      });

      // ✅ NUOVO: Usa extractTaskOverrides per salvare solo override
      if (taskInstance && currentProjectId) {
        const { extractTaskOverrides } = await import('../../../utils/taskUtils');
        const overrides = await extractTaskOverrides(taskInstance, finalTaskTree, currentProjectId);

        // ✅ Aggiorna task con solo override
        if (overrides.label !== undefined) taskInstance.label = overrides.label;
        if (overrides.steps !== undefined) taskInstance.steps = overrides.steps;
        if (overrides.introduction !== undefined) taskInstance.introduction = overrides.introduction;
        // ❌ NON salvare: constraints, dataContract (vengono dal template)

        taskInstance.type = TaskType.UtteranceInterpretation;
        taskInstance.updatedAt = new Date();

        // ✅ Salva nel database
        await taskRepository.updateTask(instanceKey, overrides, currentProjectId);
      } else if (!taskInstance) {
        // ✅ Task non esiste, crealo (extractTaskOverrides crea automaticamente il template se necessario)
        const { extractTaskOverrides } = await import('../../../utils/taskUtils');
        const tempTask: Task = {
          id: instanceKey,
          type: TaskType.UtteranceInterpretation,
          templateId: null,  // Verrà creato automaticamente da extractTaskOverrides
          label: finalTaskTree.label,
          steps: finalTaskTree.steps
        };
        const overrides = await extractTaskOverrides(tempTask, finalTaskTree, currentProjectId || undefined);

        taskRepository.createTask(
          TaskType.UtteranceInterpretation,
          tempTask.templateId,  // Ora ha templateId dopo extractTaskOverrides
          overrides,
          instanceKey,
          currentProjectId || undefined
        );
      }

      // ✅ DEBUG: Verifica task salvato dopo il salvataggio
      const savedTask = taskRepository.getTask(instanceKey);
      console.log('[DDTHostAdapter][handleComplete] ✅ Task saved', {
        instanceKey,
        savedTaskHasSteps: !!savedTask?.steps,
        savedTaskStepsKeys: savedTask?.steps ? Object.keys(savedTask.steps) : [],
        savedTaskStepsCount: savedTask?.steps ? Object.keys(savedTask.steps).length : 0,
        templateId: savedTask?.templateId
      });
    }

    // ✅ NEW: Extract variables from TaskTree structure
    try {
      if (currentProjectId && finalTaskTree) {
        await flowchartVariablesService.init(currentProjectId);

        // Get row text from task (this is the label of the row)
        const taskInstance = taskRepository.getTask(instanceKey);
        const rowText = taskInstance?.text || taskMeta.label || 'Task';

        // ✅ BACKWARD COMPATIBILITY: Converti TaskTree in DDT per extractVariablesFromDDT
        const ddtForVariables = {
          label: finalTaskTree.label,
          data: finalTaskTree.nodes,
          steps: finalTaskTree.steps
        };

        // Extract variables from DDT using row text and DDT labels
        const varNames = await flowchartVariablesService.extractVariablesFromDDT(
          ddtForVariables,
          instanceKey, // taskId
          instanceKey, // rowId (same as taskId)
          rowText, // Row text (e.g., "chiedi data di nascita")
          undefined // nodeId (not available here)
        );

        // Emit event to refresh ConditionEditor variables
        try {
          document.dispatchEvent(new CustomEvent('flowchart:variablesUpdated', {
            bubbles: true
          }));
        } catch {}
      }
    } catch (e) {
      // Failed to extract variables from TaskTree
    }

    // ✅ ARCHITETTURA ESPERTO: Aggiorna immediatamente taskTree e ddt per aggiornare i props
    // ✅ Aggiorna taskTree
    setTaskTree(finalTaskTree);
  }, [instanceKey, currentProjectId, taskMeta.label]);

  // ✅ ARCHITETTURA ESPERTO: Ensure nodes is always an array before passing to ResponseEditor
  const safeTaskTree = React.useMemo(() => {
    if (!taskTree) {
      return null;
    }
    const safe = {
      ...taskTree,
      nodes: Array.isArray(taskTree.nodes) ? taskTree.nodes : []
    };
    return safe;
  }, [taskTree, loading]);

  // ✅ Stable key per impedire re-mount durante l'editing
  const editorKey = React.useMemo(() => {
    const instanceKey = taskMeta.instanceId || taskMeta.id || 'unknown';
    return `response-editor-${instanceKey}`;
  }, [taskMeta.instanceId, taskMeta.id]);

  // ✅ ARCHITETTURA ESPERTO: Passa Task completo invece di TaskMeta
  // ✅ Stable callbacks per evitare re-render
  const stableOnClose = React.useCallback(() => {
    try {
      onClose && onClose();
    } catch {}
  }, [onClose]);

  const stableOnWizardComplete = React.useCallback((finalTaskTree: TaskTree) => {
    handleComplete(finalTaskTree);
  }, [handleComplete]);

  return (
    <ResponseEditor
      key={editorKey}
      taskTree={safeTaskTree}
      onClose={stableOnClose}
      onWizardComplete={stableOnWizardComplete}
      task={fullTask} // ✅ ARCHITETTURA ESPERTO: Task completo, non TaskMeta
      isTaskTreeLoading={loading} // ✅ ARCHITETTURA ESPERTO: Stato di loading
      hideHeader={hideHeader} // ✅ PATTERN CENTRALIZZATO: Passa hideHeader al wrapper
      onToolbarUpdate={onToolbarUpdate} // ✅ PATTERN CENTRALIZZATO: Passa onToolbarUpdate per ereditare header
      registerOnClose={registerOnClose} // ✅ Passa registerOnClose per gestire chiusura con controllo contracts
    />
  );
}


