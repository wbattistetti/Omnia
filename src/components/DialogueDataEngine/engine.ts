import type { DDTTemplateV2, DDTNode } from './model/ddt.v2.types';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { buildPlan, isSaturated, nextMissingSub, applyComposite, setMemory, Memory } from './state';
import { isYes, isNo, extractImplicitCorrection, extractLastDate } from './utils';
import { getKind } from './parsers/registry';

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

import { getLogger } from './logger';
// Debug helpers for mixed-initiative tracing
function logMI(...args: any[]) {
  const logger = getLogger();
  if (!logger.miEnabled) return;
  try { logger.debug('[MixedInit]', ...args); } catch {}
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
  // Helpers that respect only the 'required' flag on subs. Default is required=true when undefined.
  const requiredSubsOf = (node: DDTNode, byId: Record<string, DDTNode>): string[] => {
    const subs = (node.subs || []).filter((sid) => !!byId[sid]);
    return subs.filter((sid) => byId[sid].required !== false);
  };
  const nextMissingRequired = (node: DDTNode, byId: Record<string, DDTNode>, memory: Memory): string | undefined => {
    const subs = requiredSubsOf(node, byId);
    for (const sid of subs) {
      const m = memory[sid];
      if (!m || m.value === undefined || m.value === null || String(m.value).length === 0) return sid;
    }
    return undefined;
  };
  const isSaturatedRequired = (node: DDTNode, byId: Record<string, DDTNode>, memory: Memory): boolean => {
    const subs = requiredSubsOf(node, byId);
    if (subs.length === 0) return isSaturated(node, memory);
    for (const sid of subs) {
      const m = memory[sid];
      if (!m || m.value === undefined || m.value === null || String(m.value).length === 0) return false;
    }
    return true;
  };
  const labelOf = (sid?: string) => (sid ? String(newState.plan.byId[sid]?.label || sid) : '');

  // If the next main has required subs missing, collect the first missing sub
  // ONLY when at least one sub value is already present. If nothing is present yet,
  // stay on the MAIN and use its prompts first.
  if (nextMain && Array.isArray((nextMain as any).subs) && (nextMain as any).subs.length > 0) {
    const subsArr: string[] = (nextMain as any).subs.filter((sid: string) => !!newState.plan.byId[sid]);
    const anyPresent = subsArr.some((sid) => {
      const m = newState.memory[sid];
      return m && m.value !== undefined && m.value !== null && String(m.value).length > 0;
    });
    const missingSub = nextMissingRequired(nextMain as any, newState.plan.byId, newState.memory);
    try {
      const req = requiredSubsOf(nextMain as any, newState.plan.byId);
      const miss = req.filter((sid) => {
        const m = newState.memory[sid];
        return !m || m.value === undefined || m.value === null || String(m.value).length === 0;
      });
      logMI('subsRequired', { main: nextMain?.label, required: req.map(labelOf), missing: miss.map(labelOf) });
      logMI('advanceIndex.check', {
        main: nextMain?.label,
        subs: subsArr.map(labelOf),
        anyPresent,
        missingSub: labelOf(missingSub),
      });
    } catch {}
    if (missingSub && anyPresent) {
      logMI('advanceIndex', { nextIdx, nextMain: nextMain?.label, nextMode: 'CollectingSub', currentSubId: missingSub, currentSubLabel: labelOf(missingSub) });
      return { ...newState, mode: 'CollectingSub', currentSubId: missingSub };
    }
    // No fallback: if there are no required subs, we don't ask for optional ones automatically
  }
  const nextMode: Mode = (nextMain && isSaturatedRequired(nextMain as any, newState.plan.byId, newState.memory)) ? 'ConfirmingMain' : 'CollectingMain';
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

const NAME_STOPWORDS = new Set(['nato','nata','born','a','in','il','lo','la','le','del','della','dei','di','da','the','at','on','mi','chiamo','nome','e','è','my','name','is','sono']);

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
  // "16 maggio 1980" (IT) or "16 may 1980" with optional filler (del/nel/anno)
  const re2 = /(\b\d{1,2})\s+([A-Za-zÀ-ÿ]{3,})\s+(?:di|de|del|della|nel|nell'|anno\s*)?(\d{2,4})\b/i;
  const m2 = re2.exec(text);
  if (m2) {
    const day = parseInt(m2[1], 10);
    const month = m2[2];
    const year = parseInt(m2[3].length === 2 ? `19${m2[3]}` : m2[3], 10);
    return { day, month, year, span: [m2.index, m2.index + m2[0].length] };
  }
  // Month name + year without day, e.g., "dicembre 1980", "a dicembre del 1980"
  const monthAlt = Array.from(MONTH_WORDS).join('|');
  const re3 = new RegExp(`(?:\\b|\\s)(${monthAlt})\\s+(?:di|de|del|della|nel|nell'|anno\\s*)?(\\d{2,4})\\b`, 'i');
  const m3 = re3.exec(text);
  if (m3) {
    const month = m3[1];
    const year = parseInt(m3[2].length === 2 ? `19${m3[2]}` : m3[2], 10);
    return { month, year, span: [m3.index, m3.index + m3[0].length] };
  }
  // Numeric month/year like "12/1980"
  const re4 = /(\b(0?[1-9]|1[0-2]))[\/\-](\d{2,4})\b/;
  const m4 = re4.exec(text);
  if (m4) {
    const month = parseInt(m4[1], 10);
    const year = parseInt(m4[3].length === 2 ? `19${m4[3]}` : m4[3], 10);
    return { month, year, span: [m4.index, m4.index + m4[0].length] };
  }
  // Year only (with optional prepositions): "nel 1980", "in 1980", or just "1980"
  const re5 = /(?:\b(?:nel|del|in|of)\s+)?((?:19|20)\d{2})\b/i;
  const m5 = re5.exec(text);
  if (m5) {
    const yearStr = m5[1];
    const year = parseInt(yearStr, 10);
    const start = text.indexOf(yearStr, m5.index);
    return { year, span: [start, start + yearStr.length] };
  }
  return undefined;
}

function detectNameFrom(text: string): { firstname?: string; lastname?: string; span?: [number, number] } | undefined {
  const s = String(text || '');
  // Pattern: "mi chiamo <first> <last>" or "il mio nome è <first> <last>"
  // Tolerate common typos like "mi chaimo" (ai vs ia)
  const m = s.match(/(?:mi\s+ch(?:ia|ai)mo|il\s+mio\s+nome\s+(?:e|è))\s+([A-Za-zÀ-ÿ'`-]+)(?:\s+([A-Za-zÀ-ÿ'`-]+))?/i);
  if (m) {
    const first = m[1];
    const last = m[2];
    const start = m.index ?? 0;
    const nameStr = [first, last].filter(Boolean).join(' ');
    const span: [number, number] = [s.indexOf(nameStr, start), (s.indexOf(nameStr, start) + nameStr.length)];
    return { firstname: first, lastname: last, span };
  }
  // Fallback heuristic: capture a short run of probable name tokens, stop on stopwords/months/digits
  const words = s.split(/\s+/g);
  const picked: string[] = [];
  const positions: Array<[number, number]> = [];
  let cursor = 0;
  for (const w of words) {
    const start = s.indexOf(w, cursor);
    cursor = start >= 0 ? start + w.length : cursor;
    const plain = w.replace(/[.,;:!?]/g, '');
    const lower = plain.toLowerCase();
    if (!plain) continue;
    if (/[0-9]/.test(plain) || isMonthWord(plain) || NAME_STOPWORDS.has(lower)) {
      if (picked.length === 0) continue; // skip introducers before name
      break;
    }
    const isCap = /[A-ZÀ-Ý]/.test(plain[0] || '');
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
  // Ensure phone is attempted when the input looks like a phone number or the target is phone
  try {
    const hasPhoneAlready = ordered.includes('phone');
    const phoneHit = detectPhoneSpan(residual);
    if (!hasPhoneAlready && (primaryKind === 'phone' || !!phoneHit)) {
      ordered = ['phone', ...ordered];
    }
  } catch {}
  // Safety: always attempt a name extraction pass at the very end
  if (!ordered.includes('name')) ordered.push('name');
  logMI('order', { primaryKind, constrainedKinds, remaining, ordered });

  const subtract = (span?: [number, number]) => {
    if (!span) return;
    const beforeLen = residual.length;
    const sliced = residual.slice(span[0], span[1]);
    residual = residual.slice(0, span[0]) + ' ' + residual.slice(span[1]);
    logMI('subtract', { removed: sliced, span, beforeLen, afterLen: residual.length, residual });
  };

  const applyToKind = (kind: string) => {
    if (kind === 'email') {
      const hit = (getKind('email')?.detect(residual)) || detectEmailSpan(residual);
      if (hit) {
        logMI('hit', { kind, value: hit.value, span: hit.span, residualLen: residual.length });
        for (const id of state.plan.order) {
          const n = state.plan.byId[id];
          if (String(n?.kind).toLowerCase() === 'email' && memory[id]?.value === undefined) {
            memory = setMemory(memory, id, hit.value, false);
            logMI('memWrite', { id, kind, value: hit.value });
            subtract(hit.span);
            logMI('write', { kind, id, afterResidualLen: residual.length });
            break;
          }
        }
      }
      return;
    }
    if (kind === 'phone') {
      const hit = (getKind('phone')?.detect(residual)) || detectPhoneSpan(residual);
      if (hit) {
        // Normalize to E.164 when possible (Italian default)
        let candidate = hit.value;
        const only = candidate.replace(/[^\d+]/g, '');
        let parsed = parsePhoneNumberFromString(only, 'IT');
        if (!parsed && only.startsWith('00')) parsed = parsePhoneNumberFromString('+' + only.slice(2), 'IT');
        if (!parsed && only.startsWith('39')) parsed = parsePhoneNumberFromString('+' + only, 'IT');
        if (!parsed && !only.startsWith('+') && /^3\d{8,}$/.test(only)) parsed = parsePhoneNumberFromString('+39' + only, 'IT');
        const normalized = parsed?.isValid() ? parsed.number : only;
        logMI('phoneNormalize', { raw: hit.value, only, normalized, valid: parsed?.isValid?.() });
        let wroteAny = false;
        for (const id of state.plan.order) {
          const n = state.plan.byId[id];
          const labelMatch = /phone|telefono|cellulare/i.test(String((n as any)?.label || ''));
          const isPhoneNode = String(n?.kind).toLowerCase() === 'phone' || labelMatch;
          const existing = memory[id]?.value;
          const phoneLike = typeof existing === 'string' && /^\+?\d[\d\s\-]{6,}$/.test(existing);
          const canWrite = existing === undefined || !phoneLike; // overwrite wrong type/object or non-phone text
          if (isPhoneNode && canWrite) {
            memory = setMemory(memory, id, normalized, false);
            logMI('memWrite', { id, kind: 'phone', value: normalized, byLabel: labelMatch && String(n?.kind).toLowerCase() !== 'phone', overwrite: existing !== undefined });
            // Also populate canonical subs when present: Number (required) and optional Prefix
            if (Array.isArray((n as any)?.subs) && (n as any).subs.length > 0) {
              const cc = (parsed && (parsed as any).countryCallingCode) ? '+' + (parsed as any).countryCallingCode : (normalized.match(/^(\+\d{1,3})/)?.[1] || undefined);
              for (const sid of (n as any).subs) {
                const sub = state.plan.byId[sid];
                const slabel = String((sub?.label || '')).toLowerCase();
                const isNumberLabel = /number|telefono|phone\s*number/.test(slabel);
                const isPrefixLabel = /prefix|prefisso|country\s*code|countrycode/.test(slabel);
                if (isNumberLabel) {
                  if (memory[sid]?.value === undefined) {
                    memory = setMemory(memory, sid, normalized, false);
                    logMI('memWrite', { id: sid, kind: 'phone.number', value: normalized, label: slabel });
                  }
                } else if (isPrefixLabel && cc) {
                  if (memory[sid]?.value === undefined) {
                    memory = setMemory(memory, sid, cc, false);
                    logMI('memWrite', { id: sid, kind: 'phone.prefix', value: cc, label: slabel });
                  }
                }
              }
            }
            subtract(hit.span);
            logMI('write', { kind: 'phone', id, afterResidualLen: residual.length });
            wroteAny = true;
            break;
          }
        }
        if (!wroteAny) {
          logMI('phoneNoTarget', { note: 'no phone-like node found to write' });
        }
      }
      return;
    }
    if (kind === 'date') {
      const det = (getKind('date')?.detect(residual));
      const hit = det ? { day: (det as any).value?.day, month: (det as any).value?.month, year: (det as any).value?.year, span: (det as any).span } : detectDateSpan(residual);
      if (hit) {
        logMI('hit', { kind, value: { day: hit.day, month: hit.month, year: hit.year }, span: hit.span, residualLen: residual.length });
        for (const id of state.plan.order) {
          const n = state.plan.byId[id];
          if (String(n?.kind).toLowerCase() === 'date') {
            if (Array.isArray(n.subs) && n.subs.length > 0) {
              for (const sid of n.subs) {
                const sub = state.plan.byId[sid];
                const norm = (sub?.label || '').toLowerCase();
                if (norm.includes('day') && hit.day !== undefined) { memory = setMemory(memory, sid, hit.day, false); logMI('memWrite', { id: sid, kind: 'date.day', value: hit.day }); }
                if (norm.includes('month') && hit.month !== undefined) { memory = setMemory(memory, sid, hit.month as any, false); logMI('memWrite', { id: sid, kind: 'date.month', value: hit.month }); }
                if (norm.includes('year') && hit.year !== undefined) { memory = setMemory(memory, sid, hit.year, false); logMI('memWrite', { id: sid, kind: 'date.year', value: hit.year }); }
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
      const det = (getKind('name')?.detect(residual));
      const hit = det ? { firstname: (det as any).value?.firstname, lastname: (det as any).value?.lastname, span: (det as any).span } : detectNameFrom(residual);
      if (hit && (hit.firstname || hit.lastname)) {
        logMI('hit', { kind, value: { firstname: hit.firstname, lastname: hit.lastname }, span: hit.span, residualLen: residual.length });
        for (const id of state.plan.order) {
          const n = state.plan.byId[id];
          if (String(n?.kind).toLowerCase() === 'name') {
            let wrote = false;
            if (Array.isArray(n.subs) && n.subs.length > 0) {
              for (const sid of n.subs) {
                const sub = state.plan.byId[sid];
                const norm = (sub?.label || '').toLowerCase();
                if (norm.includes('first') && hit.firstname && (memory[sid]?.value === undefined)) { memory = setMemory(memory, sid, hit.firstname, false); logMI('memWrite', { id: sid, kind: 'name.first', value: hit.firstname }); wrote = true; }
                if (norm.includes('last') && hit.lastname && (memory[sid]?.value === undefined)) { memory = setMemory(memory, sid, hit.lastname, false); logMI('memWrite', { id: sid, kind: 'name.last', value: hit.lastname }); wrote = true; }
              }
            } else {
              const v = [hit.firstname, hit.lastname].filter(Boolean).join(' ');
              if (v && (memory[id]?.value === undefined)) { memory = setMemory(memory, id, v, false); logMI('memWrite', { id, kind: 'name', value: v }); wrote = true; }
            }
            if (wrote) {
            subtract(hit.span);
            logMI('write', { kind, id, afterResidualLen: residual.length });
            } else {
              logMI('skipSubtract', { kind, reason: 'name already present' });
            }
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
    // Fallback: if kind is mis-normalized, infer from label (phone/email/date/name)
    const mainKind = String(main.kind || '').toLowerCase();
    const labelStr = String((main as any)?.label || '').toLowerCase();
    let primaryKind = mainKind;
    if (!primaryKind || primaryKind === 'generic') {
      if (/phone|telefono|cellulare/.test(labelStr)) primaryKind = 'phone';
      else if (/email|e-?mail/.test(labelStr)) primaryKind = 'email';
      else if (/date\s*of\s*birth|data\s*di\s*nascita|dob|birth/.test(labelStr)) primaryKind = 'date';
      else if (/full\s*name|name|nome/.test(labelStr)) primaryKind = 'name';
    }
    // Guard against accidental address kind on phone label
    if (primaryKind === 'address' && /phone|telefono|cellulare/.test(labelStr)) primaryKind = 'phone';
    logMI('primaryKind', { mainKind, label: labelStr, chosen: primaryKind });
    const extracted = extractOrdered(state, input, primaryKind);
    if (extracted.memory !== state.memory) {
      state = { ...state, memory: extracted.memory };
    }
    // Implicit correction: if input contains a correction, try to re-parse that
    const residual = extracted.residual ?? input;
    try {
      const mainLabel = String(main.label || main.id);
      const presentSubs = (Array.isArray(main.subs) ? main.subs : [])
        .filter((sid) => {
          const m = state.memory[sid];
          return m && m.value !== undefined && m.value !== null && String(m.value).length > 0;
        })
        .map((sid) => String(state.plan.byId[sid]?.label || sid));
      logMI('postExtract', { main: mainLabel, residual, presentSubs });
    } catch {}
    const dateDet = getKind('date')?.detect(residual);
    const corrected = extractImplicitCorrection(residual) || dateDet?.value || extractLastDate(residual) || residual;
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
      // Atomic mains: write value directly, but never overwrite a value already set by MI extraction with empty residual
      const nextVal = (variables as any).value ?? corrected;
      const hasExisting = mem[main.id]?.value !== undefined;
      const isEmpty = nextVal === undefined || String(nextVal).trim().length === 0;
      if (!hasExisting && !isEmpty) {
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
    // Respect required=false on sub nodes
    const requiredSubsOf = (node: DDTNode) => (node.subs || []).filter((sid) => !!state.plan.byId[sid]).filter((sid) => state.plan.byId[sid].required !== false);
    const nextMissingRequired = (node: DDTNode, memory: Memory): string | undefined => {
      for (const sid of requiredSubsOf(node)) {
        const m = memory[sid];
        if (!m || m.value === undefined || m.value === null || String(m.value).length === 0) return sid;
      }
      return undefined;
    };
    const isSaturatedRequired = (node: DDTNode, memory: Memory): boolean => {
      const subs = requiredSubsOf(node);
      if (subs.length === 0) return isSaturated(node, memory);
      for (const sid of subs) {
        const m = memory[sid];
        if (!m || m.value === undefined || m.value === null || String(m.value).length === 0) return false;
      }
      return true;
    };

    const missing = nextMissingRequired(main, mem);
    const saturated = isSaturatedRequired(main, mem);
    try {
      const missLabel = missing ? String(state.plan.byId[missing]?.label || missing) : undefined;
      logMI('decision', { main: String(main.label || main.id), saturated, missing: missLabel, nextMode: saturated && !missing ? 'ConfirmingMain' : missing ? 'CollectingSub' : 'CollectingMain' });
    } catch {}
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
    try {
      logMI('subWrite', { main: String(currentMain(state)?.label || ''), sub: String(state.plan.byId[sid]?.label || sid), value: corrected });
    } catch {}
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
    // Ask only required sub-fields next
    const requiredIds = (main.subs || []).filter((s) => !!state.plan.byId[s] && state.plan.byId[s].required !== false);
    const nextRequiredMissing = requiredIds.find((s) => {
      const m = mem[s];
      return !m || m.value === undefined || m.value === null || String(m.value).length === 0;
    });
    if (nextRequiredMissing) {
      try {
        const labels = requiredIds.map((s) => String(state.plan.byId[s]?.label || s));
        logMI('collectingSub.next', { main: main.label, required: labels, next: String(state.plan.byId[nextRequiredMissing]?.label || nextRequiredMissing) });
      } catch {}
      return { ...state, memory: mem, currentSubId: nextRequiredMissing };
    }
    try {
      logMI('collectingSub.done', { main: String(main.label || main.id) });
    } catch {}
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


