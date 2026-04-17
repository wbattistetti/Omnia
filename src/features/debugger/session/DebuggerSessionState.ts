/**
 * Aggregate in-memory debugger session (single source of truth for timeline + replay flags).
 */
import type { DebuggerStep } from '../core/DebuggerStep';

export type DebuggerSessionStatus =
  | 'idle'
  | 'running'
  | 'waitingForInput'
  | 'replaying'
  | 'cleared';

export type DebuggerReplayMode = 'off' | 'backend' | 'uiOnly';

export type DebuggerAggregateSessionState = {
  readonly steps: readonly DebuggerStep[];
  readonly status: DebuggerSessionStatus;
  readonly activeStepId: string | null;
  readonly lastNluPatchId: string | null;
  readonly replay: {
    readonly mode: DebuggerReplayMode;
    readonly cursor: number | null;
    readonly totalTurns: number;
  };
  readonly orchestratorSessionId: string | null;
  readonly lastError: string | null;
};

/** @alias DebuggerAggregateSessionState — name used by reducer/tests */
export type DebuggerSessionState = DebuggerAggregateSessionState;

export function createInitialDebuggerSessionState(): DebuggerSessionState {
  return {
    steps: [],
    status: 'idle',
    activeStepId: null,
    lastNluPatchId: null,
    replay: { mode: 'off', cursor: null, totalTurns: 0 },
    orchestratorSessionId: null,
    lastError: null,
  };
}
