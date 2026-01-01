import { useState, useEffect } from 'react';
import { estraiNodiDaDDT } from './treeFactories';

export function useSelectedNode(
  ddt: any, 
  dispatch: (action: any) => void, 
  lang: string, 
  translations: any
) {
  const [selectedNodeIndex, setSelectedNodeIndex] = useState<number | null>(null);

  const getNodeByIndex = (mainData: any, index: number | null) => {
    if (index == null) return mainData;
    if (!mainData.subData || !mainData.subData[index]) return mainData;
    return mainData.subData[index];
  };

  const handleSelectNode = (index: number | null) => {
    setSelectedNodeIndex(index);
    
    // Get the new node
    const node = getNodeByIndex(ddt?.mainData || {}, index);
    
    // Set the first step as selected, if available
    if (node && node.steps && node.steps.length > 0) {
      dispatch({ type: 'SET_STEP', step: node.steps[0].type });
    } else {
      dispatch({ type: 'SET_STEP', step: '' });
    }
  };

  const selectedNode = getNodeByIndex(ddt?.mainData || {}, selectedNodeIndex);

  // Log selectedNodeIndex and selectedNode whenever they change
  useEffect(() => {
    const mainData = ddt?.mainData || {};
    const node = getNodeByIndex(mainData, selectedNodeIndex);
    if (node && node.steps) {
      node.steps.forEach((step: any, idx: any) => {
        if (step.escalations) {
        }
      });
    } else {
    }
  }, [selectedNodeIndex, ddt]);

  // Extract nodes for the selected node
  useEffect(() => {
    const node = getNodeByIndex(ddt?.mainData || {}, selectedNodeIndex);
    const estratti = estraiNodiDaDDT(node, translations, lang);
    dispatch({ type: 'SET_NODES', nodes: estratti });
  }, [selectedNodeIndex, translations, lang, ddt, dispatch]);

  return {
    selectedNodeIndex,
    handleSelectNode,
    selectedNode,
  };
} 