import React from 'react';
import type { EditorProps } from '@taskEditor/EditorHost/types';
import ResponseEditor from '@responseEditor/index';
import { taskRepository } from '@services/TaskRepository';
import { useProjectDataUpdate } from '@context/ProjectDataContext';
import { flowchartVariablesService } from '@services/FlowchartVariablesService';
import { getTemplateId } from '@utils/taskHelpers';
import { buildTaskTree } from '@utils/taskUtils';
import { TaskType, taskIdToTaskType, getEditorFromTaskType } from '@types/taskTypes';
import type { TaskTree } from '@types/taskTypes';
import { useTaskTreeStore } from '@responseEditor/core/state';

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

  // ✅ FASE 3: taskTree locale mantenuto temporaneamente per backward compatibility
  // TODO: Rimuovere dopo migrazione completa - ResponseEditor dovrebbe leggere solo dallo store
  const [taskTree, setTaskTree] = React.useState<TaskTree | null>(null);
  const [taskTreeLoading, setTaskTreeLoading] = React.useState(true);

  // ✅ FIX STRUTTURALE: Non leggere più dallo store per ricalcolare safeTaskTree
  // L'editor vive su taskTree locale, non su currentTaskTree che dipende dallo store
  // const currentTaskTree = taskTreeFromStore ?? taskTree; // ❌ RIMOSSO - causava feedback loop

  // ✅ FIX STRUTTURALE: Popola lo store solo una volta per istanza
  const initializedRef = React.useRef(false);

  // ✅ Reset initializedRef quando cambia istanza
  React.useEffect(() => {
    initializedRef.current = false;
  }, [taskId]);

  // ✅ ARCHITETTURA ESPERTO: Carica TaskTree async usando buildTaskTree
  React.useEffect(() => {
    const loadTaskTree = async () => {
      // ✅ NEW: Skip buildTaskTree if needsTaskBuilder is true AND no task exists yet
      // In this case, the wizard will create the task when completed
      if ((taskMeta as any).needsTaskBuilder === true && !fullTask) {
        console.log('[DDTHostAdapter] Wizard mode - no task exists yet, wizard will create it', {
          taskId,
          taskLabel: taskMeta.label
        });
        setTaskTreeInStore(null);
        setTaskTree(null);
        setTaskTreeLoading(false);
        initializedRef.current = true;
        return;
      }

      if (!fullTask) {
        setTaskTreeLoading(false);
        return;
      }

      // ✅ NEW: Skip buildTaskTree if needsTaskBuilder is true (wizard will create TaskTree)
      if ((taskMeta as any).needsTaskBuilder === true) {
        console.log('[DDTHostAdapter] Skipping buildTaskTree - wizard will create TaskTree', {
          taskId,
          taskLabel: taskMeta.label
        });
        setTaskTreeInStore(null);
        setTaskTree(null);
        setTaskTreeLoading(false);
        initializedRef.current = true;
        return;
      }

      try {
        setTaskTreeLoading(true);

        // ✅ Usa buildTaskTree per costruire TaskTree da template + instance
        const tree = await buildTaskTree(fullTask, currentProjectId || undefined);

        // ✅ CRITICAL: Ricarica task dal repository dopo buildTaskTree
        // buildTaskTree clona gli step e li salva nel repository, ma fullTask non si aggiorna automaticamente
        const updatedTask = taskRepository.getTask(taskId);

        // ✅ TaskTree caricato
        if (tree) {
          // ✅ FASE 3: Store è primary - aggiorna sempre lo store
          setTaskTreeInStore(tree);
          // ✅ FASE 3: Local state mantenuto temporaneamente per backward compatibility
          setTaskTree(tree);
          initializedRef.current = true;

          // Log rimosso: non essenziale per flusso motore
        } else {
          // ✅ FASE 3: Store è primary - aggiorna sempre lo store
          setTaskTreeInStore(null);
          // ✅ FASE 3: Local state mantenuto temporaneamente per backward compatibility
          setTaskTree(null);
          initializedRef.current = true;
        }
      } catch (error) {
        console.error('[TaskTreeHostAdapter] Error loading TaskTree:', error);
        // ✅ ARCHITECTURE: No fallback - template must exist by construction
        // If template is missing, it's a critical error that must be fixed
        // ✅ FASE 3: Store è primary - aggiorna sempre lo store
        setTaskTreeInStore(null);
        // ✅ FASE 3: Local state mantenuto temporaneamente per backward compatibility
        setTaskTree(null);
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

      // ✅ NUOVO: Usa extractTaskOverrides per salvare solo override
      if (taskInstance && currentProjectId) {
        const { extractTaskOverrides } = await import('../../../utils/taskUtils');
        const overrides = await extractTaskOverrides(taskInstance, finalTaskTree, currentProjectId);

        // ✅ Aggiorna task con solo override
        if (overrides.label !== undefined) taskInstance.label = overrides.label;
        if (overrides.steps !== undefined) taskInstance.steps = overrides.steps;
        if (overrides.introduction !== undefined) taskInstance.introduction = overrides.introduction;
        // ❌ NON salvare: constraints, dataContract (vengono dal template)

        console.log('[TaskTreeHostAdapter][handleComplete] 💾 Saving task with overrides', {
          taskId,
          hasOverridesSteps: !!overrides.steps,
          overridesStepsKeys: overrides.steps && typeof overrides.steps === 'object' && !Array.isArray(overrides.steps)
            ? Object.keys(overrides.steps)
            : [],
          overridesStepsContent: overrides.steps,
        });

        taskInstance.type = TaskType.UtteranceInterpretation;
        taskInstance.updatedAt = new Date();

        // ✅ Salva nel database
        await taskRepository.updateTask(taskId, overrides, currentProjectId);

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

    // ✅ NEW: Extract variables from TaskTree structure
    try {
      if (currentProjectId && finalTaskTree) {
        await flowchartVariablesService.init(currentProjectId);

        // Get row text from task (this is the label of the row)
        const taskInstance = taskRepository.getTask(taskId);
        // ✅ NO FALLBACKS: Use taskInstance.text as primary, taskMeta.label as fallback, 'Task' as explicit default
        const rowText = taskInstance?.text ?? taskMeta.label ?? 'Task';

        // ✅ BACKWARD COMPATIBILITY: Converti TaskTree in formato legacy per extractVariablesFromDDT
        const taskTreeForVariables = {
          label: finalTaskTree.label,
          data: finalTaskTree.nodes,
          steps: finalTaskTree.steps
        };

        // Extract variables from TaskTree using row text and TaskTree labels
        const varNames = await flowchartVariablesService.extractVariablesFromDDT(
          taskTreeForVariables,
          taskId, // taskId (ALWAYS equals row.id)
          taskId, // rowId (same as taskId, ALWAYS equals row.id)
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

    // ✅ FASE 3: Store è primary - aggiorna sempre lo store
    setTaskTreeInStore(finalTaskTree);
    // ✅ FASE 3: Local state mantenuto temporaneamente per backward compatibility
    setTaskTree(finalTaskTree);
    initializedRef.current = true; // ✅ Marca come inizializzato dopo wizard
  }, [taskId, currentProjectId, taskMeta.label, setTaskTreeInStore]);

  // ✅ ARCHITETTURA ESPERTO: Ensure nodes is always an array before passing to ResponseEditor
  // ✅ FIX STRUTTURALE: safeTaskTree dipende solo da taskTree locale, non da currentTaskTree che legge dallo store
  // Questo rompe il feedback loop: l'editor vive su taskTree locale, lo store è solo un mirror
  const safeTaskTree = React.useMemo(() => {
    const source = taskTree; // ✅ Solo taskTree locale, non currentTaskTree
    if (!source) {
      return null;
    }
    const safe = {
      ...source,
      nodes: Array.isArray(source.nodes) ? source.nodes : []
    };
    return safe;
  }, [
    taskTree?.id,
    taskTree?.nodes?.length,
    // ✅ FIX: Aggiungi dipendenza per steps per forzare ricalcolo quando cambiano
    taskTree?.steps && typeof taskTree.steps === 'object' && !Array.isArray(taskTree.steps)
      ? Object.keys(taskTree.steps).length
      : taskTree?.steps && Array.isArray(taskTree.steps)
      ? taskTree.steps.length
      : 0,
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
  }, [taskId, taskTree]); // ✅ Dipende da taskTree per ricaricare quando cambia

  // ✅ Stable callbacks per evitare re-render
  const stableOnClose = React.useCallback(() => {
    try {
      onClose && onClose();
    } catch {}
  }, [onClose]);

  const stableOnWizardComplete = React.useCallback(async (finalTaskTree: TaskTree) => {
    // ✅ CRITICAL: taskMeta.id ALWAYS equals row.id (which equals task.id when task exists)
    // The wizard will create the task with task.id = row.id when completed
    // No need to extract or convert IDs - just use taskMeta.id directly

    // Now save TaskTree using handleComplete
    await handleComplete(finalTaskTree);

    // ✅ LOG: WIZARD COMPLETION TRACE - Dettagli completi
    const taskAfterComplete = taskRepository.getTask(taskId);
    console.log('[DDTHostAdapter] 🔍 WIZARD COMPLETION TRACE', {
      // Task creato
      taskId,  // ALWAYS equals row.id
      rowId: taskMeta.id,  // ID della riga di nodo (ALWAYS equals task.id)
      taskIdEqualsRowId: taskId === taskMeta.id,  // Should always be true

      // TaskTree ricevuto
      taskTreeNodesCount: finalTaskTree?.nodes?.length || 0,
      taskTreeStepsCount: finalTaskTree?.steps ? Object.keys(finalTaskTree.steps).length : 0,
      taskTreeStepsKeys: finalTaskTree?.steps ? Object.keys(finalTaskTree.steps) : [],

      // Task dopo handleComplete
      taskAfterComplete: taskAfterComplete ? {
        id: taskAfterComplete.id,
        templateId: taskAfterComplete.templateId,
        hasSteps: taskAfterComplete.steps ? Object.keys(taskAfterComplete.steps).length > 0 : false,
      } : null,

      projectId: currentProjectId,
      timestamp: new Date().toISOString(),
    });

    // ✅ Switch from wizard mode to normal editing mode
    if ((taskMeta as any).needsTaskBuilder === true) {
      // Clear wizard flag - this will cause ResponseEditor to show normal layout
      // Note: We can't directly modify taskMeta, but the next render will see fullTask exists
      console.log('[DDTHostAdapter] Wizard complete - switching to normal editing mode');
    }
  }, [handleComplete, fullTask, taskMeta, taskId, currentProjectId]);

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


