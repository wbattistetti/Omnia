import React from 'react';
import type { EditorProps } from '../EditorHost/types';
import ResponseEditor from './index';
import { taskRepository } from '../../../services/TaskRepository';
import { useProjectDataUpdate } from '../../../context/ProjectDataContext';
import { flowchartVariablesService } from '../../../services/FlowchartVariablesService';
import { getTemplateId } from '../../../utils/taskHelpers';
import { loadDDTFromTemplate } from '../../../utils/ddtMergeUtils';
import { TaskType, taskIdToTaskType, getEditorFromTaskType } from '../../../types/taskTypes'; // ✅ RINOMINATO: actIdToTaskType → taskIdToTaskType
import { useTaskInstance } from './hooks/useTaskInstance';

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

  // ✅ ARCHITETTURA ESPERTO: Carica Task completo usando hook dedicato
  const { task: fullTask, loading: taskLoading } = useTaskInstance(instanceKey);

  // ✅ ARCHITETTURA ESPERTO: Stato per DDT loading
  const [ddt, setDdt] = React.useState<any | null>(null);
  const [ddtLoading, setDdtLoading] = React.useState(true);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  // ✅ ARCHITETTURA ESPERTO: Carica DDT quando Task completo è disponibile
  React.useEffect(() => {
    const loadDDT = async () => {
      if (!fullTask) {
        setDdtLoading(false);
        return;
      }

      let taskInstance = fullTask;

      if (!taskInstance) {
        // ✅ LOGICA: Il task viene creato solo quando si apre ResponseEditor, dopo aver determinato il tipo
        const finalTaskType = taskMeta.type !== undefined && taskMeta.type !== null ? taskMeta.type : TaskType.UNDEFINED;
        taskInstance = taskRepository.createTask(finalTaskType, null, undefined, instanceKey);
      }

      setDdtLoading(true);

      // ✅ Se c'è templateId → SEMPRE chiama loadDDTFromTemplate (gestisce merge template + override)
      // loadDDTFromTemplate gestisce:
      // - Se mainData è vuoto → costruisce dal template
      // - Se mainData esiste → merge: struttura dal template + override dall'instance
      if (taskInstance?.templateId && taskInstance.templateId !== 'UNDEFINED') {
        const merged = await loadDDTFromTemplate(taskInstance);
        setDdt(merged);
      } else if (taskInstance?.mainData && taskInstance.mainData.length > 0) {
        // ✅ Solo se NON c'è templateId: usa mainData direttamente (DDT standalone, non da template)
        setDdt({
          label: taskInstance.label,
          mainData: taskInstance.mainData,
          stepPrompts: taskInstance.stepPrompts,
          constraints: taskInstance.constraints,
          examples: taskInstance.examples,
          nlpContract: taskInstance.nlpContract,
          introduction: taskInstance.introduction
        });
      } else {
        setDdt(null);
      }

      setDdtLoading(false);
    };

    loadDDT();
  }, [fullTask, instanceKey, refreshTrigger]); // ✅ Dipende da fullTask invece di taskMeta

  // ✅ ARCHITETTURA ESPERTO: Loading combinato (task + ddt)
  const loading = taskLoading || ddtLoading;

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


