import React from 'react';
import type { EditorProps } from '@taskEditor/EditorHost/types';
import ResponseEditor from '@responseEditor/index';
import { taskRepository } from '@services/TaskRepository';
import { useProjectDataUpdate } from '@context/ProjectDataContext';
import { getTemplateId } from '@utils/taskHelpers';
import { materializeTaskFromRepository } from '@utils/MaterializationOrchestrator';
import { TaskType, taskIdToTaskType, getEditorFromTaskType } from '@types/taskTypes';
import type { Task, TaskTree } from '@types/taskTypes';
import { useTaskTreeStore, useTaskTreeVersion } from '@responseEditor/core/state';

/**
 * When materializeTaskFromRepository returns null or throws, still show an editable shell
 * so Behaviour can sync from taskTree.steps / repository (empty nodes until user adds root).
 */
function buildMinimalTaskTreeFromTask(task: Task): TaskTree {
  const steps =
    task.steps && typeof task.steps === 'object' && !Array.isArray(task.steps) ? { ...task.steps } : {};
  const labelText =
    typeof task.labelKey === 'string'
      ? task.labelKey
      : typeof task.label === 'string'
        ? task.label
        : '';
  return {
    labelKey: labelText || 'task',
    label: typeof task.label === 'string' ? task.label : undefined,
    nodes: [],
    steps,
  };
}

export default function TaskTreeHostAdapter({ task: taskMeta, onClose, hideHeader, onToolbarUpdate, registerOnClose, setDockTree }: EditorProps) { // ✅ PATTERN CENTRALIZZATO: Accetta hideHeader e onToolbarUpdate
  // ✅ ARCHITETTURA ESPERTO: Verifica che questo componente sia usato solo per TaskTree
  // Se il task è di tipo Message, questo componente NON dovrebbe essere montato
  if (taskMeta?.type !== undefined && taskMeta.type !== null) {
    const editorKind = getEditorFromTaskType(taskMeta.type);
    if (editorKind === 'message') {
      console.error('❌ [TaskTreeHostAdapter] ERRORE CRITICO: Questo componente è stato montato per un task Message!', {
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
            <p>TaskTreeHostAdapter montato per task Message</p>
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
  // ✅ CRITICAL: taskMeta.id ALWAYS equals row.id (which equals task.id when task exists)
  const taskId = React.useMemo(() => taskMeta.id ?? 'unknown', [taskMeta.id]);

  // ✅ FIX: Carica task in modo sincrono nel render iniziale (getTask è sincrono)
  // Non usare useTaskInstance che introduce delay inutile con useEffect
  const fullTask = React.useMemo(() => {
    if (!taskId) return null;
    try {
      const loaded = taskRepository.getTask(taskId);

      return loaded;
    } catch (error) {
      console.error('[TaskTreeHostAdapter] Error loading task:', error);
      return null;
    }
  }, [taskId]);

  // ✅ FASE 3: Store è single source of truth
  const { setTaskTree: setTaskTreeInStore } = useTaskTreeStore();
  const taskTreeFromStore = useTaskTreeStore((state) => state.taskTree);
  const taskTreeVersion = useTaskTreeStore((state) => state.taskTreeVersion);

  // ✅ FASE 3: Loading state per async operations
  const [taskTreeLoading, setTaskTreeLoading] = React.useState(true);

  // ✅ FIX STRUTTURALE: Popola lo store solo una volta per istanza
  const initializedRef = React.useRef(false);

  // ✅ Reset initializedRef quando cambia istanza
  React.useEffect(() => {
    initializedRef.current = false;
  }, [taskId]);

  // ✅ Invalidate global store immediately when switching task so UI never shows the previous task's TaskTree
  React.useEffect(() => {
    setTaskTreeInStore(null);
    setTaskTreeLoading(true);
  }, [taskId, setTaskTreeInStore]);

  // Load TaskTree async using buildTaskTree
  React.useEffect(() => {
    const loadTaskTree = async () => {
      // Skip buildTaskTree if needsTaskBuilder is true AND no task exists yet
      if ((taskMeta as any).needsTaskBuilder === true && !fullTask) {
        setTaskTreeInStore(null);
        setTaskTreeLoading(false);
        initializedRef.current = true;
        return;
      }

      if (!fullTask) {
        setTaskTreeLoading(false);
        return;
      }

      // Skip buildTaskTree if needsTaskBuilder is true (wizard will create TaskTree)
      if ((taskMeta as any).needsTaskBuilder === true) {
        setTaskTreeInStore(null);
        setTaskTreeLoading(false);
        initializedRef.current = true;
        return;
      }

      try {
        setTaskTreeLoading(true);

        // Build TaskTree via MaterializationOrchestrator (standalone + instance+template)
        const result = await materializeTaskFromRepository(taskId, currentProjectId || undefined);

        // ✅ TaskTree caricato
        if (result) {
          const { taskTree: tree, instance: updatedTask } = result;
          // ✅ FASE 3: Store è single source of truth - aggiorna solo lo store
          setTaskTreeInStore(tree);
          initializedRef.current = true;

          // Log rimosso: non essenziale per flusso motore
        } else {
          const fresh = taskRepository.getTask(taskId);
          if (fresh) {
            setTaskTreeInStore(buildMinimalTaskTreeFromTask(fresh));
          } else {
            setTaskTreeInStore(null);
          }
          initializedRef.current = true;
        }
      } catch (error) {
        console.error('[TaskTreeHostAdapter] Error loading TaskTree:', error);
        const fresh = taskRepository.getTask(taskId);
        if (fresh) {
          setTaskTreeInStore(buildMinimalTaskTreeFromTask(fresh));
        } else {
          setTaskTreeInStore(null);
        }
        initializedRef.current = true;
      } finally {
        setTaskTreeLoading(false);
      }
    };

    loadTaskTree();
    // ✅ CRITICAL: setTaskTreeInStore is stable from Zustand, but we don't need it in deps
    // ✅ FIX STRUTTURALE: Dipende solo da fullTask?.id, non da fullTask (evita loop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullTask?.id, currentProjectId, taskId]);

  // ✅ ARCHITETTURA ESPERTO: Loading solo se serve async
  const loading = taskTreeLoading;

  // 3. Quando completi il wizard, salva nel Task E aggiorna lo state
  const handleComplete = React.useCallback(async (finalTaskTreeOrLegacy: any) => {
    // Normalize to TaskTree format - NO FALLBACKS
    // If data doesn't match expected format, throw explicit error
    if (!finalTaskTreeOrLegacy) {
      throw new Error('[DDTHostAdapter] handleComplete: finalTaskTreeOrLegacy is null or undefined');
    }

    let finalTaskTree: TaskTree;

    if (finalTaskTreeOrLegacy.nodes) {
      // Already in TaskTree format
      finalTaskTree = finalTaskTreeOrLegacy as TaskTree;
    } else if (finalTaskTreeOrLegacy.data) {
      // Legacy format - normalize explicitly (not fallback, but transformation)
      console.warn('[DDTHostAdapter] Converting legacy format (data) to TaskTree format (nodes)');
      finalTaskTree = {
        label: finalTaskTreeOrLegacy.label ?? '',
        nodes: finalTaskTreeOrLegacy.data,
        steps: finalTaskTreeOrLegacy.steps ?? {},
        constraints: finalTaskTreeOrLegacy.constraints,
        dataContract: finalTaskTreeOrLegacy.dataContract,
        introduction: finalTaskTreeOrLegacy.introduction
      };
    } else {
      throw new Error(
        `[DDTHostAdapter] handleComplete: Invalid format. Expected TaskTree with 'nodes' or legacy with 'data'. ` +
        `Got: ${JSON.stringify(Object.keys(finalTaskTreeOrLegacy)).substring(0, 200)}`
      );
    }

    console.log('[TaskTreeHostAdapter][handleComplete] 🔍 finalTaskTree received', {
      taskId,
      hasTaskTree: !!finalTaskTree,
      nodesLength: finalTaskTree.nodes?.length ?? 0,
      hasSteps: !!finalTaskTree.steps,
      // ✅ FIX: stepsCount per dictionary (non array)
      stepsCount: finalTaskTree.steps && typeof finalTaskTree.steps === 'object' && !Array.isArray(finalTaskTree.steps)
        ? Object.keys(finalTaskTree.steps).length
        : 0,
      // ✅ NEW: Log dettagliato steps
      stepsKeys: finalTaskTree.steps && typeof finalTaskTree.steps === 'object' && !Array.isArray(finalTaskTree.steps)
        ? Object.keys(finalTaskTree.steps)
        : [],
      stepsContent: finalTaskTree.steps,
      nodeTemplateIds: finalTaskTree.nodes?.map(n => n.templateId) || [],
      // ✅ NEW: Verifica mismatch templateId
      templateIdMismatch: finalTaskTree.nodes?.length > 0 && finalTaskTree.steps && typeof finalTaskTree.steps === 'object' && !Array.isArray(finalTaskTree.steps)
        ? {
            nodeTemplateId: finalTaskTree.nodes[0].templateId,
            stepsTemplateIds: Object.keys(finalTaskTree.steps),
            match: Object.keys(finalTaskTree.steps).includes(finalTaskTree.nodes[0].templateId || ''),
          }
        : null,
    });

    // ✅ Salva TaskTree nel Task usando extractTaskOverrides
    const hasTaskTree = finalTaskTree && Object.keys(finalTaskTree).length > 0 && finalTaskTree.nodes && finalTaskTree.nodes.length > 0;
    if (hasTaskTree) {
      // ✅ DEBUG: Verifica taskInstance prima del salvataggio
      let taskInstance = taskRepository.getTask(taskId);
      console.log('[TaskTreeHostAdapter][handleComplete] 🔍 taskInstance before save', {
        taskId,
        hasTaskInstance: !!taskInstance,
        taskInstanceHasSteps: !!taskInstance?.steps,
        // ✅ FIX: stepsCount per dictionary (non array)
        taskInstanceStepsCount: taskInstance?.steps && typeof taskInstance.steps === 'object' && !Array.isArray(taskInstance.steps)
          ? Object.keys(taskInstance.steps).length
          : 0,
        taskInstanceStepsKeys: taskInstance?.steps && typeof taskInstance.steps === 'object' && !Array.isArray(taskInstance.steps)
          ? Object.keys(taskInstance.steps)
          : [],
        taskInstanceTemplateId: taskInstance?.templateId,
      });

      // ✅ SIMPLIFIED: Save directly from finalTaskTree (no extractTaskOverrides needed)
      if (taskInstance && currentProjectId) {
        const stepsToSave = finalTaskTree.steps ?? {};
        const labelKeyToSave = finalTaskTree.labelKey || finalTaskTree.label;

        const updates: Partial<Task> = {
          steps: stepsToSave,
          ...(labelKeyToSave ? { labelKey: labelKeyToSave } : {}),
          type: TaskType.UtteranceInterpretation
        };

        console.log('[TaskTreeHostAdapter][handleComplete] 💾 Saving task directly', {
          taskId,
          hasSteps: !!stepsToSave,
          stepsKeys: stepsToSave && typeof stepsToSave === 'object' && !Array.isArray(stepsToSave)
            ? Object.keys(stepsToSave)
            : [],
        });

        // ✅ Salva nel repository
        await taskRepository.updateTask(taskId, updates, currentProjectId);

        console.log('[TaskTreeHostAdapter][handleComplete] ✅ Task saved, verifying', {
          taskId,
          savedTask: taskRepository.getTask(taskId),
          savedTaskSteps: taskRepository.getTask(taskId)?.steps,
          savedTaskStepsKeys: taskRepository.getTask(taskId)?.steps && typeof taskRepository.getTask(taskId)?.steps === 'object' && !Array.isArray(taskRepository.getTask(taskId)?.steps)
            ? Object.keys(taskRepository.getTask(taskId)!.steps!)
            : [],
        });
      } else if (!taskInstance) {
        // ✅ Task non esiste, crealo
        // ✅ CRITICAL: Prendi templateId dal finalTaskTree invece di null
        const rootNodeTemplateId = finalTaskTree.nodes?.[0]?.templateId || null;

        if (!rootNodeTemplateId) {
          console.error('[TaskTreeHostAdapter][handleComplete] ❌ CRITICAL: Cannot create task without templateId', {
            taskId,
            hasNodes: !!finalTaskTree.nodes,
            nodesLength: finalTaskTree.nodes?.length || 0,
            firstNode: finalTaskTree.nodes?.[0]
          });
          throw new Error('Cannot create task: templateId is required but not found in TaskTree nodes');
        }

        console.log('[TaskTreeHostAdapter][handleComplete] 📝 Creating new task with templateId from TaskTree', {
          taskId,  // ALWAYS equals row.id
          templateId: rootNodeTemplateId,
          nodeId: finalTaskTree.nodes[0].id,
          nodeLabel: finalTaskTree.nodes[0].label
        });

        const { extractTaskOverrides } = await import('../../../utils/taskUtils');
        const tempTask: Task = {
          id: taskId,  // ✅ CRITICAL: Use row.id (task.id === row.id ALWAYS)
          type: TaskType.UtteranceInterpretation,
          templateId: rootNodeTemplateId,  // ✅ FIX: Usa templateId dal TaskTree invece di null
          label: finalTaskTree.label,
          steps: finalTaskTree.steps
        };
        const overrides = await extractTaskOverrides(tempTask, finalTaskTree, currentProjectId || undefined);

        taskRepository.createTask(
          TaskType.UtteranceInterpretation,
          tempTask.templateId,  // Ora ha templateId corretto
          overrides,
          taskId,  // ✅ CRITICAL: Use row.id (task.id === row.id ALWAYS)
          currentProjectId || undefined
        );
      }

      // ✅ DEBUG: Verifica task salvato dopo il salvataggio
      const savedTask = taskRepository.getTask(taskId);
      console.log('[TaskTreeHostAdapter][handleComplete] ✅ Task saved', {
        taskId,
        savedTaskHasSteps: !!savedTask?.steps,
        // ✅ FIX: stepsCount per dictionary (non array)
        savedTaskStepsCount: savedTask?.steps && typeof savedTask.steps === 'object' && !Array.isArray(savedTask.steps)
          ? Object.keys(savedTask.steps).length
          : 0,
        savedTaskStepsKeys: savedTask?.steps && typeof savedTask.steps === 'object' && !Array.isArray(savedTask.steps)
          ? Object.keys(savedTask.steps)
          : [],
        templateId: savedTask?.templateId,
        // ✅ NEW: Verifica mismatch dopo salvataggio
        nodeTemplateIdAfterSave: finalTaskTree.nodes?.[0]?.templateId,
        stepsTemplateIdsAfterSave: savedTask?.steps && typeof savedTask.steps === 'object' && !Array.isArray(savedTask.steps)
          ? Object.keys(savedTask.steps)
          : [],
        templateIdMatchAfterSave: finalTaskTree.nodes?.[0]?.templateId && savedTask?.steps && typeof savedTask.steps === 'object' && !Array.isArray(savedTask.steps)
          ? Object.keys(savedTask.steps).includes(finalTaskTree.nodes[0].templateId)
          : false,
      });
    }

    // Emit event to refresh ConditionEditor variables (variables are created by TemplateCloningService)
    try {
      document.dispatchEvent(new CustomEvent('flowchart:variablesUpdated', { bubbles: true }));
    } catch { }

    // ✅ FASE 3: Store è single source of truth - aggiorna solo lo store
    setTaskTreeInStore(finalTaskTree);
    initializedRef.current = true; // ✅ Marca come inizializzato dopo wizard
  }, [taskId, currentProjectId, taskMeta.label, setTaskTreeInStore]);

  // ✅ ARCHITETTURA ESPERTO: Ensure nodes is always an array before passing to ResponseEditor
  // ✅ FASE 3: Usa solo store come single source of truth
  const safeTaskTree = React.useMemo(() => {
    const source = taskTreeFromStore; // ✅ Usa solo store, non più locale
    if (!source) {
      return null;
    }
    const safe = {
      ...source,
      nodes: Array.isArray(source.nodes) ? source.nodes : []
    };
    return safe;
  }, [
    taskTreeFromStore?.id,
    taskTreeFromStore?.nodes?.length,
    // ✅ FIX: Aggiungi dipendenza per steps per forzare ricalcolo quando cambiano
    taskTreeFromStore?.steps && typeof taskTreeFromStore.steps === 'object' && !Array.isArray(taskTreeFromStore.steps)
      ? Object.keys(taskTreeFromStore.steps).length
      : taskTreeFromStore?.steps && Array.isArray(taskTreeFromStore.steps)
      ? taskTreeFromStore.steps.length
      : 0,
    taskTreeVersion, // ✅ Usa version per forzare re-render quando store cambia
    loading
  ]); // ✅ Dipendenze stabili (ID, lunghezza nodes, numero di steps)

  // ✅ Stable key per impedire re-mount durante l'editing
  const editorKey = React.useMemo(() => {
    // ✅ CRITICAL: taskMeta.id ALWAYS equals row.id (which equals task.id when task exists)
    return `response-editor-${taskId}`;
  }, [taskId]);

  // ✅ ARCHITETTURA ESPERTO: Passa Task completo invece di TaskMeta
  // ✅ CRITICAL: Ricarica task dal repository per avere gli step aggiornati dopo buildTaskTree
  const updatedFullTask = React.useMemo(() => {
    if (!taskId) return null;
    try {
      return taskRepository.getTask(taskId);
    } catch (error) {
      console.error('[TaskTreeHostAdapter] Error reloading task:', error);
      return fullTask; // Fallback al task originale
    }
  }, [taskId, taskTreeVersion]); // ✅ FASE 3: Dipende da taskTreeVersion per ricaricare quando store cambia

  // ✅ Stable callbacks per evitare re-render
  const stableOnClose = React.useCallback(() => {
    try {
      onClose && onClose();
    } catch {}
  }, [onClose]);

  const stableOnWizardComplete = React.useCallback(async (finalTaskTree: TaskTree) => {
    await handleComplete(finalTaskTree);

    if (import.meta.env.DEV) {
      const taskAfter = taskRepository.getTask(taskId);
      console.log('[DDTHostAdapter] wizard complete', {
        taskId,
        nodes: finalTaskTree?.nodes?.length ?? 0,
        steps: finalTaskTree?.steps ? Object.keys(finalTaskTree.steps).length : 0,
        taskHasStepsAfterSave: taskAfter?.steps ? Object.keys(taskAfter.steps).length > 0 : false,
      });
    }
  }, [handleComplete, taskId, taskMeta.id]);

  // ✅ FIX: Preserve wizard properties from taskMeta even when using fullTask
  // These properties (taskWizardMode, contextualizationTemplateId) are not saved in repository Task,
  // only in TaskMeta passed as prop. When fullTask exists, we must preserve wizard values from taskMeta.
  const taskToPass = React.useMemo(() => {
    const baseTask = updatedFullTask || fullTask || taskMeta;
    if (!baseTask) return null;

    // ✅ CRITICAL: Preserve wizard properties from taskMeta
    // They're not in repository Task, only in TaskMeta passed as prop
    return {
      ...baseTask,
      taskWizardMode: (taskMeta as any).taskWizardMode ?? (baseTask as any).taskWizardMode,
      contextualizationTemplateId: (taskMeta as any).contextualizationTemplateId ?? (baseTask as any).contextualizationTemplateId,
      taskLabel: (taskMeta as any).taskLabel ?? (baseTask as any).taskLabel,
      needsTaskContextualization: (taskMeta as any).needsTaskContextualization ?? (baseTask as any).needsTaskContextualization,
      needsTaskBuilder: (taskMeta as any).needsTaskBuilder ?? (baseTask as any).needsTaskBuilder,
    };
  }, [updatedFullTask, fullTask, taskMeta]);

  return (
    <ResponseEditor
      key={editorKey}
      taskTree={safeTaskTree}
      onClose={stableOnClose}
      onWizardComplete={stableOnWizardComplete}
      task={taskToPass} // ✅ Usa task aggiornato, o fullTask, o taskMeta (per wizard mode)
      isTaskTreeLoading={loading} // ✅ ARCHITETTURA ESPERTO: Stato di loading
      hideHeader={hideHeader} // ✅ PATTERN CENTRALIZZATO: Passa hideHeader al wrapper
      onToolbarUpdate={onToolbarUpdate} // ✅ PATTERN CENTRALIZZATO: Passa onToolbarUpdate per ereditare header
      registerOnClose={registerOnClose} // ✅ Passa registerOnClose per gestire chiusura con controllo contracts
      setDockTree={setDockTree} // ✅ Passa setDockTree per aprire chat panel come tab dockabile
    />
  );
}


