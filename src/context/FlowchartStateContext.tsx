// Context for flowchart state
// Provides reactive access to flowchart nodes count

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Node } from 'reactflow';
import type { FlowNode } from '../components/Flowchart/types/flowTypes';

interface FlowchartStateContextValue {
  hasNodes: boolean;
  nodesCount: number;
  setNodes: (nodes: Node<FlowNode>[]) => void;
}

const FlowchartStateContext = createContext<FlowchartStateContextValue | undefined>(undefined);

export function FlowchartStateProvider({ children }: { children: React.ReactNode }) {
  const [nodes, setNodesState] = useState<Node<FlowNode>[]>([]);

  const setNodes = useCallback((newNodes: Node<FlowNode>[]) => {
    setNodesState(newNodes);
  }, []);

  const hasNodes = nodes.length > 0;
  const nodesCount = nodes.length;

  return (
    <FlowchartStateContext.Provider value={{ hasNodes, nodesCount, setNodes }}>
      {children}
    </FlowchartStateContext.Provider>
  );
}

export function useFlowchartState() {
  const context = useContext(FlowchartStateContext);
  if (!context) {
    throw new Error('useFlowchartState must be used within FlowchartStateProvider');
  }
  return context;
}
