/**
 * Context for opening subflow tabs from Flow-type node rows.
 * Provided by FlowEditor when rendered inside a flow tab; consumed by CustomNode/NodeRow.
 */
import React, { createContext, useContext } from 'react';

export interface FlowSubflowContextValue {
  /** taskId, optional existingFlowId, optional title (row label → tab title) */
  onOpenSubflowForTask?: (taskId: string, existingFlowId?: string, title?: string) => void;
}

const FlowSubflowContext = createContext<FlowSubflowContextValue>({});

export function useFlowSubflow(): FlowSubflowContextValue {
  return useContext(FlowSubflowContext);
}

export const FlowSubflowProvider = FlowSubflowContext.Provider;
