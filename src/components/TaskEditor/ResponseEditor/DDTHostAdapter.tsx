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
import { useTaskTreeStore } from './core/state';

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
  const instanceKey = React.useMemo(() => taskMeta.instanceId || taskMeta.id, [taskMeta.instanceId, taskMeta.id]); // ✅ RINOMINATO: act → taskMeta

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

  // ✅ FIX STRUTTURALE: Store è solo un sink, non un anello di ritorno
  // L'editor vive su taskTree locale, lo store è solo un mirror
  const { setTaskTree: setTaskTreeInStore } = useTaskTreeStore();

  // ✅ TaskTree state (sostituisce ddt) - Keep for backward compatibility
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
      if (!fullTask) {
        setTaskTreeLoading(false);
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
          // ✅ FIX STRUTTURALE: Aggiorna solo local state (editor vive su questo)
          setTaskTree(tree);

          // ✅ FIX STRUTTURALE: Popola store solo se non ancora inizializzato (solo una volta per istanza)
          if (!initializedRef.current) {
            setTaskTreeInStore(tree);
            initializedRef.current = true;
          }

          console.log('[🔍 TaskTreeHostAdapter] ✅ TaskTree caricato', {
            taskId: fullTask.id,
            taskTreeNodesLength: tree.nodes?.length || 0,
            mainNodesTemplateIds: tree.nodes?.map((n: any) => ({
              id: n.id,
              templateId: n.templateId,
              label: n.label
            })) || [],
            hasSteps: !!tree.steps,
            stepsType: typeof tree.steps,
            stepsKeys: tree.steps && typeof tree.steps === 'object' && !Array.isArray(tree.steps)
              ? Object.keys(tree.steps)
              : [],
            updatedTaskHasSteps: !!updatedTask?.steps,
            updatedTaskStepsKeys: updatedTask?.steps && typeof updatedTask.steps === 'object' && !Array.isArray(updatedTask.steps)
              ? Object.keys(updatedTask.steps)
              : [],
            storeInitialized: initializedRef.current
          });
        } else {
          // ✅ FIX STRUTTURALE: Aggiorna solo local state
          setTaskTree(null);
          // ✅ Popola store solo se non ancora inizializzato
          if (!initializedRef.current) {
            setTaskTreeInStore(null);
            initializedRef.current = true;
          }
        }
      } catch (error) {
        console.error('[TaskTreeHostAdapter] Error loading TaskTree:', error);
        // ✅ FIX STRUTTURALE: Aggiorna solo local state
        setTaskTree(null);
        // ✅ Popola store solo se non ancora inizializzato
        if (!initializedRef.current) {
          setTaskTreeInStore(null);
          initializedRef.current = true;
        }
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
    // ✅ NUOVO: Supporta sia TaskTree (nuovo formato) che formato legacy (backward compatibility)
    const finalTaskTree: TaskTree = finalTaskTreeOrLegacy.nodes
      ? finalTaskTreeOrLegacy as TaskTree
      : {
          label: finalTaskTreeOrLegacy.label || '',
          nodes: finalTaskTreeOrLegacy.data || [],
          steps: finalTaskTreeOrLegacy.steps || {},
          constraints: finalTaskTreeOrLegacy.constraints,
          dataContract: finalTaskTreeOrLegacy.dataContract,
          introduction: finalTaskTreeOrLegacy.introduction
        };

    console.log('[TaskTreeHostAdapter][handleComplete] 🔍 finalTaskTree received', {
      instanceKey,
      hasTaskTree: !!finalTaskTree,
      nodesLength: finalTaskTree.nodes?.length || 0,
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
        const rowText = taskInstance?.text || taskMeta.label || 'Task';

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

    // ✅ ARCHITETTURA ESPERTO: Aggiorna immediatamente taskTree per aggiornare i props
    // ✅ FIX STRUTTURALE: Aggiorna solo local state (editor vive su questo)
    setTaskTree(finalTaskTree);
    // ✅ FIX STRUTTURALE: Aggiorna store solo se non ancora inizializzato (o se è un nuovo wizard)
    // In questo caso, il wizard completa, quindi aggiorniamo sempre lo store
    setTaskTreeInStore(finalTaskTree);
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
    const instanceKey = taskMeta.instanceId || taskMeta.id || 'unknown';
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

  const stableOnWizardComplete = React.useCallback((finalTaskTree: TaskTree) => {
    handleComplete(finalTaskTree);
  }, [handleComplete]);

  return (
    <ResponseEditor
      key={editorKey}
      taskTree={safeTaskTree}
      onClose={stableOnClose}
      onWizardComplete={stableOnWizardComplete}
      task={updatedFullTask || fullTask} // ✅ Usa task aggiornato con step clonati
      isTaskTreeLoading={loading} // ✅ ARCHITETTURA ESPERTO: Stato di loading
      hideHeader={hideHeader} // ✅ PATTERN CENTRALIZZATO: Passa hideHeader al wrapper
      onToolbarUpdate={onToolbarUpdate} // ✅ PATTERN CENTRALIZZATO: Passa onToolbarUpdate per ereditare header
      registerOnClose={registerOnClose} // ✅ Passa registerOnClose per gestire chiusura con controllo contracts
    />
  );
}


