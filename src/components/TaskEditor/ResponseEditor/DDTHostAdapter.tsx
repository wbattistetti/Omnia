import React from 'react';
import type { EditorProps } from '../EditorHost/types';
import ResponseEditor from './index';
import { taskRepository } from '../../../services/TaskRepository';
import { useProjectDataUpdate } from '../../../context/ProjectDataContext';
import { flowchartVariablesService } from '../../../services/FlowchartVariablesService';
import { getTemplateId } from '../../../utils/taskHelpers';
// ❌ RIMOSSO: buildDDTFromTask - ora usiamo loadAndAdaptDDTForExistingTask da ddtInstanceManager
import { TaskType, taskIdToTaskType, getEditorFromTaskType } from '../../../types/taskTypes'; // ✅ RINOMINATO: actIdToTaskType → taskIdToTaskType

export default function DDTHostAdapter({ task: taskMeta, onClose, hideHeader, onToolbarUpdate }: EditorProps) { // ✅ PATTERN CENTRALIZZATO: Accetta hideHeader e onToolbarUpdate
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

      // ✅ AGGIUNTO: Definisci loadedStepsKeys PRIMA di usarla
      const loadedStepsKeys = loaded?.steps ? Object.keys(loaded.steps) : [];

      // ✅ Log solo critico (ridotto verbosità)
      console.log('[🔍 DDTHostAdapter] CRITICAL - Task loaded from repository', {
        instanceKey,
        hasTask: !!loaded,
        taskId: loaded?.id,
        taskTemplateId: loaded?.templateId,
        hasSteps: !!loaded?.steps,
        stepsKeys: loadedStepsKeys,
        stepsKeysAsStrings: loadedStepsKeys.join(', '), // ✅ Stringa per vedere tutte le chiavi
        stepsCount: loadedStepsKeys.length,
        stepsDetails: loaded?.steps ? Object.keys(loaded.steps).map((nodeId: string) => {
          const nodeSteps = loaded.steps[nodeId];
          const isArray = Array.isArray(nodeSteps);
          const isObject = typeof nodeSteps === 'object' && !Array.isArray(nodeSteps);
          let escalationsCount = 0;
          let tasksCount = 0;

          if (isArray) {
            escalationsCount = nodeSteps.length;
            tasksCount = nodeSteps.reduce((acc: number, step: any) =>
              acc + (step?.escalations?.reduce((a: number, esc: any) => a + (esc?.tasks?.length || 0), 0) || 0), 0);
          } else if (isObject) {
            escalationsCount = nodeSteps?.start?.escalations?.length || nodeSteps?.introduction?.escalations?.length || 0;
            const startEscs = nodeSteps?.start?.escalations || [];
            const introEscs = nodeSteps?.introduction?.escalations || [];
            tasksCount = [...startEscs, ...introEscs].reduce((acc: number, esc: any) => acc + (esc?.tasks?.length || 0), 0);
          }

          return {
            nodeId,
            nodeIdPreview: nodeId.substring(0, 40) + '...',
            stepsType: typeof nodeSteps,
            isArray,
            isObject,
            stepsKeys: isObject ? Object.keys(nodeSteps || {}) : [],
            escalationsCount,
            tasksCount,
            hasStartStep: !!nodeSteps?.start,
            startEscalationsCount: nodeSteps?.start?.escalations?.length || 0
          };
        }) : [],
        hasdata: !!loaded?.data,
        dataLength: loaded?.data?.length || 0,
        metadata: loaded?.metadata
      });

      return loaded;
    } catch (error) {
      console.error('[DDTHostAdapter] Error loading task:', error);
      return null;
    }
  }, [instanceKey]);

  // ✅ FIX: Costruisci DDT in modo sincrono se possibile (non serve async)
  const initialDdt = React.useMemo(() => {
      // ✅ Carica DDT in modo sincrono nel render iniziale se il task esiste e non ha templateId
      if (fullTask) {
        if (fullTask.templateId && fullTask.templateId !== 'UNDEFINED') {
          // Ha templateId → serve async loadAndAdaptDDTForExistingTask, ritorna null per ora
          return null;
      } else if (fullTask.data && fullTask.data.length > 0) {
        // ✅ NON ha templateId ma ha data → costruisci DDT in modo sincrono
        // ✅ CORRETTO: Il DDT contiene solo la struttura, NON gli steps
        // Gli steps vivono solo in task.steps[nodeId], non nel DDT
        return {
          label: fullTask.label,
          data: fullTask.data,
          constraints: fullTask.constraints,
          examples: fullTask.examples,
          nlpContract: fullTask.nlpContract,
          introduction: fullTask.introduction
        };
      }
    }
    return null;
  }, [fullTask]);

  const [ddt, setDdt] = React.useState<any | null>(initialDdt);

  const [ddtLoading, setDdtLoading] = React.useState(() => {
    // ✅ Se il task ha templateId, serve async loading
    if (fullTask?.templateId && fullTask.templateId !== 'UNDEFINED') return true;
    // ✅ Se il DDT è già stato caricato in modo sincrono, non c'è loading
    if (initialDdt !== null) return false;
    // ✅ Altrimenti, non c'è loading (DDT vuoto o task non esiste)
    return false;
  });

  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  // ✅ ARCHITETTURA ESPERTO: Carica DDT async solo se serve (ha templateId)
  React.useEffect(() => {
    const loadDDT = async () => {
      if (!fullTask) {
        setDdtLoading(false);
        return;
      }

      // ✅ Se il DDT è già stato caricato in modo sincrono, non fare nulla
      if (initialDdt !== null && (!fullTask.templateId || fullTask.templateId === 'UNDEFINED')) {
        return;
      }

      // ✅ Solo se ha templateId, carica in modo async usando funzione centralizzata
      if (fullTask.templateId && fullTask.templateId !== 'UNDEFINED') {
        setDdtLoading(true);
        // ✅ Log ridotto (solo se necessario per debug)
        // console.log('[🔍 DDTHostAdapter] Caricamento DDT async', {...});
        try {
          const { loadAndAdaptDDTForExistingTask } = await import('../../../utils/ddtInstanceManager');
          const { ddt, adapted } = await loadAndAdaptDDTForExistingTask(fullTask, currentProjectId);
          console.log('[🔍 DDTHostAdapter] DDT caricato', {
            taskId: fullTask.id,
            ddtLabel: ddt.label,
            ddtDataLength: ddt.data?.length || 0,
            ddtStepsKeys: Object.keys(ddt.steps || {}),
            ddtStepsCount: Object.keys(ddt.steps || {}).length,
            mainNodesTemplateIds: ddt.data?.map((n: any) => ({
              id: n.id,
              templateId: n.templateId,
              label: n.label
            })) || [],
            adapted
          });
          setDdt(ddt);
        } catch (err) {
          console.error('[🔍 DDTHostAdapter] ❌ Errore caricamento DDT', err);
          setDdt(null);
        } finally {
          setDdtLoading(false);
        }
      } else if (!fullTask.data || fullTask.data.length === 0) {
        // ✅ Non ha templateId e non ha data → DDT vuoto
        setDdt(null);
        setDdtLoading(false);
      }
    };

    loadDDT();
  }, [fullTask, instanceKey, refreshTrigger, initialDdt, currentProjectId]); // ✅ Aggiungi currentProjectId

  // ✅ ARCHITETTURA ESPERTO: Loading solo se serve async
  const loading = ddtLoading;

  // 3. Quando completi il wizard, salva nel Task E aggiorna lo state
  const handleComplete = React.useCallback(async (finalDDT: any) => {
    // ✅ DEBUG: Verifica cosa contiene finalDDT quando arriva in handleComplete
    console.log('[DDTHostAdapter][handleComplete] 🔍 finalDDT received', {
      instanceKey,
      hasFinalDDT: !!finalDDT,
      finalDDTKeys: Object.keys(finalDDT || {}),
      hasSteps: !!finalDDT.steps,
      stepsType: typeof finalDDT.steps,
      stepsKeys: finalDDT.steps ? Object.keys(finalDDT.steps) : [],
      stepsCount: finalDDT.steps ? Object.keys(finalDDT.steps).length : 0,
      stepsDetails: finalDDT.steps ? Object.keys(finalDDT.steps).map((nodeId: string) => {
        const nodeSteps = finalDDT.steps[nodeId];
        const isArray = Array.isArray(nodeSteps);
        const isObject = typeof nodeSteps === 'object' && !Array.isArray(nodeSteps);
        let stepKeys: string[] = [];
        if (isArray) {
          stepKeys = nodeSteps.map((s: any) => s?.type || 'unknown');
        } else if (isObject) {
          stepKeys = Object.keys(nodeSteps || {});
        }
        return {
          nodeId: nodeId.substring(0, 20) + '...',
          stepsType: typeof nodeSteps,
          isArray,
          isObject,
          stepKeys,
          stepCount: stepKeys.length
        };
      }) : [],
      hasdata: !!finalDDT.data,
      dataLength: finalDDT.data?.length || 0
    });

    // ✅ Salva DDT nel Task con campi direttamente (niente wrapper value)
    const hasDDT = finalDDT && Object.keys(finalDDT).length > 0 && finalDDT.data && finalDDT.data.length > 0;
    if (hasDDT) {
      // ✅ DEBUG: Verifica taskInstance prima del salvataggio
      let taskInstance = taskRepository.getTask(instanceKey);
      console.log('[DDTHostAdapter][handleComplete] 🔍 taskInstance before save', {
        instanceKey,
        hasTaskInstance: !!taskInstance,
        taskInstanceHasSteps: !!taskInstance?.steps,
        taskInstanceStepsKeys: taskInstance?.steps ? Object.keys(taskInstance.steps) : [],
        taskInstanceStepsCount: taskInstance?.steps ? Object.keys(taskInstance.steps).length : 0
      });

      // ✅ CRITICAL: Preserva templateId se esiste già
      const currentTemplateId = taskInstance?.templateId;

      const updatePayload: Partial<Task> = {
        type: TaskType.DataRequest,
        label: finalDDT.label,
        // ❌ RIMOSSO: ...finalDDT,  // NON salvare tutto, solo quello che serve!
        steps: finalDDT.steps, // ✅ Salva steps
        constraints: finalDDT.constraints, // ✅ Override opzionali (solo se modificati)
        examples: finalDDT.examples, // ✅ Override opzionali (solo se modificati)
        nlpContract: finalDDT.nlpContract, // ✅ Override opzionali (solo se modificati)
        introduction: finalDDT.introduction
      };

      // ✅ CRITICAL: Preserva templateId
      if (currentTemplateId && currentTemplateId !== 'UNDEFINED') {
        updatePayload.templateId = currentTemplateId; // ✅ Preserva templateId esistente
      } else if (finalDDT.templateId) {
        updatePayload.templateId = finalDDT.templateId; // ✅ Usa templateId dal wizard
      }
      // ❌ RIMOSSO: Non impostare templateId: null!
      console.log('[DDTHostAdapter][handleComplete] 🔍 updatePayload before save', {
        instanceKey,
        updatePayloadKeys: Object.keys(updatePayload),
        hasSteps: !!updatePayload.steps,
        stepsType: typeof updatePayload.steps,
        stepsKeys: updatePayload.steps ? Object.keys(updatePayload.steps) : [],
        stepsCount: updatePayload.steps ? Object.keys(updatePayload.steps).length : 0
      });

      taskRepository.updateTask(instanceKey, updatePayload, currentProjectId || undefined);

      // ✅ DEBUG: Verifica task salvato dopo il salvataggio
      const savedTask = taskRepository.getTask(instanceKey);
      console.log('[DDTHostAdapter][handleComplete] ✅ Task saved', {
        instanceKey,
        savedTaskHasSteps: !!savedTask?.steps,
        savedTaskStepsKeys: savedTask?.steps ? Object.keys(savedTask.steps) : [],
        savedTaskStepsCount: savedTask?.steps ? Object.keys(savedTask.steps).length : 0,
        stepsWereSaved: savedTask?.steps && Object.keys(savedTask.steps).length > 0,
        stepsMatch: JSON.stringify(savedTask?.steps || {}) === JSON.stringify(finalDDT.steps || {})
      });
    }

    // ✅ NEW: Extract variables from DDT structure
    try {
      if (currentProjectId && finalDDT) {
        await flowchartVariablesService.init(currentProjectId);

        // Get row text from task (this is the label of the row)
        const taskInstance = taskRepository.getTask(instanceKey);
        const rowText = taskInstance?.text || taskMeta.label || 'Task';

        // Extract variables from DDT using row text and DDT labels
        const varNames = await flowchartVariablesService.extractVariablesFromDDT(
          finalDDT,
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
      // Failed to extract variables from DDT
    }

    // ✅ ARCHITETTURA ESPERTO: Aggiorna immediatamente ddt per aggiornare il prop
    setDdt(finalDDT);

    // FIX: Forza il ricalcolo quando necessario
    setRefreshTrigger(prev => prev + 1);
  }, [instanceKey, currentProjectId, taskMeta.label]);

  // ✅ ARCHITETTURA ESPERTO: Ensure data is always an array before passing to ResponseEditor
  const safeDDT = React.useMemo(() => {
    if (!ddt) {
      return null;
    }
    const safe = {
      ...ddt,
      data: Array.isArray(ddt.data) ? ddt.data : []
    };
    return safe;
  }, [ddt, loading]);

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

  const stableOnWizardComplete = React.useCallback((finalDDT: any) => {
    handleComplete(finalDDT);
  }, [handleComplete]);

  return (
    <ResponseEditor
      key={editorKey}
      ddt={safeDDT}
      onClose={stableOnClose}
      onWizardComplete={stableOnWizardComplete}
      task={fullTask} // ✅ ARCHITETTURA ESPERTO: Task completo, non TaskMeta
      isDdtLoading={loading} // ✅ ARCHITETTURA ESPERTO: Stato di loading
      hideHeader={hideHeader} // ✅ PATTERN CENTRALIZZATO: Passa hideHeader al wrapper
      onToolbarUpdate={onToolbarUpdate} // ✅ PATTERN CENTRALIZZATO: Passa onToolbarUpdate per ereditare header
    />
  );
}


