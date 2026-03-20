/**
 * Non-React access to the currently active flow canvas id (e.g. 'main', 'subflow_...').
 * Updated by FlowWorkspace / FlowCanvasHost when the user switches tabs.
 */

let activeFlowCanvasId = 'main';

/**
 * Sets the active flow canvas id (called from workspace UI when the active tab changes).
 */
export function setActiveFlowCanvasId(flowId: string): void {
  if (typeof flowId === 'string' && flowId.trim().length > 0) {
    activeFlowCanvasId = flowId.trim();
  }
}

/**
 * Returns the active flow canvas id for variable scope resolution when no explicit flow is passed.
 */
export function getActiveFlowCanvasId(): string {
  return activeFlowCanvasId;
}
