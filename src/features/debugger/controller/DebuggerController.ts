/**
 * Translates orchestrator SSE, user input, and UI commands into DebuggerEvent.
 * No localStorage; timers here are for coalescing only, not persistence.
 * Flow Mode UI focus is owned by `FlowFocusManager` (`@features/focus`); this class never calls focus().
 */
import type { ExecutionState } from '@components/FlowCompiler/types';
import { buildDebuggerStepFromTurn } from '../core/buildDebuggerStepFromTurn';
import { extractNluFromVariableStore } from '../core/extractNluFromVariableStore';
import type { BotMessagePayload, DebuggerEvent } from '../events/DebuggerEvent';
import type { DebuggerSessionState } from '../session/DebuggerSessionState';
import { buildTaskIdToNodeIdMap, priorPassedNodeIdsForActive } from './executionMapping';

export type DebuggerControllerDeps = {
  getState: () => DebuggerSessionState;
  dispatch: (event: DebuggerEvent) => void;
  getNodes: () => unknown[];
  getTasks: () => unknown[];
  resolveNodeLabel: (nodeId?: string) => string;
  provideInput: (text: string) => Promise<void>;
};

export class DebuggerController {
  private latestExecutionState: ExecutionState | null = null;
  private pendingUtterance: { text: string; clientMessageId: string } | null = null;
  private pendingQueue: { text: string; clientMessageId: string } | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private nluTimer: ReturnType<typeof setTimeout> | null = null;
  private lastNluSignature = '';

  constructor(private readonly deps: DebuggerControllerDeps) {}

  notifySessionStarted(orchestratorSessionId?: string | null): void {
    this.deps.dispatch({ type: 'SessionStarted', orchestratorSessionId: orchestratorSessionId ?? null });
  }

  notifyOrchestratorEnded(): void {
    this.deps.dispatch({ type: 'OrchestratorEnded' });
  }

  notifyExecutionError(message: string): void {
    this.deps.dispatch({ type: 'DebuggerError', message });
  }

  onExecutionStateUpdate(state: ExecutionState): void {
    this.latestExecutionState = state;
    if (this.pendingUtterance) {
      if (this.flushTimer) clearTimeout(this.flushTimer);
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        this.flushPendingUserStep();
      }, 120);
    }
    this.scheduleNluPatch();
  }

  onWaitingForInput(data?: { taskId?: string; nodeId?: string }): void {
    this.deps.dispatch({
      type: 'OrchestratorWaitingForInput',
      taskId: data?.taskId,
      nodeId: data?.nodeId,
    });
    const q = this.pendingQueue;
    if (q) {
      this.pendingQueue = null;
      void this.runUserTurn(q.text, q.clientMessageId);
    }
  }

  /**
   * Backend replay: send each stored user turn without waiting for `waitingForInput` gating
   * (orchestrator sync is handled by the caller between turns).
   */
  async runReplayTurn(text: string, clientMessageId: string): Promise<void> {
    if (this.deps.getState().replay.mode === 'uiOnly') return;
    const utterance = String(text ?? '').trim();
    const cmid = String(clientMessageId ?? '');
    if (!utterance) return;
    await this.runUserTurn(utterance, cmid);
  }

  async onUserInput(text: string, clientMessageId: string): Promise<void> {
    const s = this.deps.getState();
    if (s.replay.mode === 'uiOnly') return;
    const utterance = String(text ?? '').trim();
    const cmid = String(clientMessageId ?? '');
    if (!utterance) return;

    if (s.replay.mode === 'backend') {
      await this.runUserTurn(utterance, cmid);
      return;
    }
    if (s.status !== 'waitingForInput') {
      this.pendingQueue = { text: utterance, clientMessageId: cmid };
      return;
    }
    await this.runUserTurn(utterance, cmid);
  }

  private async runUserTurn(text: string, clientMessageId: string): Promise<void> {
    this.pendingUtterance = { text, clientMessageId };
    try {
      await this.deps.provideInput(text);
    } catch {
      this.pendingUtterance = null;
      if (this.flushTimer) {
        clearTimeout(this.flushTimer);
        this.flushTimer = null;
      }
    }
  }

  private flushPendingUserStep(): void {
    const pending = this.pendingUtterance;
    const exec = this.latestExecutionState;
    if (!pending?.text || !exec) return;

    this.pendingUtterance = null;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    const taskToNode = buildTaskIdToNodeIdMap(this.deps.getNodes(), this.deps.getTasks());
    const activeNodeId = exec.currentNodeId || '';
    const priorPassed = priorPassedNodeIdsForActive(exec, taskToNode, activeNodeId);
    const slotLabel =
      this.deps.resolveNodeLabel(activeNodeId).trim() || (activeNodeId ? String(activeNodeId) : '');
    const store = (exec.variableStore || {}) as Record<string, unknown>;
    const nlu = extractNluFromVariableStore(store, pending.text);

    const step = buildDebuggerStepFromTurn({
      utterance: pending.text,
      semanticValue: nlu.semantic,
      linguisticValue: nlu.linguistic,
      grammarType: 'orchestrator',
      grammarContract: 'GrammarFlow',
      elapsedMs: 0,
      slotLabel: slotLabel || undefined,
      activeNodeId,
      priorPassedNodeIds: priorPassed,
      noMatchNodeIds: [],
      activeEdgeId: '',
      clientMessageId: pending.clientMessageId || undefined,
    });
    this.deps.dispatch({
      type: 'UserTurnAppended',
      step: { ...step, tags: ['user'] },
    });
    this.scheduleNluPatch();
  }

  private scheduleNluPatch(): void {
    const exec = this.latestExecutionState;
    const session = this.deps.getState();
    if (!exec || session.steps.length === 0) return;

    let targetUtterance = '';
    for (let i = session.steps.length - 1; i >= 0; i--) {
      const s = session.steps[i];
      if (s?.tags?.includes('user')) {
        targetUtterance = s.utterance;
        break;
      }
    }
    if (!targetUtterance && session.steps.length > 0) {
      targetUtterance = session.steps[session.steps.length - 1]?.utterance ?? '';
    }
    if (!targetUtterance) return;

    const store = (exec.variableStore || {}) as Record<string, unknown>;
    const nlu = extractNluFromVariableStore(store, targetUtterance);
    if (!nlu.semantic && !nlu.linguistic) return;
    const sig = `${nlu.semantic}\u0000${nlu.linguistic}`;
    if (sig === this.lastNluSignature) return;

    if (this.nluTimer) clearTimeout(this.nluTimer);
    this.nluTimer = setTimeout(() => {
      this.nluTimer = null;
      this.lastNluSignature = sig;
      this.deps.dispatch({
        type: 'NluPatchedForLastUserStep',
        patch: { semanticValue: nlu.semantic, linguisticValue: nlu.linguistic },
      });
    }, 100);
  }

  onBotMessage(payload: BotMessagePayload): void {
    this.deps.dispatch({ type: 'BotTurnAppended', payload });
  }

  /**
   * Clears orchestrator-side refs/timers only. Session reset + persistence are handled by the hook.
   */
  clearRuntime(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.nluTimer) {
      clearTimeout(this.nluTimer);
      this.nluTimer = null;
    }
    this.lastNluSignature = '';
    this.pendingUtterance = null;
    this.pendingQueue = null;
    this.latestExecutionState = null;
  }

  onReplayStart(mode: 'backend' | 'uiOnly', totalTurns?: number): void {
    this.deps.dispatch({ type: 'ReplayStarted', mode, totalTurns });
  }

  onReplayAdvance(index: number): void {
    this.deps.dispatch({ type: 'ReplayAdvanced', index });
  }

  onReplayStop(): void {
    this.deps.dispatch({ type: 'ReplayStopped' });
  }
}
