/**
 * Flow canvas overlay from debugger steps: pushes payload to FlowStateBridge and notifies listeners.
 */
import { FlowStateBridge } from '@services/FlowStateBridge';
import type { DebuggerStep } from './core/DebuggerStep';

export const FlowHighlighter = {
  /**
   * Apply graph highlight for one debugger step (immutable snapshot fields).
   */
  apply(step: DebuggerStep): void {
    try {
      FlowStateBridge.setDebuggerFlowHighlight({
        activeNodeId: step.activeNodeId,
        passedNodeIds: step.passedNodeIds ?? [],
        noMatchNodeIds: step.noMatchNodeIds ?? [],
        activeEdgeId: step.activeEdgeId,
      });
    } catch {
      /* non-fatal if bridge unavailable */
    }
  },

  reset(): void {
    try {
      FlowStateBridge.setDebuggerFlowHighlight(null);
      FlowStateBridge.setExecutionState(null);
      FlowStateBridge.setCurrentTask(null);
      FlowStateBridge.setIsRunning(false);
    } catch {
      /* non-fatal if bridge unavailable */
    }
  },
};
