/**
 * Clears flow canvas execution highlights driven by FlowStateBridge window globals.
 */
import { FlowStateBridge } from '@services/FlowStateBridge';

export const FlowHighlighter = {
  reset(): void {
    try {
      FlowStateBridge.setExecutionState(null);
      FlowStateBridge.setCurrentTask(null);
      FlowStateBridge.setIsRunning(false);
    } catch {
      /* non-fatal if bridge unavailable */
    }
  },
};
