import React from 'react';
import type { EditorProps } from '../EditorHost/types';
import ResponseEditor from './index';
import { taskRepository } from '../../../services/TaskRepository';
import { useProjectDataUpdate } from '../../../context/ProjectDataContext';
import { flowchartVariablesService } from '../../../services/FlowchartVariablesService';
import { getTemplateId } from '../../../utils/taskHelpers';
import { loadDDTFromTemplate } from '../../../utils/ddtMergeUtils';
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
      return taskRepository.getTask(instanceKey);
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
        // Ha templateId → serve async loadDDTFromTemplate, ritorna null per ora
        return null;
      } else if (fullTask.mainData && fullTask.mainData.length > 0) {
        // ✅ NON ha templateId ma ha mainData → costruisci DDT in modo sincrono
        // ✅ CORRETTO: Il DDT contiene solo la struttura, NON gli steps
        // Gli steps vivono solo in task.steps[nodeId], non nel DDT
        return {
          label: fullTask.label,
          mainData: fullTask.mainData,
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

      // ✅ Solo se ha templateId, carica in modo async
      if (fullTask.templateId && fullTask.templateId !== 'UNDEFINED') {
        setDdtLoading(true);
        const merged = await loadDDTFromTemplate(fullTask);
        setDdt(merged);
        setDdtLoading(false);
      } else if (!fullTask.mainData || fullTask.mainData.length === 0) {
        // ✅ Non ha templateId e non ha mainData → DDT vuoto
        setDdt(null);
        setDdtLoading(false);
      }
    };

    loadDDT();
  }, [fullTask, instanceKey, refreshTrigger, initialDdt]); // ✅ Aggiungi initialDdt per controllare se è già stato caricato

  // ✅ ARCHITETTURA ESPERTO: Loading solo se serve async
  const loading = ddtLoading;

  // 3. Quando completi il wizard, salva nel Task E aggiorna lo state
  const handleComplete = React.useCallback(async (finalDDT: any) => {
    // ✅ Salva DDT nel Task con campi direttamente (niente wrapper value)
    const hasDDT = finalDDT && Object.keys(finalDDT).length > 0 && finalDDT.mainData && finalDDT.mainData.length > 0;
    if (hasDDT) {
      taskRepository.updateTask(instanceKey, {
        type: TaskType.DataRequest,  // ✅ type: enum numerico
        templateId: null,            // ✅ templateId: null (standalone)
        ...finalDDT  // ✅ Spread: label, mainData, stepPrompts, ecc.
      }, currentProjectId || undefined);
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

  // ✅ ARCHITETTURA ESPERTO: Ensure mainData is always an array before passing to ResponseEditor
  const safeDDT = React.useMemo(() => {
    if (!ddt) {
      return null;
    }
    const safe = {
      ...ddt,
      mainData: Array.isArray(ddt.mainData) ? ddt.mainData : []
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


