import React from 'react';
import type { EditorProps } from '../EditorHost/types';
import ResponseEditor from './index';
import { taskRepository } from '../../../services/TaskRepository';
import { useProjectDataUpdate } from '../../../context/ProjectDataContext';
import { flowchartVariablesService } from '../../../services/FlowchartVariablesService';
import { getTemplateId } from '../../../utils/taskHelpers';
import { buildDDTFromTemplate } from '../../../utils/ddtMergeUtils';
import { TaskType, actIdToTaskType } from '../../../types/taskTypes';

export default function DDTHostAdapter({ act, onClose }: EditorProps) {
  // Ottieni projectId corrente per salvare le istanze nel progetto corretto
  const pdUpdate = useProjectDataUpdate();
  const currentProjectId = pdUpdate?.getCurrentProjectId() || null;
  const instanceKey = React.useMemo(() => act.instanceId || act.id, [act.instanceId, act.id]);


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

      // FIX: Passa actType per garantire mapping corretto del DDT
      const actType = act.type as any;
      let task = taskRepository.getTask(instanceKey, actType);

      console.log('🔧 [DDTHostAdapter] Task found:', {
        taskExists: !!task,
        taskId: task?.id,
        templateId: task?.templateId,
        hasMainData: !!task?.mainData,
        mainDataLength: task?.mainData?.length || 0
      });

      if (!task) {
        // ✅ LOGICA: Il task viene creato solo quando si apre ResponseEditor, dopo aver determinato il tipo
        // ✅ Se act.type è UNDEFINED, l'euristica determinerà il tipo e poi creerà/aggiornerà il task
        // ✅ Per ora, crea con il tipo da act.type (se non è UNDEFINED) o aspetta che l'euristica lo determini
        const actType = act.type || 'UNDEFINED';
        let taskType = TaskType.UNDEFINED;

        if (actType !== 'UNDEFINED') {
          // ✅ Tipo già determinato (non UNDEFINED) - crea task con tipo corretto
          taskType = actIdToTaskType(actType);
        } else {
          // ✅ Tipo UNDEFINED - l'euristica determinerà il tipo e creerà/aggiornerà il task
          // ✅ Per ora, crea con UNDEFINED (verrà aggiornato dall'euristica)
          taskType = TaskType.UNDEFINED;
        }

        task = taskRepository.createTask(taskType, null, undefined, instanceKey);
        console.log('🔧 [DDTHostAdapter] Created new task:', { taskId: task.id, taskType, actType });
      }

      // ✅ VB.NET style: se il task ha mainData salvato, usalo direttamente (non ricostruire dal template)
      if (task?.mainData && task.mainData.length > 0) {
        // ✅ Usa direttamente il DDT salvato nel task (come VB.NET: modifichi in memoria, salvi tutto)
        console.log('🔧 [DDTHostAdapter] Using saved mainData directly (VB.NET style):', {
          mainDataLength: task.mainData.length,
          hasSteps: task.mainData.some((m: any) => m.steps)
        });
        setExistingDDT({
          label: task.label,
          mainData: task.mainData,
          stepPrompts: task.stepPrompts,
          constraints: task.constraints,
          examples: task.examples,
          nlpContract: task.nlpContract,
          introduction: task.introduction
        });
      } else if (task?.templateId) {
        // ✅ Solo se NON c'è mainData salvato, ricostruisci dal template
        console.log('🔧 [DDTHostAdapter] No saved mainData, building DDT from template:', task.templateId);
        const merged = await buildDDTFromTemplate(task);
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
  }, [instanceKey, act.id, act.type, refreshTrigger]); // Aggiunto act.type per forzare ricalcolo quando cambia

  // 2. STATE per mantenere il DDT corrente (aggiornato dopo salvataggio)
  // Questo risolve il problema: useMemo non ricalcola quando il Task viene aggiornato
  const [currentDDT, setCurrentDDT] = React.useState<any>(() => {
    // FASE 3: Inizializza placeholder (verrà sostituito da existingDDT quando caricato)
    return null;
  });

  // ✅ Carica DDT iniziale (VB.NET style: usa mainData salvato se disponibile)
  React.useEffect(() => {
    const loadInitialDDT = async () => {
      const actType = act.type as any;
      const task = taskRepository.getTask(instanceKey, actType);

      // ✅ VB.NET style: se il task ha mainData salvato, usalo direttamente
      if (task?.mainData && task.mainData.length > 0) {
        setCurrentDDT({
          label: task.label,
          mainData: task.mainData,
          stepPrompts: task.stepPrompts,
          constraints: task.constraints,
          examples: task.examples,
          nlpContract: task.nlpContract,
          introduction: task.introduction
        });
      } else if (task?.templateId) {
        // ✅ Solo se NON c'è mainData salvato, ricostruisci dal template
        const merged = await buildDDTFromTemplate(task);
        if (merged) {
          setCurrentDDT(merged);
        }
      }
    };

    loadInitialDDT();
  }, [instanceKey, act.type]);

  // ✅ Gestione ProblemClassification: verifica che il DDT abbia kind === "intent"
  React.useEffect(() => {
    if (act.type === 'ProblemClassification' && currentDDT) {
      const firstMain = currentDDT?.mainData?.[0];
      const hasCorrectKind = firstMain?.kind === 'intent';

      // Se il DDT ha kind sbagliato, correggilo
      if (!hasCorrectKind) {
        const actType = act.type as any;
        const task = taskRepository.getTask(instanceKey, actType);

        const newDDT = {
          id: `temp_ddt_${act.id}`,
          label: act.label || 'Data',
          _userLabel: act.label,
          _sourceAct: { id: act.id, label: act.label, type: act.type },
          mainData: [{
            label: act.label || 'Intent',
            kind: 'intent', // ✅ FISSO per ProblemClassification
            steps: {},
            subData: []
          }]
        };

        if (task) {
          taskRepository.updateTask(instanceKey, {
            type: TaskType.DataRequest,  // ✅ type: enum numerico
            templateId: null,            // ✅ templateId: null (standalone)
            ...newDDT
          }, currentProjectId || undefined);
        }

        setCurrentDDT(newDDT);
      }
    } else if (act.type !== 'ProblemClassification' && !currentDDT) {
      // Default: placeholder vuoto per altri tipi
      setCurrentDDT({
        id: `temp_ddt_${act.id}`,
        label: act.label || 'Data',
        _userLabel: act.label,
        _sourceAct: { id: act.id, label: act.label, type: act.type },
        mainData: []
      });
    }
  }, [act.type, act.id, act.label, instanceKey, currentDDT, currentProjectId]);

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
        const task = taskRepository.getTask(instanceKey);
        const rowText = task?.text || act.name || act.label || 'Task';

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
  }, [instanceKey, currentProjectId, act.name, act.label]);



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
    const instanceKey = act.instanceId || act.id || 'unknown';
    return `response-editor-${instanceKey}`;
  }, [act.instanceId, act.id]);

  // ✅ Stable act prop (solo i campi necessari, memoizzato)
  const stableAct = React.useMemo(() => {
    if (!act) return undefined;
    return {
      id: act.id,
      type: act.type,
      label: act.label,
      instanceId: act.instanceId
    };
  }, [act.id, act.type, act.label, act.instanceId]);

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
      act={stableAct}
    />
  );
}


