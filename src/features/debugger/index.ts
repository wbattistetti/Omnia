/**
 * Flow debugger: toolbar state machine, log/highlight reset, and actions.
 */
export { DebuggerStateMachine, type DebuggerSessionState } from './DebuggerStateMachine';
export { FlowHighlighter } from './FlowHighlighter';
export { DebuggerLog } from './DebuggerLog';
export { createDebuggerActions, type DebuggerActions, type DebuggerActionsDeps } from './DebuggerActions';
export { DebuggerToolbar } from './DebuggerToolbar';
export { DebuggerErrorList } from './ui/DebuggerErrorList';
export { DebuggerStepsPanel } from './ui/DebuggerStepsPanel';
export { FlowDebuggerUtteranceStrip } from './ui/FlowDebuggerUtteranceStrip';
export { FlowBotTurnLabel } from './ui/FlowBotTurnLabel';
export { UserTurnCard } from './ui/UserTurnCard';
export { UserTurnDetail } from './ui/UserTurnDetail';
export { DebuggerStepDetailContent } from './ui/DebuggerStepDetailContent';
export type { DebuggerStep, PersistedDebuggerStep, DebuggerConversationSnapshot } from './core/DebuggerStep';
export { DEBUGGER_STEP_SCHEMA_VERSION, createStepId } from './core/DebuggerStep';
export { buildDebuggerStepFromTurn, type TurnBuildInput } from './core/buildDebuggerStepFromTurn';
export {
  scheduleSaveDebuggerConversation,
  cancelPendingDebuggerSave,
  flushPendingDebuggerSave,
  loadDebuggerConversation,
  removeDebuggerSnapshot,
} from './persistence/debuggerConversationPersistence';
export type { DebuggerFlowHighlightPayload } from './highlight/debuggerHighlightPayload';

/** Aggregate session + event-driven runtime (Phase 2). */
export type { DebuggerAggregateSessionState } from './session/DebuggerSessionState';
export { createInitialDebuggerSessionState } from './session/DebuggerSessionState';
export type { DebuggerEvent, BotMessagePayload, NluPatch, UserTurnRef } from './events/DebuggerEvent';
export { applyDebuggerEvent } from './reducer/applyDebuggerEvent';
export { DebuggerController, type DebuggerControllerDeps } from './controller/DebuggerController';
export { useDebuggerSession, type UseDebuggerSessionResult } from './useDebuggerSession';
