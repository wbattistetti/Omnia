import type { DDTTemplateV2, DDTNode } from './model/ddt.v2.types';
import { buildPlan, isSaturated, nextMissingSub, applyComposite, setMemory, Memory } from './state';
import { isYes, isNo, extractImplicitCorrection, extractLastDate } from './utils';

export type Mode =
  | 'CollectingMain'
  | 'CollectingSub'
  | 'ConfirmingMain'
  | 'NotConfirmed'
  | 'SuccessMain'
  | 'Completed';

export interface SimulatorState {
  plan: ReturnType<typeof buildPlan>;
  mode: Mode;
  currentIndex: number;
  currentSubId?: string;
  memory: Memory;
  transcript: Array<{ from: 'bot' | 'user'; text: string; meta?: any }>;
  counters: { notConfirmed: number };
}

export function initEngine(template: DDTTemplateV2): SimulatorState {
  const plan = buildPlan(template.nodes);
  return {
    plan,
    mode: 'CollectingMain',
    currentIndex: 0,
    memory: {},
    transcript: [],
    counters: { notConfirmed: 0 },
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
    // Implicit correction: if input contains a correction, try to re-parse that
    const corrected = extractImplicitCorrection(input) || extractLastDate(input) || input;
    const applied = applyComposite(main.kind, corrected);
    let mem = setMemory(
      state.memory,
      main.id,
      { ...(state.memory[main.id]?.value || {}), ...applied.variables },
      false
    );
    // Propagate composite parts into sub memory when available
    if (Array.isArray(main.subs) && main.subs.length > 0) {
      for (const sid of main.subs) {
        const val = (applied.variables as any)[sid];
        if (val !== undefined) {
          mem = setMemory(mem, sid, val, false);
        }
      }
    }
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
    const corrected = extractImplicitCorrection(input) || input;
    const mem = setMemory(state.memory, sid, corrected, false);
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
      // Enter NotConfirmed flow
      return { ...state, mode: 'NotConfirmed', counters: { ...state.counters, notConfirmed: 1 } };
    }
    return state;
  }

  if (state.mode === 'NotConfirmed') {
    // Support a simple command pattern: "choose:<subId>" to route to a specific sub
    const trimmed = String(input || '').trim();
    if (trimmed.startsWith('choose:')) {
      const subId = trimmed.slice('choose:'.length);
      if (subId) {
        return { ...state, mode: 'CollectingSub', currentSubId: subId };
      }
    }
    const nextCount = Math.min(3, state.counters.notConfirmed + 1);
    // After 3 attempts, force collecting first missing sub (or first declared)
    if (nextCount >= 3) {
      const miss = nextMissingSub(main, state.memory) || (main.subs || [])[0];
      return { ...state, mode: 'CollectingSub', currentSubId: miss, counters: { ...state.counters, notConfirmed: nextCount } };
    }
    return { ...state, counters: { ...state.counters, notConfirmed: nextCount } };
  }

  if (state.mode === 'SuccessMain') {
    // Move to next main
    return advanceIndex({ ...state, mode: 'CollectingMain' });
  }

  return state;
}


