import React from 'react';
import type { EditorProps } from '../EditorHost/types';
import ResponseEditor from './index';
import { taskRepository } from '../../../services/TaskRepository';
import { useProjectDataUpdate } from '../../../context/ProjectDataContext';

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
  const existingDDT = React.useMemo(() => {
    // FIX: Passa actType per garantire mapping corretto del DDT
    const actType = act.type as any;
    let task = taskRepository.getTask(instanceKey, actType);

    if (!task) {
      const actId = act.id || '';
      // Map actId to action (e.g., 'DataRequest' -> 'GetData')
      const action = actId === 'DataRequest' ? 'GetData' : (actId === 'Message' ? 'SayMessage' : actId);
      task = taskRepository.createTask(action, undefined, instanceKey);
    }

    const ddt = task?.value?.ddt || null;
    return ddt;
  }, [instanceKey, act.id, act.type, refreshTrigger]); // Aggiunto act.type per forzare ricalcolo quando cambia

  // 2. STATE per mantenere il DDT corrente (aggiornato dopo salvataggio)
  // Questo risolve il problema: useMemo non ricalcola quando il Task viene aggiornato
  const [currentDDT, setCurrentDDT] = React.useState<any>(() => {
    // FASE 3: Inizializza dal Task se esiste, altrimenti placeholder
    // FIX: Passa actType per garantire mapping corretto del DDT
    const actType = act.type as any;
    const task = taskRepository.getTask(instanceKey, actType);
    const instanceDDT = task?.value?.ddt;

    // DEBUG: Log dettagliato per verificare se il DDT viene caricato correttamente
    if (instanceDDT && act.type === 'ProblemClassification') {
      console.log('[DDTHostAdapter][INIT][DEBUG] DDT loaded for ProblemClassification', {
        instanceKey,
        ddtId: instanceDDT.id,
        firstMainKind: instanceDDT.mainData?.[0]?.kind,
        hasSteps: !!instanceDDT.mainData?.[0]?.steps,
        stepsKeys: instanceDDT.mainData?.[0]?.steps ? Object.keys(instanceDDT.mainData[0].steps) : [],
        stepsContent: instanceDDT.mainData?.[0]?.steps || {},
        // Verifica struttura dettagliata
        startStep: instanceDDT.mainData?.[0]?.steps?.start,
        noInputStep: instanceDDT.mainData?.[0]?.steps?.noInput,
        noMatchStep: instanceDDT.mainData?.[0]?.steps?.noMatch,
        confirmationStep: instanceDDT.mainData?.[0]?.steps?.confirmation
      });
    }


    // ✅ Se ProblemClassification, verifica che il DDT abbia kind === "intent"
    if (act.type === 'ProblemClassification') {
      // Verifica se il DDT esistente ha kind === "intent"
      const firstMain = instanceDDT?.mainData?.[0];
      const hasCorrectKind = firstMain?.kind === 'intent';

      // Se NON esiste DDT o ha kind sbagliato, inizializza/resetta con kind: "intent"
      if (!instanceDDT || !hasCorrectKind) {

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

        // ✅ Se il Task esiste ma ha DDT con kind sbagliato, correggilo
        if (task && instanceDDT && !hasCorrectKind) {
          // FASE 3: Update Task (TaskRepository syncs with InstanceRepository automatically)
          taskRepository.updateTaskValue(instanceKey, { ddt: newDDT }, currentProjectId || undefined);
        }

        return newDDT;
      }

      // Se il DDT esiste e ha kind === "intent", usalo
      return instanceDDT;
    }

    // ✅ Per altri tipi, se esiste instanceDDT usalo, altrimenti placeholder vuoto
    if (instanceDDT) {
      return instanceDDT;
    }

    // Default: placeholder vuoto per altri tipi
    return {
      id: `temp_ddt_${act.id}`,
      label: act.label || 'Data',
      _userLabel: act.label,
      _sourceAct: { id: act.id, label: act.label, type: act.type },
      mainData: []
    };
  });

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
      if (task?.value?.ddt && !existingDDT) {
        console.log('[DDTHostAdapter][POLLING] Task loaded, refreshing DDT', {
          instanceKey,
          hasDDT: !!task.value.ddt,
          ddtId: task.value.ddt?.id,
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
  const handleComplete = React.useCallback((finalDDT: any) => {
    // FASE 3: Salva il DDT nel Task (TaskRepository syncs with InstanceRepository automatically)
    taskRepository.updateTaskValue(instanceKey, { ddt: finalDDT }, currentProjectId || undefined);

    // CRITICO: Aggiorna immediatamente currentDDT per aggiornare il prop ddt
    // Questo evita che useDDTInitialization sincronizzi localDDT con il placeholder vuoto
    setCurrentDDT(finalDDT);

    // FIX: Forza il ricalcolo di existingDDT per sincronizzare
    setRefreshTrigger(prev => prev + 1);
  }, [instanceKey, currentProjectId]);


  return (
    <ResponseEditor
      ddt={currentDDT}
      onClose={onClose}
      onWizardComplete={handleComplete}
      act={act}
    />
  );
}


