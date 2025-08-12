import type { DDTTemplateV2, DDTNode } from './model/ddt.v2.types';
import { buildPlan, isSaturated, nextMissingSub, applyComposite, setMemory, Memory } from './state';
import { isYes, isNo } from './utils';

export type Mode =
  | 'CollectingMain'
  | 'CollectingSub'
  | 'ConfirmingMain'
  | 'SuccessMain'
  | 'Completed';

export interface SimulatorState {
  plan: ReturnType<typeof buildPlan>;
  mode: Mode;
  currentIndex: number;
  currentSubId?: string;
  memory: Memory;
  transcript: Array<{ from: 'bot' | 'user'; text: string; meta?: any }>;
}

export function initEngine(template: DDTTemplateV2): SimulatorState {
  const plan = buildPlan(template.nodes);
  return {
    plan,
    mode: 'CollectingMain',
    currentIndex: 0,
    memory: {},
    transcript: [],
  };
}

function currentMain(state: SimulatorState): DDTNode | undefined {
  const mainId = state.plan.order[state.currentIndex];
  return state.plan.byId[mainId];
}

function advanceIndex(state: SimulatorState): SimulatorState {
  const nextIdx = state.currentIndex + 1;
  if (nextIdx >= state.plan.order.length) {
    return { ...state, mode: 'Completed', currentIndex: nextIdx };
  }
  return { ...state, currentIndex: nextIdx, mode: 'CollectingMain', currentSubId: undefined };
}

export function advance(state: SimulatorState, input: string): SimulatorState {
  const main = currentMain(state);
  if (!main) return { ...state, mode: 'Completed' };

  // Handle by mode
  if (state.mode === 'CollectingMain') {
    const applied = applyComposite(main.kind, input);
    let mem = setMemory(state.memory, main.id, { ...(state.memory[main.id]?.value || {}), ...applied.variables }, false);
    const missing = nextMissingSub(main, mem);
    if (applied.complete && !missing) {
      return { ...state, memory: mem, mode: 'ConfirmingMain' };
    }
    if (missing) {
      return { ...state, memory: mem, mode: 'CollectingSub', currentSubId: missing };
    }
    return { ...state, memory: mem };
  }

  if (state.mode === 'CollectingSub') {
    const sid = state.currentSubId!;
    const mem = setMemory(state.memory, sid, input, false);
    const missing = nextMissingSub(main, mem);
    if (missing) return { ...state, memory: mem, currentSubId: missing };
    return { ...state, memory: mem, mode: 'ConfirmingMain', currentSubId: undefined };
  }

  if (state.mode === 'ConfirmingMain') {
    if (isYes(input)) {
      const mem = setMemory(state.memory, main.id, state.memory[main.id]?.value, true);
      return { ...advanceIndex(state), memory: mem, mode: 'SuccessMain' };
    }
    if (isNo(input)) {
      // Minimal: go back to CollectingSub of first missing
      const miss = nextMissingSub(main, state.memory) || (main.subs || [])[0];
      return { ...state, mode: 'CollectingSub', currentSubId: miss };
    }
    return state;
  }

  if (state.mode === 'SuccessMain') {
    // Move to next main
    return advanceIndex({ ...state, mode: 'CollectingMain' });
  }

  return state;
}


