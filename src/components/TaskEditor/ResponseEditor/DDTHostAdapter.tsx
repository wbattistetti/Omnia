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

export default function TaskTreeHostAdapter({ task: taskMeta, onClose, hideHeader, onToolbarUpdate, registerOnClose }: EditorProps) { // ✅ PATTERN CENTRALIZZATO: Accetta hideHeader e onToolbarUpdate
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
  // ✅ NO FALLBACKS: Use instanceId as primary, id as fallback (both are valid properties)
  const instanceKey = React.useMemo(() => taskMeta.instanceId ?? taskMeta.id ?? 'unknown', [taskMeta.instanceId, taskMeta.id]); // ✅ RINOMINATO: act → taskMeta

  // ✅ FIX: Carica task in modo sincrono nel render iniziale (getTask è sincrono)
  // Non usare useTaskInstance che introduce delay inutile con useEffect
  const fullTask = React.useMemo(() => {
    if (!instanceKey) return null;
    try {
      const loaded = taskRepository.getTask(instanceKey);

      return loaded;
    } catch (error) {
      console.error('[TaskTreeHostAdapter] Error loading task:', error);
      return null;
    }
  }, [instanceKey]);

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
  }, [instanceKey]);

  // ✅ ARCHITETTURA ESPERTO: Carica TaskTree async usando buildTaskTree
  React.useEffect(() => {
    const loadTaskTree = async () => {
      // ✅ NEW: Skip buildTaskTree if needsTaskBuilder is true AND no task exists yet
      // In this case, the wizard will create the task when completed
      if ((taskMeta as any).needsTaskBuilder === true && !fullTask) {
        console.log('[DDTHostAdapter] Wizard mode - no task exists yet, wizard will create it', {
          instanceKey,
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
          instanceKey,
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
        const updatedTask = taskRepository.getTask(instanceKey);

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
  }, [fullTask?.id, currentProjectId, instanceKey]);

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
      instanceKey,
      hasTaskTree: !!finalTaskTree,
      nodesLength: finalTaskTree.nodes?.length ?? 0,
      hasSteps: !!finalTaskTree.steps,
      stepsCount: Array.isArray(finalTaskTree.steps) ? finalTaskTree.steps.length : 0
    });

    // ✅ Salva TaskTree nel Task usando extractTaskOverrides
    const hasTaskTree = finalTaskTree && Object.keys(finalTaskTree).length > 0 && finalTaskTree.nodes && finalTaskTree.nodes.length > 0;
    if (hasTaskTree) {
      // ✅ DEBUG: Verifica taskInstance prima del salvataggio
      let taskInstance = taskRepository.getTask(instanceKey);
      console.log('[TaskTreeHostAdapter][handleComplete] 🔍 taskInstance before save', {
        instanceKey,
        hasTaskInstance: !!taskInstance,
        taskInstanceHasSteps: !!taskInstance?.steps,
        taskInstanceStepsCount: Array.isArray(taskInstance?.steps) ? taskInstance.steps.length : 0
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
      console.log('[TaskTreeHostAdapter][handleComplete] ✅ Task saved', {
        instanceKey,
        savedTaskHasSteps: !!savedTask?.steps,
        savedTaskStepsCount: Array.isArray(savedTask?.steps) ? savedTask.steps.length : 0,
        templateId: savedTask?.templateId
      });
    }

    // ✅ NEW: Extract variables from TaskTree structure
    try {
      if (currentProjectId && finalTaskTree) {
        await flowchartVariablesService.init(currentProjectId);

        // Get row text from task (this is the label of the row)
        const taskInstance = taskRepository.getTask(instanceKey);
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

    // ✅ FASE 3: Store è primary - aggiorna sempre lo store
    setTaskTreeInStore(finalTaskTree);
    // ✅ FASE 3: Local state mantenuto temporaneamente per backward compatibility
    setTaskTree(finalTaskTree);
    initializedRef.current = true; // ✅ Marca come inizializzato dopo wizard
  }, [instanceKey, currentProjectId, taskMeta.label, setTaskTreeInStore]);

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
  }, [taskTree?.id, taskTree?.nodes?.length, loading]); // ✅ Dipendenze stabili (solo ID e lunghezza, non tutto l'oggetto)

  // ✅ Stable key per impedire re-mount durante l'editing
  const editorKey = React.useMemo(() => {
    // ✅ NO FALLBACKS: Use instanceId as primary, id as fallback (both are valid properties)
    const instanceKey = taskMeta.instanceId ?? taskMeta.id ?? 'unknown';
    return `response-editor-${instanceKey}`;
  }, [taskMeta.instanceId, taskMeta.id]);

  // ✅ ARCHITETTURA ESPERTO: Passa Task completo invece di TaskMeta
  // ✅ CRITICAL: Ricarica task dal repository per avere gli step aggiornati dopo buildTaskTree
  const updatedFullTask = React.useMemo(() => {
    if (!instanceKey) return null;
    try {
      return taskRepository.getTask(instanceKey);
    } catch (error) {
      console.error('[TaskTreeHostAdapter] Error reloading task:', error);
      return fullTask; // Fallback al task originale
    }
  }, [instanceKey, taskTree]); // ✅ Dipende da taskTree per ricaricare quando cambia

  // ✅ Stable callbacks per evitare re-render
  const stableOnClose = React.useCallback(() => {
    try {
      onClose && onClose();
    } catch {}
  }, [onClose]);

  const stableOnWizardComplete = React.useCallback(async (finalTaskTree: TaskTree) => {
    // ✅ NEW: If task doesn't exist yet (wizard mode), create it first
    if (!fullTask && (taskMeta as any).needsTaskBuilder === true) {
      const instanceId = taskMeta.instanceId ?? taskMeta.id;
      if (instanceId && instanceId.startsWith('wizard-')) {
        // Extract real instanceId from temporary wizard ID
        const realInstanceId = taskMeta.instanceId || taskMeta.id?.replace(/^wizard-/, '').split('-')[0];
        const projectId = currentProjectId || undefined;
        const taskType = taskMeta.type || 0;
        const taskLabel = (taskMeta as any).taskLabel || taskMeta.label || 'Task';

        console.log('[DDTHostAdapter] Creating task from wizard completion', {
          temporaryId: instanceKey,
          realInstanceId,
          taskLabel
        });

        // Create task
        const newTask = taskRepository.createTask(
          taskType,
          null, // templateId - will be set from taskTree
          undefined, // parentTaskId
          realInstanceId,
          projectId
        );

        // Update taskMeta to use real task ID
        taskMeta.id = String(newTask.id);
        taskMeta.instanceId = realInstanceId;
      }
    }

    // Now save TaskTree using handleComplete
    await handleComplete(finalTaskTree);

    // ✅ Switch from wizard mode to normal editing mode
    if ((taskMeta as any).needsTaskBuilder === true) {
      // Clear wizard flag - this will cause ResponseEditor to show normal layout
      // Note: We can't directly modify taskMeta, but the next render will see fullTask exists
      console.log('[DDTHostAdapter] Wizard complete - switching to normal editing mode');
    }
  }, [handleComplete, fullTask, taskMeta, instanceKey, currentProjectId]);

  // ✅ NEW: Use taskMeta when task is null (wizard mode)
  // When needsTaskBuilder === true, fullTask is null, so we need to pass taskMeta
  const taskToPass = updatedFullTask || fullTask || taskMeta;

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
    />
  );
}


