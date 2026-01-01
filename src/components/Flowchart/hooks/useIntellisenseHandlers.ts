import { useCallback } from 'react';
import { taskRepository } from '../../../services/TaskRepository';
import { useProjectData, useProjectDataUpdate } from '../../../context/ProjectDataContext';
// ✅ RIMOSSO: findAgentAct - non esiste più il concetto di Act
import { createRowWithTask } from '../../../utils/taskHelpers';
import { taskIdToTaskType } from '../../../types/taskTypes'; // ✅ RINOMINATO: actIdToTaskType → taskIdToTaskType - Per convertire stringa semantica legacy a TaskType enum

export function useIntellisenseHandlers(
  nodeIntellisenseTarget: string | null,
  setNodes: any,
  setShowNodeIntellisense: any,
  setNodeIntellisenseTarget: any
) {
  const { data: projectData } = useProjectData();
  const pdUpdate = useProjectDataUpdate();

  // Handler per gestire selezione items nell'IntellisenseMenu
  const handleIntellisenseSelect = useCallback((item: any) => {
    if (!nodeIntellisenseTarget) return;

    console.log("✅ [INTELLISENSE] Item selected:", {
      item,
      targetNode: nodeIntellisenseTarget,
      itemType: item.categoryType,
      timestamp: Date.now()
    });

    // Determina se l'item è un ProblemClassification (intent)
    const isProblemClassification = item.kind === 'intent' || item.category === 'Problem Intents';

    let instanceId: string | undefined;
    let actId: string | undefined;

    // Se è un ProblemClassification, crea un'istanza nel repository
    if (isProblemClassification && item.value) {
      actId = item.value; // L'ID del template

      // ✅ RIMOSSO: findAgentAct - gli intents sono nel task.intents (campi diretti)
      // ✅ Recupera gli intents dal task se esiste già
      const initialIntents: any[] = [];
      try {
        const task = taskRepository.getTask(actId);
        if (task?.intents) {
          initialIntents.push(...task.intents);
        }
      } catch (err) {
        // Ignore
      }

      // FASE 6C: Crea Task nel TaskRepository (createRowWithTask gestisce anche InstanceRepository per compatibilità)
      if (!actId) {
        console.error('[INTELLISENSE] Cannot create Task: actId is undefined');
        return;
      }

      const projectId = pdUpdate?.getCurrentProjectId() || undefined;
      // Genera un ID temporaneo per la row (sarà sostituito quando la row viene creata definitivamente)
      const tempRowId = `${nodeIntellisenseTarget}-${Date.now()}`;
      // ✅ Converti actId (stringa da Intellisense) a TaskType enum
      const taskType = taskIdToTaskType(actId); // ✅ RINOMINATO: actIdToTaskType → taskIdToTaskType
      const rowWithTask = createRowWithTask(tempRowId, taskType, '', projectId); // ✅ TaskType enum invece di stringa
      instanceId = rowWithTask.taskId;

      // Se ci sono intents iniziali, aggiorna il Task
      if (initialIntents.length > 0) {
        taskRepository.updateTask(instanceId, { intents: initialIntents }, projectId);
      }

      console.log("✅ [INTELLISENSE] Created Task for ProblemClassification:", {
        instanceId,
        taskId: rowWithTask.taskId,
        actId,
        initialIntentsCount: initialIntents.length,
        timestamp: Date.now()
      });
    }

    // Aggiorna la prima riga del nodo temporaneo con l'item selezionato
    setNodes((nds: any) => nds.map((n: any) => {
      if (n.id === nodeIntellisenseTarget) {
        const updatedRows = [{
          id: `${nodeIntellisenseTarget}-1`,
          text: item.label || item.name || item.value || item,
          included: true,
          type: isProblemClassification ? 'ProblemClassification' : 'Message',
          mode: isProblemClassification ? undefined : 'Message',
          instanceId,  // Aggiungi instanceId se creato
          actId,       // Aggiungi actId se disponibile
        }];

        console.log("✅ [INTELLISENSE] Updated row with instance:", {
          rowId: updatedRows[0].id,
          instanceId,
          actId,
          type: updatedRows[0].type,
          timestamp: Date.now()
        });

        return {
          ...n,
          data: {
            ...n.data,
            rows: updatedRows
          }
        };
      }
      return n;
    }));

    // Chiudi il menu
    setShowNodeIntellisense(false);
    setNodeIntellisenseTarget(null);

  }, [nodeIntellisenseTarget, setNodes, setShowNodeIntellisense, setNodeIntellisenseTarget, projectData]);

  // Handler per chiudere l'IntellisenseMenu
  const handleIntellisenseClose = useCallback(() => {
    setShowNodeIntellisense(false);
    setNodeIntellisenseTarget(null);
  }, [setShowNodeIntellisense, setNodeIntellisenseTarget]);

  return {
    handleIntellisenseSelect,
    handleIntellisenseClose
  };
}
