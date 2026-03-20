/**
 * React context: current flow canvas id for nodes/edges (matches FlowEditor flowId prop).
 */

import React, { createContext, useContext, useEffect } from 'react';
import { setActiveFlowCanvasId } from '../../../flows/activeFlowCanvas';

const FlowCanvasContext = createContext<string>('main');

export interface FlowCanvasProviderProps {
  flowId: string;
  children: React.ReactNode;
}

export function FlowCanvasProvider({ flowId, children }: FlowCanvasProviderProps): React.ReactElement {
  const id = typeof flowId === 'string' && flowId.trim() ? flowId.trim() : 'main';

  useEffect(() => {
    setActiveFlowCanvasId(id);
  }, [id]);

  return <FlowCanvasContext.Provider value={id}>{children}</FlowCanvasContext.Provider>;
}

/**
 * Returns the flow canvas id for the enclosing FlowEditor (e.g. 'main', 'subflow_...').
 */
export function useFlowCanvasId(): string {
  return useContext(FlowCanvasContext);
}
