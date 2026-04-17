/**
 * Discriminated union of debugger domain events (applied only by applyDebuggerEvent).
 */
import type { DebuggerStep } from '../core/DebuggerStep';
import type { DebuggerReplayMode } from '../session/DebuggerSessionState';

export type BotMessagePayload = {
  messageId: string;
  text?: string;
  textKey?: string;
  stepType?: string;
  taskId?: string;
};

export type NluPatch = {
  semanticValue: string;
  linguisticValue: string;
};

export type UserTurnRef = {
  text: string;
  clientMessageId: string;
};

export type DebuggerReplayStartMode = Extract<DebuggerReplayMode, 'backend' | 'uiOnly'>;

export type DebuggerEvent =
  | { type: 'SessionStarted'; orchestratorSessionId?: string | null }
  | { type: 'SessionCleared' }
  | { type: 'OrchestratorWaitingForInput'; taskId?: string; nodeId?: string }
  | { type: 'OrchestratorEnded' }
  /** Full user step built by DebuggerController (pure builders + last ExecutionState). */
  | { type: 'UserTurnAppended'; step: DebuggerStep }
  | { type: 'BotTurnAppended'; payload: BotMessagePayload }
  | { type: 'NluPatchedForLastUserStep'; patch: NluPatch }
  | { type: 'StepSelected'; stepId: string | null }
  | { type: 'NoteUpdated'; stepId: string; note: string }
  | { type: 'DebuggerStepPatched'; stepId: string; patch: Partial<DebuggerStep> }
  | { type: 'ReplayStarted'; mode: DebuggerReplayStartMode; totalTurns?: number }
  | { type: 'ReplayAdvanced'; index: number }
  | { type: 'ReplayStopped' }
  | { type: 'DebuggerError'; message: string }
  /** Hydrate from external snapshot (e.g. load persistence) — not used by controller SSE path. */
  | { type: 'DebuggerStepsReplaced'; steps: readonly DebuggerStep[] };
