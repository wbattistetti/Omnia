/**
 * Pure debugger session transitions — no I/O or timers.
 */
import { createStepId, type DebuggerStep } from '../core/DebuggerStep';
import type { DebuggerEvent } from '../events/DebuggerEvent';
import {
  createInitialDebuggerSessionState,
  type DebuggerSessionState,
} from '../session/DebuggerSessionState';

function nluPatchId(p: { semanticValue: string; linguisticValue: string }): string {
  return `${p.semanticValue}\u0000${p.linguisticValue}`;
}

function findLastUserStepIndex(steps: readonly DebuggerStep[]): number {
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i]?.tags?.includes('user')) return i;
  }
  return steps.length - 1;
}

export function applyDebuggerEvent(
  state: DebuggerSessionState,
  event: DebuggerEvent
): DebuggerSessionState {
  switch (event.type) {
    case 'SessionStarted':
      return {
        ...state,
        status: 'running',
        orchestratorSessionId: event.orchestratorSessionId ?? null,
        lastError: null,
      };

    case 'SessionCleared': {
      return {
        ...createInitialDebuggerSessionState(),
        status: 'cleared',
      };
    }

    case 'OrchestratorWaitingForInput':
      return {
        ...state,
        status: 'waitingForInput',
      };

    case 'OrchestratorEnded':
      return {
        ...state,
        status: 'idle',
      };

    case 'UserTurnAppended':
      return {
        ...state,
        steps: [...state.steps, event.step],
        status: 'running',
      };

    case 'BotTurnAppended': {
      const steps = [...state.steps];
      const lastIdx = steps.length - 1;
      const text = String(event.payload.text ?? '').trim();
      if (lastIdx >= 0 && text) {
        const last = steps[lastIdx];
        steps[lastIdx] = {
          ...last,
          botResponse: text,
        };
        return { ...state, steps };
      }
      if (!text) return state;
      const botOnly: DebuggerStep = {
        id: createStepId(),
        utterance: '',
        semanticValue: '',
        linguisticValue: '',
        grammar: { type: 'bot', contract: 'orchestrator', elapsedMs: 0 },
        activeNodeId: '',
        passedNodeIds: [],
        noMatchNodeIds: [],
        activeEdgeId: '',
        botResponse: text,
        tags: ['bot'],
      };
      return { ...state, steps: [...state.steps, botOnly] };
    }

    case 'NluPatchedForLastUserStep': {
      const idx = findLastUserStepIndex(state.steps);
      if (idx < 0) return state;
      const last = state.steps[idx];
      const nextSemantic = event.patch.semanticValue || last.semanticValue;
      const nextLinguistic = event.patch.linguisticValue || last.linguisticValue;
      if (last.semanticValue === nextSemantic && last.linguisticValue === nextLinguistic) {
        return state;
      }
      const patched: DebuggerStep = {
        ...last,
        semanticValue: nextSemantic,
        linguisticValue: nextLinguistic,
      };
      const steps = state.steps.slice();
      steps[idx] = patched;
      return {
        ...state,
        steps,
        lastNluPatchId: nluPatchId(event.patch),
      };
    }

    case 'StepSelected':
      return { ...state, activeStepId: event.stepId };

    case 'NoteUpdated': {
      const steps = state.steps.map((s) =>
        s.id === event.stepId ? { ...s, note: event.note } : s
      );
      return { ...state, steps };
    }

    case 'DebuggerStepPatched': {
      const steps = state.steps.map((s) =>
        s.id === event.stepId ? { ...s, ...event.patch } : s
      );
      return { ...state, steps };
    }

    case 'ReplayStarted':
      return {
        ...state,
        status: 'replaying',
        replay: {
          mode: event.mode,
          cursor: 0,
          totalTurns: event.totalTurns ?? state.steps.length,
        },
      };

    case 'ReplayAdvanced':
      return {
        ...state,
        replay: {
          ...state.replay,
          cursor: event.index,
        },
      };

    case 'ReplayStopped':
      return {
        ...state,
        status: 'idle',
        replay: { mode: 'off', cursor: null, totalTurns: 0 },
      };

    case 'DebuggerError':
      return {
        ...state,
        lastError: event.message,
      };

    case 'DebuggerStepsReplaced':
      return {
        ...state,
        steps: [...event.steps],
      };

    default: {
      const _never: never = event;
      return _never;
    }
  }
}
