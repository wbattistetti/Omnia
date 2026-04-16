/**
 * Pure reducer for immutable debugger session state (steps only).
 */
import type { DebuggerStep } from './DebuggerStep';

export type DebuggerSessionState = {
  readonly steps: readonly DebuggerStep[];
};

export const initialDebuggerSessionState: DebuggerSessionState = {
  steps: [],
};

export type DebuggerSessionAction =
  | { type: 'RESET' }
  | { type: 'APPEND_STEP'; step: DebuggerStep }
  | { type: 'REPLACE_STEPS'; steps: readonly DebuggerStep[] };

export function debuggerSessionReducer(
  state: DebuggerSessionState,
  action: DebuggerSessionAction
): DebuggerSessionState {
  switch (action.type) {
    case 'RESET':
      return { steps: [] };
    case 'APPEND_STEP':
      return { steps: [...state.steps, action.step] };
    case 'REPLACE_STEPS':
      return { steps: [...action.steps] };
    default:
      return state;
  }
}
