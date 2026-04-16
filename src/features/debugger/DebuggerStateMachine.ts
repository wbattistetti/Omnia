/**
 * Explicit debugger toolbar/session states for the flow debugger panel.
 * `cleared` from UX spec is represented as `idle` (same behaviour).
 */

export type DebuggerSessionState = 'idle' | 'running' | 'waitingForInput';

export class DebuggerStateMachine {
  private state: DebuggerSessionState = 'idle';

  private readonly listener?: (next: DebuggerSessionState) => void;

  constructor(listener?: (next: DebuggerSessionState) => void) {
    this.listener = listener;
  }

  getState(): DebuggerSessionState {
    return this.state;
  }

  setState(next: DebuggerSessionState): void {
    this.state = next;
    this.listener?.(next);
  }
}
