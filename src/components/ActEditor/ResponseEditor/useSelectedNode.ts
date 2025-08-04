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
    console.log('[DEEP LOG] [handleSelectNode] index:', index);
    setSelectedNodeIndex(index);
    
    // Get the new node
    const node = getNodeByIndex(ddt?.mainData || {}, index);
    console.log('[DEEP LOG] [handleSelectNode] node:', node);
    
    // Set the first step as selected, if available
    if (node && node.steps && node.steps.length > 0) {
      console.log('[DEEP LOG] [handleSelectNode] setting step:', node.steps[0].type);
      dispatch({ type: 'SET_STEP', step: node.steps[0].type });
    } else {
      console.log('[DEEP LOG] [handleSelectNode] no steps found, setting step to empty string');
      dispatch({ type: 'SET_STEP', step: '' });
    }
  };

  const selectedNode = getNodeByIndex(ddt?.mainData || {}, selectedNodeIndex);

  // Log selectedNodeIndex and selectedNode whenever they change
  useEffect(() => {
    const mainData = ddt?.mainData || {};
    const node = getNodeByIndex(mainData, selectedNodeIndex);
    console.log('[DEBUG] [useSelectedNode] selectedNodeIndex:', selectedNodeIndex, 'selectedNode:', node);
    if (node && node.steps) {
      console.log('[DEBUG] [useSelectedNode] node.steps:', node.steps.map((s: any) => s.type));
      node.steps.forEach((step: any, idx: any) => {
        if (step.escalations) {
          console.log(`[DEBUG] [useSelectedNode] step ${step.type} escalations:`, step.escalations);
        }
      });
    } else {
      console.log('[DEBUG] [useSelectedNode] No steps found for selected node.');
    }
  }, [selectedNodeIndex, ddt]);

  // Extract nodes for the selected node
  useEffect(() => {
    const node = getNodeByIndex(ddt?.mainData || {}, selectedNodeIndex);
    console.log('[DEEP LOG] [useSelectedNode] selectedNodeIndex:', selectedNodeIndex, 'node:', node);
    const estratti = estraiNodiDaDDT(node, translations, lang);
    console.log('[DEEP LOG] [useSelectedNode] estraiNodiDaDDT output:', estratti);
    dispatch({ type: 'SET_NODES', nodes: estratti });
  }, [selectedNodeIndex, translations, lang, ddt, dispatch]);

  return {
    selectedNodeIndex,
    handleSelectNode,
    selectedNode,
  };
} 