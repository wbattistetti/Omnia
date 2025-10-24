import { useCallback } from 'react';
import { instanceRepository } from '../../../services/InstanceRepository';
import { useProjectData } from '../../../context/ProjectDataContext';
import { findAgentAct } from '../utils/actVisuals';

export function useIntellisenseHandlers(
  nodeIntellisenseTarget: string | null,
  setNodes: any,
  setShowNodeIntellisense: any,
  setNodeIntellisenseTarget: any
) {
  const { data: projectData } = useProjectData();

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

      // Cerca il template nel projectData per recuperare gli intents
      const templateAct = projectData ? findAgentAct(projectData, { actId }) : null;
      const initialIntents = templateAct?.problem?.intents || [];

      // Crea istanza nel repository
      if (!actId) {
        console.error('[INTELLISENSE] Cannot create instance: actId is undefined');
        return;
      }

      const instance = instanceRepository.createInstance(actId, initialIntents);
      instanceId = instance.instanceId;

      console.log("✅ [INTELLISENSE] Created instance for ProblemClassification:", {
        instanceId,
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
