import React from 'react';
import type { EditorProps } from '../EditorHost/types';
import ResponseEditor from './index';
import { taskRepository } from '../../../services/TaskRepository';
import { useProjectDataUpdate } from '../../../context/ProjectDataContext';
import { flowchartVariablesService } from '../../../services/FlowchartVariablesService';
import { getTemplateId } from '../../../utils/taskHelpers';
import { buildDDTFromTemplate } from '../../../utils/ddtMergeUtils';
import { TaskType, taskIdToTaskType } from '../../../types/taskTypes'; // ✅ RINOMINATO: actIdToTaskType → taskIdToTaskType

export default function DDTHostAdapter({ task, onClose }: EditorProps) { // ✅ RINOMINATO: act → task
  // Ottieni projectId corrente per salvare le istanze nel progetto corretto
  const pdUpdate = useProjectDataUpdate();
  const currentProjectId = pdUpdate?.getCurrentProjectId() || null;
  const instanceKey = React.useMemo(() => task.instanceId || task.id, [task.instanceId, task.id]); // ✅ RINOMINATO: act → task


  // FASE 3: Cerca DDT nel Task, crea il Task se non esiste
  // USO useMemo sincrono per evitare che il primo render mostri DDT vuoto
  // getTask() è O(1) Map lookup, quindi veloce e sicuro durante il render
  // FIX: Aggiungiamo un refresh trigger per forzare il ricalcolo quando necessario
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);
  const [existingDDT, setExistingDDT] = React.useState<any | null>(null);

  // ✅ Carica DDT con merge dal template (async)
  React.useEffect(() => {
    const loadDDT = async () => {
      console.log('🔧 [DDTHostAdapter] Loading DDT for instance:', instanceKey);

      // ✅ Usa direttamente task.type (TaskType enum) invece di convertire da stringa
      const taskType = task.type; // ✅ Usa direttamente task.type (TaskType enum)
      let taskInstance = taskRepository.getTask(instanceKey, taskType);

      console.log('🔧 [DDTHostAdapter] Task found:', {
        taskExists: !!taskInstance,
        taskId: taskInstance?.id,
        templateId: taskInstance?.templateId,
        hasMainData: !!taskInstance?.mainData,
        mainDataLength: taskInstance?.mainData?.length || 0
      });

      if (!taskInstance) {
        // ✅ LOGICA: Il task viene creato solo quando si apre ResponseEditor, dopo aver determinato il tipo
        // ✅ Usa direttamente task.type (TaskType enum) invece di convertire da stringa
        const finalTaskType = taskType !== undefined && taskType !== null ? taskType : TaskType.UNDEFINED;
        taskInstance = taskRepository.createTask(finalTaskType, null, undefined, instanceKey);
        console.log('🔧 [DDTHostAdapter] Created new task:', { taskId: taskInstance.id, taskType: finalTaskType });
      }

      // ✅ VB.NET style: se il task ha mainData salvato, usalo direttamente (non ricostruire dal template)
      if (taskInstance?.mainData && taskInstance.mainData.length > 0) {
        // ✅ Usa direttamente il DDT salvato nel task (come VB.NET: modifichi in memoria, salvi tutto)
        console.log('🔧 [DDTHostAdapter] Using saved mainData directly (VB.NET style):', {
          mainDataLength: taskInstance.mainData.length,
          hasSteps: taskInstance.mainData.some((m: any) => m.steps)
        });
        setExistingDDT({
          label: taskInstance.label,
          mainData: taskInstance.mainData,
          stepPrompts: taskInstance.stepPrompts,
          constraints: taskInstance.constraints,
          examples: taskInstance.examples,
          nlpContract: taskInstance.nlpContract,
          introduction: taskInstance.introduction
        });
      } else if (taskInstance?.templateId) {
        // ✅ Solo se NON c'è mainData salvato, ricostruisci dal template
        console.log('🔧 [DDTHostAdapter] No saved mainData, building DDT from template:', taskInstance.templateId);
        const merged = await buildDDTFromTemplate(taskInstance);
        console.log('🔧 [DDTHostAdapter] Merged DDT:', {
          hasDDT: !!merged,
          label: merged?.label,
          mainDataLength: merged?.mainData?.length || 0
        });
        setExistingDDT(merged);
      } else {
        console.log('🔧 [DDTHostAdapter] No DDT found, setting null');
        setExistingDDT(null);
      }
    };

    loadDDT();
  }, [instanceKey, task.id, task.type, refreshTrigger]); // ✅ RINOMINATO: act → task

  // 2. STATE per mantenere il DDT corrente (aggiornato dopo salvataggio)
  // Questo risolve il problema: useMemo non ricalcola quando il Task viene aggiornato
  const [currentDDT, setCurrentDDT] = React.useState<any>(() => {
    // FASE 3: Inizializza placeholder (verrà sostituito da existingDDT quando caricato)
    return null;
  });

  // ✅ Carica DDT iniziale (VB.NET style: usa mainData salvato se disponibile)
  React.useEffect(() => {
    const loadInitialDDT = async () => {
      const taskType = task.type; // ✅ Usa direttamente task.type (TaskType enum)
      const taskInstance = taskRepository.getTask(instanceKey, taskType);

      // ✅ VB.NET style: se il task ha mainData salvato, usalo direttamente
      if (taskInstance?.mainData && taskInstance.mainData.length > 0) {
        setCurrentDDT({
          label: taskInstance.label,
          mainData: taskInstance.mainData,
          stepPrompts: taskInstance.stepPrompts,
          constraints: taskInstance.constraints,
          examples: taskInstance.examples,
          nlpContract: taskInstance.nlpContract,
          introduction: taskInstance.introduction
        });
      } else if (taskInstance?.templateId) {
        // ✅ Solo se NON c'è mainData salvato, ricostruisci dal template
        const merged = await buildDDTFromTemplate(taskInstance);
        if (merged) {
          setCurrentDDT(merged);
        }
      }
    };

    loadInitialDDT();
  }, [instanceKey, task.type]); // ✅ RINOMINATO: act → task

  // ✅ Gestione ProblemClassification: verifica che il DDT abbia kind === "intent"
  React.useEffect(() => {
    if (task.type === TaskType.ClassifyProblem && currentDDT) { // ✅ Usa TaskType enum invece di stringa
      const firstMain = currentDDT?.mainData?.[0];
      const hasCorrectKind = firstMain?.kind === 'intent';

      // Se il DDT ha kind sbagliato, correggilo
      if (!hasCorrectKind) {
        const taskType = task.type; // ✅ Usa direttamente task.type (TaskType enum)
        const taskInstance = taskRepository.getTask(instanceKey, taskType);

        const newDDT = {
          id: `temp_ddt_${task.id}`,
          label: task.label || 'Data',
          _userLabel: task.label,
          _sourceTask: { id: task.id, label: task.label, type: task.type }, // ✅ RINOMINATO: _sourceAct → _sourceTask
          mainData: [{
            label: task.label || 'Intent',
            kind: 'intent', // ✅ FISSO per ProblemClassification
            steps: {},
            subData: []
          }]
        };

        if (taskInstance) {
          taskRepository.updateTask(instanceKey, {
            type: TaskType.DataRequest,  // ✅ type: enum numerico
            templateId: null,            // ✅ templateId: null (standalone)
            ...newDDT
          }, currentProjectId || undefined);
        }

        setCurrentDDT(newDDT);
      }
    } else if (task.type !== TaskType.ClassifyProblem && !currentDDT) { // ✅ Usa TaskType enum invece di stringa
      // Default: placeholder vuoto per altri tipi
      setCurrentDDT({
        id: `temp_ddt_${task.id}`,
        label: task.label || 'Data',
        _userLabel: task.label,
        _sourceTask: { id: task.id, label: task.label, type: task.type }, // ✅ RINOMINATO: _sourceAct → _sourceTask
        mainData: []
      });
    }
  }, [task.type, task.id, task.label, instanceKey, currentDDT, currentProjectId]); // ✅ RINOMINATO: act → task

  // FIX: Listener per aggiornare quando i Task vengono caricati dal database
  React.useEffect(() => {
    const handleTaskLoaded = () => {
      // Forza il ricalcolo di existingDDT quando i Task vengono caricati
      setRefreshTrigger(prev => prev + 1);
    };

    // Ascolta eventi di caricamento Task
    window.addEventListener('tasks:loaded', handleTaskLoaded);

    // Polling: controlla periodicamente se il Task è stato caricato (fallback, solo se non c'è DDT)
    // Si ferma dopo 5 secondi o quando trova il DDT
    let pollCount = 0;
    const maxPolls = 10; // 5 secondi totali (500ms * 10)
    const pollInterval = setInterval(() => {
      pollCount++;
      const task = taskRepository.getTask(instanceKey);
      if (task?.mainData && task.mainData.length > 0 && !existingDDT) {
        console.log('[DDTHostAdapter][POLLING] Task loaded, refreshing DDT', {
          instanceKey,
          hasDDT: !!task.mainData,
          ddtId: task.label,
          pollCount
        });
        setRefreshTrigger(prev => prev + 1);
        clearInterval(pollInterval);
      } else if (pollCount >= maxPolls) {
        clearInterval(pollInterval);
      }
    }, 500); // Controlla ogni 500ms

    return () => {
      window.removeEventListener('tasks:loaded', handleTaskLoaded);
      clearInterval(pollInterval);
    };
  }, [instanceKey, existingDDT]);

  // Aggiorna currentDDT quando existingDDT cambia (al primo load se c'è un DDT salvato)
  React.useEffect(() => {
    // ✅ Se esiste existingDDT, usalo SEMPRE (è quello salvato dall'utente)
    if (existingDDT) {
      // FIX: Aggiorna sempre se existingDDT è diverso da currentDDT (non solo se è placeholder)
      // Questo risolve il problema quando si riapre l'editor: existingDDT viene ricaricato dal Task
      const currentIsPlaceholder = currentDDT.id?.startsWith('temp_ddt_');
      const ddtHasChanged = JSON.stringify(currentDDT) !== JSON.stringify(existingDDT);

      if (currentIsPlaceholder || ddtHasChanged) {
        setCurrentDDT(existingDDT);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingDDT]); // currentDDT intenzionalmente non incluso: controlliamo solo quando existingDDT cambia

  // 3. Quando completi il wizard, salva nel Task E aggiorna lo state
  const handleComplete = React.useCallback(async (finalDDT: any) => {
    // ✅ MIGRATION: Use getTemplateId() helper
    // ✅ FIX: Se c'è un DDT, assicurati che il templateId sia 'DataRequest'
    const task = taskRepository.getTask(instanceKey);
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
        const rowText = taskInstance?.text || task.label || 'Task'; // ✅ RINOMINATO: act → task

        // Extract variables from DDT using row text and DDT labels
        const varNames = await flowchartVariablesService.extractVariablesFromDDT(
          finalDDT,
          instanceKey, // taskId
          instanceKey, // rowId (same as taskId)
          rowText, // Row text (e.g., "chiedi data di nascita")
          undefined // nodeId (not available here)
        );

        console.log('[DDTHostAdapter] Extracted variables from DDT', {
          taskId: instanceKey,
          rowText,
          varCount: varNames.length,
          varNames: varNames.slice(0, 10) // Log first 10
        });

        // Emit event to refresh ConditionEditor variables
        try {
          document.dispatchEvent(new CustomEvent('flowchart:variablesUpdated', {
            bubbles: true
          }));
        } catch {}
      }
    } catch (e) {
      console.warn('[DDTHostAdapter] Failed to extract variables from DDT', e);
    }

    // CRITICO: Aggiorna immediatamente currentDDT per aggiornare il prop ddt
    // Questo evita che useDDTInitialization sincronizzi localDDT con il placeholder vuoto
    setCurrentDDT(finalDDT);

    // FIX: Forza il ricalcolo di existingDDT per sincronizzare
    setRefreshTrigger(prev => prev + 1);
  }, [instanceKey, currentProjectId, task.label]); // ✅ RINOMINATO: act → task



  // ✅ Ensure mainData is always an array before passing to ResponseEditor
  const safeDDT = React.useMemo(() => {
    if (!currentDDT) return null;
    return {
      ...currentDDT,
      mainData: Array.isArray(currentDDT.mainData) ? currentDDT.mainData : []
    };
  }, [currentDDT]);

  // ✅ Stable key per impedire re-mount durante l'editing
  const editorKey = React.useMemo(() => {
    const instanceKey = task.instanceId || task.id || 'unknown';
    return `response-editor-${instanceKey}`;
  }, [task.instanceId, task.id]); // ✅ RINOMINATO: act → task

  // ✅ Stable task prop (solo i campi necessari, memoizzato)
  const stableTask = React.useMemo(() => {
    if (!task) return undefined;
    return {
      id: task.id,
      type: task.type,
      label: task.label,
      instanceId: task.instanceId
    };
  }, [task.id, task.type, task.label, task.instanceId]); // ✅ RINOMINATO: act → task, stableAct → stableTask

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
      task={stableTask} // ✅ RINOMINATO: act → task
    />
  );
}


