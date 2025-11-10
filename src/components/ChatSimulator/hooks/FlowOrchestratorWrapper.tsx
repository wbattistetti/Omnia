// Flow Orchestrator Wrapper: Conditionally uses new or old orchestrator

import React from 'react';
import type { Node, Edge } from 'reactflow';
import type { NodeData, EdgeData } from '../../Flowchart/types/flowTypes';
import { useFlowOrchestrator } from './useFlowOrchestrator';
import { useNewFlowOrchestrator } from './useNewFlowOrchestrator';

interface FlowOrchestratorWrapperProps {
  nodes: Node<NodeData>[];
  edges: Edge<EdgeData>[];
  mode: 'single-ddt' | 'flow';
  children: (orchestrator: ReturnType<typeof useFlowOrchestrator>) => React.ReactNode;
}

/**
 * Wrapper that conditionally uses new or old orchestrator based on feature flag
 */
export function FlowOrchestratorWrapper({
  nodes,
  edges,
  mode,
  children
}: FlowOrchestratorWrapperProps) {
  // Feature flag: use new compiler-based orchestrator
  const useNew = React.useMemo(() => {
    try {
      return localStorage.getItem('feature.newFlowOrchestrator') === '1';
    } catch {
      return false;
    }
  }, []);

  // Use new orchestrator if flag is enabled and in flow mode
  const newOrchestrator = useNew && mode === 'flow'
    ? useNewFlowOrchestrator({
        nodes,
        edges,
        onMessage: () => {}, // TODO: Connect to message handler
        onDDTStart: () => {}, // TODO: Connect to DDT handler
        onDDTComplete: () => {} // TODO: Connect to completion handler
      })
    : null;

  // Use old orchestrator as fallback
  const oldOrchestrator = useFlowOrchestrator({ nodes, edges });

  // Return appropriate orchestrator
  const orchestrator = newOrchestrator || oldOrchestrator;

  return <>{children(orchestrator)}</>;
}

