import { useState, useEffect } from 'react';
import { estraiNodiDaDDT } from './treeFactories';

export function useSelectedNode(
  ddt: any,
  dispatch: (action: any) => void,
  lang: string,
  translations: any
) {
  const [selectedNodeIndex, setSelectedNodeIndex] = useState<number | null>(null);

  // ✅ NUOVO MODELLO: Usa nodes[] e subNodes[] invece di data[] e subData[]
  const getNodeByIndex = (taskTree: any, mainIndex: number | null, subIndex: number | null) => {
    if (!taskTree || !taskTree.nodes) return null;
    if (mainIndex == null || mainIndex < 0 || mainIndex >= taskTree.nodes.length) return null;
    const main = taskTree.nodes[mainIndex];
    if (subIndex == null) return main;
    if (!main.subNodes || subIndex < 0 || subIndex >= main.subNodes.length) return main;
    return main.subNodes[subIndex];
  };

  const handleSelectNode = (mainIndex: number | null, subIndex: number | null = null) => {
    setSelectedNodeIndex(mainIndex);

    // Get the new node
    const node = getNodeByIndex(ddt, mainIndex, subIndex);

    // Set the first step as selected, if available
    if (node && node.steps && Array.isArray(node.steps) && node.steps.length > 0) {
      // ✅ Estrai tipo step da templateStepId (formato: `${nodeTemplateId}:${stepKey}`)
      const firstStep = node.steps[0];
      const stepType = firstStep.templateStepId?.split(':').pop() || 'start';
      dispatch({ type: 'SET_STEP', step: stepType });
    } else {
      dispatch({ type: 'SET_STEP', step: '' });
    }
  };

  const selectedNode = getNodeByIndex(ddt, selectedNodeIndex, null);

  // Log selectedNodeIndex and selectedNode whenever they change
  useEffect(() => {
    const node = getNodeByIndex(ddt, selectedNodeIndex, null);
    if (node && node.steps && Array.isArray(node.steps)) {
      node.steps.forEach((step: any) => {
        if (step?.escalations) {
          // ✅ Processa escalations
        }
      });
    }
  }, [selectedNodeIndex, ddt]);

  // Extract nodes for the selected node
  useEffect(() => {
    const node = getNodeByIndex(ddt, selectedNodeIndex, null);
    if (node) {
      const estratti = estraiNodiDaDDT(node, translations, lang);
      dispatch({ type: 'SET_NODES', nodes: estratti });
    }
  }, [selectedNodeIndex, translations, lang, ddt, dispatch]);

  return {
    selectedNodeIndex,
    handleSelectNode,
    selectedNode,
  };
}