import { useMemo } from 'react';
import { estraiNodiDaDDT } from '../ResponseEditor/treeFactories';

// Hook per i valori calcolati dell'editor
export function useEditorComputed(
  ddt: any,
  translations: any,
  lang: string,
  selectedNodeIndex: number | null,
  nodes: any[],
  selectedStep: string
) {
  // Calcola il nodo selezionato (mainData o subData[x])
  const selectedNode = useMemo(() => {
    if (!ddt?.mainData) return null;
    
    if (selectedNodeIndex === null) {
      return ddt.mainData;
    }
    
    if (ddt.mainData.subData && ddt.mainData.subData[selectedNodeIndex]) {
      return ddt.mainData.subData[selectedNodeIndex];
    }
    
    return ddt.mainData;
  }, [ddt?.mainData, selectedNodeIndex]);

  // Estrae nodi quando cambia il selectedNode
  const extractedNodes = useMemo(() => {
    if (!selectedNode) return [];
    
    try {
      return estraiNodiDaDDT(selectedNode, translations, lang);
    } catch (error) {
      console.error('[useDDTEditor] Errore estrazione nodi:', error);
      return [];
    }
  }, [selectedNode, translations, lang]);

  // Miglioria: filteredNodes calcolato al volo, non in state
  const filteredNodes = useMemo(() => {
    if (!selectedStep) return [];
    
    return nodes.filter((node: any) => {
      // Per step 'start' e 'success': solo azioni dirette
      if (selectedStep === 'start' || selectedStep === 'success') {
        return node.level === 0 && !node.parentId;
      }
      
      // Per altri step: mostra escalation e azioni figlie
      return node.stepType === selectedStep;
    });
  }, [nodes, selectedStep]);

  return {
    selectedNode,
    extractedNodes,
    filteredNodes
  };
} 