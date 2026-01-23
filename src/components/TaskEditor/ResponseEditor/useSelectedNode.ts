import { useState, useEffect } from 'react';
import { estraiNodiDaDDT } from './treeFactories';

export function useSelectedNode(
  ddt: any, 
  dispatch: (action: any) => void, 
  lang: string, 
  translations: any
) {
  const [selectedNodeIndex, setSelectedNodeIndex] = useState<number | null>(null);

  const getNodeByIndex = (data: any, index: number | null) => {
    if (index == null) return data;
    if (!data.subData || !data.subData[index]) return data;
    return data.subData[index];
  };

  const handleSelectNode = (index: number | null) => {
    setSelectedNodeIndex(index);
    
    // Get the new node
    const node = getNodeByIndex(ddt?.data || {}, index);
    
    // Set the first step as selected, if available
    if (node && node.steps && node.steps.length > 0) {
      dispatch({ type: 'SET_STEP', step: node.steps[0].type });
    } else {
      dispatch({ type: 'SET_STEP', step: '' });
    }
  };

  const selectedNode = getNodeByIndex(ddt?.data || {}, selectedNodeIndex);

  // Log selectedNodeIndex and selectedNode whenever they change
  useEffect(() => {
    const data = ddt?.data || {};
    const node = getNodeByIndex(data, selectedNodeIndex);
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
    const node = getNodeByIndex(ddt?.data || {}, selectedNodeIndex);
    const estratti = estraiNodiDaDDT(node, translations, lang);
    dispatch({ type: 'SET_NODES', nodes: estratti });
  }, [selectedNodeIndex, translations, lang, ddt, dispatch]);

  return {
    selectedNodeIndex,
    handleSelectNode,
    selectedNode,
  };
} 