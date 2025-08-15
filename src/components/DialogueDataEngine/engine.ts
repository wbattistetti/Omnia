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
  // Advance to the next MAIN node, skipping any sub entries that may appear in the linear plan
  let nextIdx = state.currentIndex + 1;
  while (nextIdx < state.plan.order.length) {
    const nextId = state.plan.order[nextIdx];
    const nextNode = state.plan.byId[nextId];
    if (nextNode && nextNode.type === 'main') break; // stop on next main
    nextIdx += 1; // skip subs
  }
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
    let mem = state.memory;
    // For mains with subs, populate only subs here; compose main later from subs
    if (Array.isArray(main.subs) && main.subs.length > 0) {
      for (const sid of main.subs) {
        const sub = state.plan.byId[sid];
        const labelNorm = (sub?.label || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
        let v: any = undefined;
        if (main.kind === 'name') {
          if (labelNorm.includes('first')) v = (applied.variables as any).firstname;
          else if (labelNorm.includes('last')) v = (applied.variables as any).lastname;
        } else if (main.kind === 'date') {
          if (labelNorm.includes('day')) v = (applied.variables as any).day;
          else if (labelNorm.includes('month')) v = (applied.variables as any).month;
          else if (labelNorm.includes('year')) v = (applied.variables as any).year;
        } else if (main.kind === 'address') {
          if (labelNorm.includes('street')) v = (applied.variables as any).street;
          else if (labelNorm.includes('city')) v = (applied.variables as any).city;
          else if (labelNorm.includes('postal') || labelNorm.includes('zip')) v = (applied.variables as any).postal_code;
          else if (labelNorm.includes('country')) v = (applied.variables as any).country;
        }
        if (v !== undefined) {
          mem = setMemory(mem, sid, v, false);
        }
      }
    } else {
      // Atomic mains: write value directly
      mem = setMemory(state.memory, main.id, (applied.variables as any).value ?? corrected, false);
    }
    // Propagate composite parts into sub memory when available
    if (Array.isArray(main.subs) && main.subs.length > 0) {
      for (const sid of main.subs) {
        const val = (applied.variables as any)[sid];
        // Also support matching by simplified sub id (e.g., firstname/lastname)
        const alt = Object.entries(applied.variables as any).find(([k]) => k === sid || k.replace(/[^a-z0-9]+/g, '') === sid.replace(/[^a-z0-9]+/g, ''));
        const chosen = val !== undefined ? val : (alt ? alt[1] : undefined);
        if (chosen !== undefined) {
          mem = setMemory(mem, sid, chosen, false);
        }
      }
      // Compose and store the main value from current sub values so confirmation can show it
      const composeFromSubs = (m: DDTNode, memory: Memory) => {
        if (!Array.isArray(m.subs) || m.subs.length === 0) return memory[m.id]?.value;
        const out: Record<string, any> = {};
        for (const s of (m.subs || [])) {
          const v = memory[s]?.value;
          if (v !== undefined) out[s] = v;
        }
        return out;
      };
      mem = setMemory(mem, main.id, composeFromSubs(main, mem), false);
    }
    const missing = nextMissingSub(main, mem);
    const saturated = isSaturated(main, mem);
    if (saturated && !missing) {
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
    let mem = setMemory(state.memory, sid, corrected, false);
    // Recompose main value from current sub values so main reflects subs
    const composeFromSubs = (m: DDTNode, memory: Memory) => {
      if (!Array.isArray(m.subs) || m.subs.length === 0) return memory[m.id]?.value;
      const out: Record<string, any> = {};
      for (const s of (m.subs || [])) {
        const v = memory[s]?.value;
        if (v !== undefined) out[s] = v;
      }
      return out;
    };
    mem = setMemory(mem, main.id, composeFromSubs(main, mem), false);
    const missing = nextMissingSub(main, mem);
    if (missing) return { ...state, memory: mem, currentSubId: missing };
    return { ...state, memory: mem, mode: 'ConfirmingMain', currentSubId: undefined };
  }

  if (state.mode === 'ConfirmingMain') {
    if (isYes(input)) {
      const mem = setMemory(state.memory, main.id, state.memory[main.id]?.value, true);
      // Stay on current index to allow UI to render success for the correct main,
      // then the engine will advance on the next tick/input from SuccessMain state.
      return { ...state, memory: mem, mode: 'SuccessMain' };
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


