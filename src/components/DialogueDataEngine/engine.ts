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

// Debug helpers for mixed-initiative tracing
const DEBUG_MI = true;
function logMI(...args: any[]) {
  if (!DEBUG_MI) return;
  try { console.debug('[MixedInit]', ...args); } catch {}
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
  const nextMain = state.plan.byId[state.plan.order[nextIdx]];
  let newState: SimulatorState = { ...state, currentIndex: nextIdx, currentSubId: undefined };
  // If the next main has subs and they are all present, compose its main value now so confirmation can show a summary
  if (nextMain && Array.isArray((nextMain as any).subs) && (nextMain as any).subs.length > 0) {
    const allPresent = (nextMain as any).subs.every((sid: string) => {
      const m = state.memory[sid];
      return m && m.value !== undefined && m.value !== null && String(m.value).length > 0;
    });
    if (allPresent) {
      const composed: Record<string, any> = {};
      for (const sid of (nextMain as any).subs) {
        const m = state.memory[sid];
        if (m && m.value !== undefined) composed[sid] = m.value;
      }
      newState = { ...newState, memory: setMemory(state.memory, nextMain.id, composed, false) };
    }
  }
  const nextMode: Mode = (nextMain && isSaturated(nextMain as any, newState.memory)) ? 'ConfirmingMain' : 'CollectingMain';
  logMI('advanceIndex', { nextIdx, nextMain: nextMain?.label, nextMode });
  return { ...newState, mode: nextMode };
}

// --- Mixed-initiative sanitization helpers ---
const MONTH_WORDS = new Set([
  // EN
  'january','february','march','april','may','june','july','august','september','october','november','december',
  'jan','feb','mar','apr','jun','jul','aug','sep','sept','oct','nov','dec',
  // IT
  'gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre',
  'gen','feb','mar','apr','mag','giu','lug','ago','sett','ott','nov','dic',
]);

const NAME_STOPWORDS = new Set(['nato','nata','born','a','in','il','lo','la','le','del','della','dei','di','da','the','at','on']);

function isMonthWord(word: string): boolean {
  const w = word.normalize('NFKD').replace(/[^a-zA-Z]/g, '').toLowerCase();
  return w.length > 0 && MONTH_WORDS.has(w);
}

// minimal name token filter now embedded in detectNameFrom; no global sanitization

// Removed ad-hoc sanitizers; rely on ordered extraction and detectors

// --- Simple detectors for mixed-initiative prefill ---
function detectEmailSpan(text: string): { value: string; span: [number, number] } | undefined {
  const re = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const m = re.exec(text);
  if (!m) return undefined;
  return { value: m[0], span: [m.index, m.index + m[0].length] };
}

function detectPhoneSpan(text: string): { value: string; span: [number, number] } | undefined {
  const re = /\+?\d[\d\s\-]{6,}/g;
  const m = re.exec(text);
  if (!m) return undefined;
  return { value: m[0].trim(), span: [m.index, m.index + m[0].length] };
}

function detectDateSpan(text: string): { day?: number; month?: number | string; year?: number; span: [number, number] } | undefined {
  // dd/mm/yyyy or d/m/yyyy
  const re1 = /(\b\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/;
  const m1 = re1.exec(text);
  if (m1) {
    const day = parseInt(m1[1], 10);
    const month = parseInt(m1[2], 10);
    const year = parseInt(m1[3].length === 2 ? `19${m1[3]}` : m1[3], 10);
    return { day, month, year, span: [m1.index, m1.index + m1[0].length] };
  }
  // "16 maggio 1980" (IT) or "16 may 1980"
  const re2 = /(\b\d{1,2})\s+([A-Za-zÀ-ÿ]{3,})\s+(\d{2,4})\b/;
  const m2 = re2.exec(text);
  if (m2) {
    const day = parseInt(m2[1], 10);
    const month = m2[2];
    const year = parseInt(m2[3].length === 2 ? `19${m2[3]}` : m2[3], 10);
    return { day, month, year, span: [m2.index, m2.index + m2[0].length] };
  }
  return undefined;
}

function detectNameFrom(text: string): { firstname?: string; lastname?: string; span?: [number, number] } | undefined {
  // Heuristic: capture a short leading run of probable name tokens, then stop on stopwords/months/digits
  const words = text.split(/\s+/g);
  const picked: string[] = [];
  const positions: Array<[number, number]> = [];
  let cursor = 0;
  for (const w of words) {
    const start = text.indexOf(w, cursor);
    cursor = start >= 0 ? start + w.length : cursor;
    const plain = w.replace(/[.,;:!?]/g, '');
    const lower = plain.toLowerCase();
    if (!plain) continue;
    if (/[0-9]/.test(plain) || isMonthWord(plain) || NAME_STOPWORDS.has(lower)) {
      // stop scanning once we reach a structural token, to avoid swallowing locations or dates
      break;
    }
    // prefer tokens that look like names (capitalized). If not capitalized, accept only if we have none yet
    const isCap = plain[0] === plain[0]?.toUpperCase();
    if (!isCap && picked.length > 0) break;
    picked.push(plain);
    if (start >= 0) positions.push([start, start + w.length]);
    if (picked.length >= 2) break;
  }
  if (!picked.length) return undefined;
  const out: any = {};
  if (picked[0]) out.firstname = picked[0];
  if (picked[1]) out.lastname = picked[1];
  const span = positions.length ? [positions[0][0], positions[positions.length - 1][1]] as [number, number] : undefined;
  return { ...out, span };
}

// (Deprecated) older prefill removed in favor of ordered extraction

// Ordered extraction: target-first, then iterate others subtracting spans
function extractOrdered(state: SimulatorState, input: string, primaryKind: string): { memory: Memory; residual: string } {
  let residual = input;
  let memory = state.memory;
  const kindsOrder = state.plan.order
    .map((id) => state.plan.byId[id])
    .filter(Boolean)
    .map((n) => String(n.kind || '').toLowerCase());
  const uniqueKinds = Array.from(new Set(kindsOrder));
  const constrained = ['email','phone','date','postal','zip','number','numeric'];
  const isConstrained = (k: string) => constrained.includes(String(k || '').toLowerCase());

  const constrainedKinds = uniqueKinds.filter((k) => isConstrained(k));
  const nonConstrained = uniqueKinds.filter((k) => !isConstrained(k));

  const nameLast = (arr: string[]) => {
    const withoutName = arr.filter((k) => k !== 'name');
    return [...withoutName, ...(arr.includes('name') ? ['name'] : [])];
  };

  let ordered: string[] = [];
  if (isConstrained(primaryKind)) {
    ordered = [primaryKind, ...constrainedKinds.filter((k) => k !== primaryKind)];
  } else {
    ordered = [...constrainedKinds, ...(primaryKind ? [primaryKind] : [])];
  }
  // Then all remaining kinds (address/text/etc.), keeping 'name' to the very end
  const remaining = nonConstrained.filter((k) => k !== primaryKind);
  ordered = [...ordered, ...nameLast(remaining)];
  logMI('order', { primaryKind, constrainedKinds, remaining, ordered });

  const subtract = (span?: [number, number]) => {
    if (!span) return;
    residual = residual.slice(0, span[0]) + ' ' + residual.slice(span[1]);
  };

  const applyToKind = (kind: string) => {
    if (kind === 'email') {
      const hit = detectEmailSpan(residual);
      if (hit) {
        logMI('hit', { kind, value: hit.value, span: hit.span, residualLen: residual.length });
        for (const id of state.plan.order) {
          const n = state.plan.byId[id];
          if (String(n?.kind).toLowerCase() === 'email' && memory[id]?.value === undefined) {
            memory = setMemory(memory, id, hit.value, false);
            subtract(hit.span);
            logMI('write', { kind, id, afterResidualLen: residual.length });
            break;
          }
        }
      }
      return;
    }
    if (kind === 'phone') {
      const hit = detectPhoneSpan(residual);
      if (hit) {
        logMI('hit', { kind, value: hit.value, span: hit.span, residualLen: residual.length });
        for (const id of state.plan.order) {
          const n = state.plan.byId[id];
          if (String(n?.kind).toLowerCase() === 'phone' && memory[id]?.value === undefined) {
            memory = setMemory(memory, id, hit.value, false);
            subtract(hit.span);
            logMI('write', { kind, id, afterResidualLen: residual.length });
            break;
          }
        }
      }
      return;
    }
    if (kind === 'date') {
      const hit = detectDateSpan(residual);
      if (hit) {
        logMI('hit', { kind, value: { day: hit.day, month: hit.month, year: hit.year }, span: hit.span, residualLen: residual.length });
        for (const id of state.plan.order) {
          const n = state.plan.byId[id];
          if (String(n?.kind).toLowerCase() === 'date') {
            if (Array.isArray(n.subs) && n.subs.length > 0) {
              for (const sid of n.subs) {
                const sub = state.plan.byId[sid];
                const norm = (sub?.label || '').toLowerCase();
                if (norm.includes('day') && hit.day !== undefined) memory = setMemory(memory, sid, hit.day, false);
                if (norm.includes('month') && hit.month !== undefined) memory = setMemory(memory, sid, hit.month as any, false);
                if (norm.includes('year') && hit.year !== undefined) memory = setMemory(memory, sid, hit.year, false);
              }
            }
            subtract(hit.span);
            logMI('write', { kind, id, afterResidualLen: residual.length });
            break;
          }
        }
      }
      return;
    }
    if (kind === 'name') {
      const hit = detectNameFrom(residual);
      if (hit && (hit.firstname || hit.lastname)) {
        logMI('hit', { kind, value: { firstname: hit.firstname, lastname: hit.lastname }, span: hit.span, residualLen: residual.length });
        for (const id of state.plan.order) {
          const n = state.plan.byId[id];
          if (String(n?.kind).toLowerCase() === 'name') {
            if (Array.isArray(n.subs) && n.subs.length > 0) {
              for (const sid of n.subs) {
                const sub = state.plan.byId[sid];
                const norm = (sub?.label || '').toLowerCase();
                if (norm.includes('first') && hit.firstname) memory = setMemory(memory, sid, hit.firstname, false);
                if (norm.includes('last') && hit.lastname) memory = setMemory(memory, sid, hit.lastname, false);
              }
            } else {
              const v = [hit.firstname, hit.lastname].filter(Boolean).join(' ');
              if (v) memory = setMemory(memory, id, v, false);
            }
            subtract(hit.span);
            logMI('write', { kind, id, afterResidualLen: residual.length });
            break;
          }
        }
      }
      return;
    }
  };

  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const k of ordered) {
      const before = residual;
      applyToKind(k);
      if (residual !== before) {
        progressed = true;
      }
    }
    logMI('loopEnd', { residual });
  }

  return { memory, residual };
}
export function advance(state: SimulatorState, input: string): SimulatorState {
  const main = currentMain(state);
  if (!main) return { ...state, mode: 'Completed' };

  // Handle by mode
  if (state.mode === 'CollectingMain') {
    // First, attempt mixed-initiative extraction: target current kind, then others, subtracting matches
    const extracted = extractOrdered(state, input, String(main.kind || '').toLowerCase());
    if (extracted.memory !== state.memory) {
      state = { ...state, memory: extracted.memory };
    }
    // Implicit correction: if input contains a correction, try to re-parse that
    const residual = extracted.residual ?? input;
    const corrected = extractImplicitCorrection(residual) || extractLastDate(residual) || residual;
    const applied = applyComposite(main.kind, corrected);
    const variables = applied.variables;
    let mem = state.memory;
    // For mains with subs, populate only subs here; compose main later from subs
    if (Array.isArray(main.subs) && main.subs.length > 0) {
      for (const sid of main.subs) {
        const sub = state.plan.byId[sid];
        const labelNorm = (sub?.label || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
        let v: any = undefined;
        if (main.kind === 'name') {
          if (labelNorm.includes('first')) v = (variables as any).firstname;
          else if (labelNorm.includes('last')) v = (variables as any).lastname;
        } else if (main.kind === 'date') {
          if (labelNorm.includes('day')) v = (variables as any).day;
          else if (labelNorm.includes('month')) v = (variables as any).month;
          else if (labelNorm.includes('year')) v = (variables as any).year;
        } else if (main.kind === 'address') {
          if (labelNorm.includes('street')) v = (variables as any).street;
          else if (labelNorm.includes('city')) v = (variables as any).city;
          else if (labelNorm.includes('postal') || labelNorm.includes('zip')) v = (variables as any).postal_code;
          else if (labelNorm.includes('country')) v = (variables as any).country;
        }
        if (v !== undefined && (mem[sid]?.value === undefined)) {
          mem = setMemory(mem, sid, v, false);
        }
      }
    } else {
      // Atomic mains: write value directly
      const nextVal = (variables as any).value ?? corrected;
      if (mem[main.id]?.value === undefined && nextVal !== undefined) {
        mem = setMemory(state.memory, main.id, nextVal, false);
      }
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


