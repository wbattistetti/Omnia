// DDT Engine V2 - Clean implementation following documentation
// Implements state machine logic as documented in documentation/DDT Engine.md

import type { DDTTemplateV2, DDTNode } from './model/ddt.v2.types';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { buildPlan, isSaturated, nextMissingSub, applyComposite, setMemory, Memory, Plan } from './state';
import { isYes, isNo, extractImplicitCorrection } from './utils';
import { getKind } from './parsers/registry';
import { getLogger } from './logger';

// Debug helpers for mixed-initiative tracing
function logMI(...args: any[]) {
  const logger = getLogger();
  if (!logger.miEnabled) return;
  try { logger.debug('[MixedInit]', ...args); } catch { }
}

// ============================================================================
// Node State - Internal state per ogni nodo (main o sub)
// ============================================================================

export type NodeStep = 'Start' | 'NoMatch' | 'NoInput' | 'Confirmation' | 'NotConfirmed' | 'Success';

export interface NodeState {
  step: NodeStep;
  counters: {
    noMatch: number;
    noInput: number;
    confirmation: number;
    notConfirmed: number;
  };
}

// ============================================================================
// Simulator State - Compatible with existing interface
// ============================================================================

export type Mode =
  | 'CollectingMain'
  | 'CollectingSub'
  | 'ConfirmingMain'
  | 'NotConfirmed'
  | 'SuccessMain'
  | 'Completed';

export interface SimulatorState {
  plan: Plan;
  mode: Mode; // External mode for compatibility
  currentIndex: number;
  currentSubId?: string;
  memory: Memory;
  transcript: Array<{ from: 'bot' | 'user'; text: string; meta?: any }>;
  counters: { notConfirmed: number }; // Legacy, kept for compatibility
  // New: internal node states
  nodeStates: Record<string, NodeState>;
}

// ============================================================================
// Helper Functions
// ============================================================================

function currentMain(state: SimulatorState): DDTNode | undefined {
  const mainId = state.plan.order[state.currentIndex];
  return state.plan.byId[mainId];
}

function getNodeState(state: SimulatorState, nodeId: string): NodeState {
  if (!state.nodeStates[nodeId]) {
    state.nodeStates[nodeId] = {
      step: 'Start',
      counters: { noMatch: 0, noInput: 0, confirmation: 0, notConfirmed: 0 }
    };
  }
  return state.nodeStates[nodeId];
}

function setNodeState(state: SimulatorState, nodeId: string, updater: (ns: NodeState) => NodeState): SimulatorState {
  const current = getNodeState(state, nodeId);
  const updated = updater(current);
  return {
    ...state,
    nodeStates: { ...state.nodeStates, [nodeId]: updated }
  };
}

function requiredSubsOf(node: DDTNode, byId: Record<string, DDTNode>): string[] {
    const subs = (node.subs || []).filter((sid) => !!byId[sid]);
    return subs.filter((sid) => byId[sid].required !== false);
}

function nextMissingRequired(node: DDTNode, byId: Record<string, DDTNode>, memory: Memory): string | undefined {
    const subs = requiredSubsOf(node, byId);
    for (const sid of subs) {
      const m = memory[sid];
      if (!m || m.value === undefined || m.value === null || String(m.value).length === 0) return sid;
    }
    return undefined;
}

function isSaturatedRequired(node: DDTNode, byId: Record<string, DDTNode>, memory: Memory): boolean {
    const subs = requiredSubsOf(node, byId);
    if (subs.length === 0) return isSaturated(node, memory);
    for (const sid of subs) {
      const m = memory[sid];
      if (!m || m.value === undefined || m.value === null || String(m.value).length === 0) return false;
    }
    return true;
}

// ============================================================================
// Mixed Initiative Extraction (reused from old engine)
// ============================================================================

const MONTH_WORDS = new Set([
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
  'gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'sett', 'ott', 'nov', 'dic',
]);

const NAME_STOPWORDS = new Set(['nato', 'nata', 'born', 'a', 'in', 'il', 'lo', 'la', 'le', 'del', 'della', 'dei', 'di', 'da', 'the', 'at', 'on', 'mi', 'chiamo', 'nome', 'e', 'è', 'my', 'name', 'is', 'sono']);

function isMonthWord(word: string): boolean {
  const w = word.normalize('NFKD').replace(/[^a-zA-Z]/g, '').toLowerCase();
  return w.length > 0 && MONTH_WORDS.has(w);
}

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

// Granular detectors for isolated date sub-components (used in ToComplete mode)
function detectMonthSpan(text: string): { value: number | string; span: [number, number] } | undefined {
  const monthAlt = Array.from(MONTH_WORDS).join('|');
  // Match month word alone (e.g., "dicembre", "novembre")
  const re = new RegExp(`\\b(${monthAlt})\\b`, 'i');
  const m = re.exec(text);
  if (m) {
    const month = m[1];
    return { value: month, span: [m.index, m.index + m[0].length] };
  }
  // Match numeric month (1-12)
  const reNum = /\b(0?[1-9]|1[0-2])\b/;
  const mNum = reNum.exec(text);
  if (mNum) {
    const month = parseInt(mNum[1], 10);
    return { value: month, span: [mNum.index, mNum.index + mNum[0].length] };
  }
  return undefined;
}

function detectDaySpan(text: string): { value: number; span: [number, number] } | undefined {
  // Match day (1-31) as standalone number
  const re = /\b([12]?[0-9]|3[01])\b/;
  const m = re.exec(text);
  if (m) {
    const day = parseInt(m[1], 10);
    // Avoid matching years (1900-2099) as days
    if (day >= 1900 && day <= 2099) return undefined;
    return { value: day, span: [m.index, m.index + m[0].length] };
  }
  return undefined;
}

function detectYearSpan(text: string): { value: number; span: [number, number] } | undefined {
  // Match year (1900-2099 or 00-99)
  const re = /(?:\b(?:nel|del|in|of|anno|year)\s+)?((?:19|20)\d{2}|\b\d{2}\b)/i;
  const m = re.exec(text);
  if (m) {
    const yearStr = m[1];
    const year = parseInt(yearStr.length === 2 ? `19${yearStr}` : yearStr, 10);
    const start = text.indexOf(yearStr, m.index);
    return { value: year, span: [start, start + yearStr.length] };
  }
  return undefined;
}

function detectDateSpan(text: string): { day?: number; month?: number | string; year?: number; span: [number, number] } | undefined {
  const re1 = /(\b\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/;
  const m1 = re1.exec(text);
  if (m1) {
    const day = parseInt(m1[1], 10);
    const month = parseInt(m1[2], 10);
    const year = parseInt(m1[3].length === 2 ? `19${m1[3]}` : m1[3], 10);
    return { day, month, year, span: [m1.index, m1.index + m1[0].length] };
  }
  const re2 = /(\b\d{1,2})\s+([A-Za-zÀ-ÿ]{3,})\s+(?:di|de|del|della|nel|nell'|anno\s*)?(\d{2,4})\b/i;
  const m2 = re2.exec(text);
  if (m2) {
    const day = parseInt(m2[1], 10);
    const month = m2[2];
    const year = parseInt(m2[3].length === 2 ? `19${m2[3]}` : m2[3], 10);
    return { day, month, year, span: [m2.index, m2.index + m2[0].length] };
  }
  const monthAlt = Array.from(MONTH_WORDS).join('|');
  // Pattern for "day month" (e.g., "12 dicembre") - MUST come before "month day" pattern
  // This is more specific: day at the start, then month word
  const re2b = new RegExp(`(\\b\\d{1,2})\\s+(${monthAlt})\\b`, 'i');
  const m2b = re2b.exec(text);
  if (m2b) {
    const day = parseInt(m2b[1], 10);
    const month = m2b[2];
    return { day, month, span: [m2b.index, m2b.index + m2b[0].length] };
  }
  // Pattern for "month day" (e.g., "dicembre 12") - MUST come before "month year" pattern
  // This is more specific: 1-2 digits after month is likely a day, not a year
  const re3b = new RegExp(`(?:\\b|\\s)(${monthAlt})\\s+(\\d{1,2})\\b`, 'i');
  const m3b = re3b.exec(text);
  if (m3b) {
    const month = m3b[1];
    const day = parseInt(m3b[2], 10);
    return { day, month, span: [m3b.index, m3b.index + m3b[0].length] };
  }
  // Pattern for "month year" (e.g., "dicembre 1980") - comes after "month day"
  const re3 = new RegExp(`(?:\\b|\\s)(${monthAlt})\\s+(?:di|de|del|della|nel|nell'|anno\\s*)?(\\d{2,4})\\b`, 'i');
  const m3 = re3.exec(text);
  if (m3) {
    const month = m3[1];
    const year = parseInt(m3[2].length === 2 ? `19${m3[2]}` : m3[2], 10);
    return { month, year, span: [m3.index, m3.index + m3[0].length] };
  }
  const re4 = /(\b(0?[1-9]|1[0-2]))[\/\-](\d{2,4})\b/;
  const m4 = re4.exec(text);
  if (m4) {
    const month = parseInt(m4[1], 10);
    const year = parseInt(m4[3].length === 2 ? `19${m4[3]}` : m4[3], 10);
    return { month, year, span: [m4.index, m4.index + m4[0].length] };
  }
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
  const m = s.match(/(?:mi\s+ch(?:ia|ai)mo|il\s+mio\s+nome\s+(?:e|è))\s+([A-Za-zÀ-ÿ'`-]+)(?:\s+([A-Za-zÀ-ÿ'`-]+))?/i);
  if (m) {
    const first = m[1];
    const last = m[2];
    const start = m.index ?? 0;
    const nameStr = [first, last].filter(Boolean).join(' ');
    const span: [number, number] = [s.indexOf(nameStr, start), (s.indexOf(nameStr, start) + nameStr.length)];
    return { firstname: first, lastname: last, span };
  }
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
      if (picked.length === 0) continue;
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

function extractOrdered(
  state: SimulatorState,
  input: string,
  primaryKind: string,
  extractAllSubs?: boolean,
  mainNode?: DDTNode
): { memory: Memory; residual: string; hasMatch: boolean } {
  let residual = input;
  let memory = state.memory;
  let hasMatch = false;

  // When in ToComplete with active sub, extract ALL subs of the main
  // Otherwise, extract ONLY the primaryKind for the active node
  // This prevents matching unrelated data types in Normal mode
  // but allows mixed initiative in ToComplete mode
  let ordered: string[] = primaryKind ? [primaryKind] : [];

  if (extractAllSubs && mainNode && Array.isArray(mainNode.subs) && mainNode.subs.length > 0) {
    // Extract all subs of the main - user can answer the direct question AND provide other data
    // The extraction will match any sub of the main, not just the active one
    ordered = [primaryKind]; // Still use primaryKind for extraction, but it will match all subs
    logMI('extractAllSubs', { primaryKind, mainId: mainNode.id, subsCount: mainNode.subs.length });
  } else {
    logMI('extractPrimaryOnly', { primaryKind, reason: 'Normal mode or no subs' });
  }

  logMI('order', { primaryKind, ordered, extractAllSubs });

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
        hasMatch = true; // Grammatica ha matchato qualcosa
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
        hasMatch = true; // Grammatica ha matchato qualcosa
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
          const canWrite = existing === undefined || !phoneLike;
          if (isPhoneNode && canWrite) {
            memory = setMemory(memory, id, normalized, false);
            logMI('memWrite', { id, kind: 'phone', value: normalized, byLabel: labelMatch && String(n?.kind).toLowerCase() !== 'phone', overwrite: existing !== undefined });
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
      // When in ToComplete mode with mainNode, try full date detection first (can match multiple subs)
      // Then fallback to granular detectors for isolated sub-components (e.g., "dicembre" alone)
      const det = (getKind('date')?.detect(residual));
      let hit: { day?: number; month?: number | string; year?: number; span?: [number, number] } | undefined;
      if (det && ((det as any).value?.day !== undefined || (det as any).value?.month !== undefined || (det as any).value?.year !== undefined)) {
        hit = { day: (det as any).value?.day, month: (det as any).value?.month, year: (det as any).value?.year, span: (det as any).span };
      } else {
        hit = detectDateSpan(residual);
      }

      // If full date detection matched, use it (can match multiple subs like "dicembre 12")
      if (hit) {
        hasMatch = true;
        logMI('hit', { kind, value: { day: hit.day, month: hit.month, year: hit.year }, span: hit.span, residualLen: residual.length, full: true });
        for (const id of state.plan.order) {
          const n = state.plan.byId[id];
          if (String(n?.kind).toLowerCase() === 'date') {
            if (Array.isArray(n.subs) && n.subs.length > 0) {
              // Match subs by label (case insensitive, exact or partial match)
              for (const sid of n.subs) {
                const sub = state.plan.byId[sid];
                if (!sub) continue;
                const label = String(sub?.label || '').toLowerCase().trim();
                const idLower = String(sid || '').toLowerCase().trim();

                // Match day: label must contain 'day' or ID is 'day'
                if (hit.day !== undefined) {
                  if (label === 'day' || label.includes('day') || idLower === 'day' || label.includes('giorno')) {
                    memory = setMemory(memory, sid, hit.day, false);
                    logMI('memWrite', { id: sid, label, idLower, kind: 'date.day', value: hit.day });
                  }
                }

                // Match month: label must contain 'month' or ID is 'month'
                if (hit.month !== undefined) {
                  let monthValue = hit.month;
                  if (typeof monthValue === 'string') {
                    const MONTHS: Record<string, number> = {
                      january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
                      may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8, september: 9, sep: 9, sept: 9,
                      october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
                      gennaio: 1, gen: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, mag: 5,
                      giugno: 6, giu: 6, luglio: 7, lug: 7, agosto: 8, ago: 8, settembre: 9, set: 9,
                      ottobre: 10, ott: 10, novembre: 11, dicembre: 12, dic: 12,
                    };
                    monthValue = MONTHS[monthValue.toLowerCase()] || monthValue;
                  }
                  if (label === 'month' || label.includes('month') || idLower === 'month' || label.includes('mese')) {
                    memory = setMemory(memory, sid, monthValue, false);
                    logMI('memWrite', { id: sid, label, idLower, kind: 'date.month', value: monthValue });
                  }
                }

                // Match year: label must contain 'year' or ID is 'year'
                if (hit.year !== undefined) {
                  if (label === 'year' || label.includes('year') || idLower === 'year' || label.includes('anno')) {
                    memory = setMemory(memory, sid, hit.year, false);
                    logMI('memWrite', { id: sid, label, idLower, kind: 'date.year', value: hit.year });
                  }
                }
              }
            }
            subtract(hit.span);
            logMI('write', { kind, id, afterResidualLen: residual.length });
            break;
          }
        }
        return;
      }

      // Fallback to granular detectors for isolated sub-components (only in ToComplete mode)
      // This allows matching "dicembre" alone even if it doesn't form a complete date
      if (extractAllSubs && mainNode && Array.isArray(mainNode.subs) && mainNode.subs.length > 0) {
        // Try granular detectors (month/day/year isolated)
        let matchedAny = false;

        // Try month detector
        const monthHit = detectMonthSpan(residual);
        if (monthHit) {
          hasMatch = true;
          matchedAny = true;
          logMI('hit', { kind: 'date.month', value: monthHit.value, span: monthHit.span, residualLen: residual.length, granular: true });

          // Normalize month value
          let monthValue = monthHit.value;
          if (typeof monthValue === 'string') {
            const MONTHS: Record<string, number> = {
              january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
              may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8, september: 9, sep: 9, sept: 9,
              october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
              gennaio: 1, gen: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, mag: 5,
              giugno: 6, giu: 6, luglio: 7, lug: 7, agosto: 8, ago: 8, settembre: 9, set: 9,
              ottobre: 10, ott: 10, novembre: 11, dicembre: 12, dic: 12,
            };
            monthValue = MONTHS[monthValue.toLowerCase()] || monthValue;
          }

          // Write to matching sub
          for (const sid of mainNode.subs) {
            const sub = state.plan.byId[sid];
            if (!sub) continue;
            const label = String(sub?.label || '').toLowerCase().trim();
            const idLower = String(sid || '').toLowerCase().trim();
            if (label === 'month' || label.includes('month') || idLower === 'month' || label.includes('mese')) {
              memory = setMemory(memory, sid, monthValue, false);
              logMI('memWrite', { id: sid, label, idLower, kind: 'date.month', value: monthValue, granular: true });
              subtract(monthHit.span);
            }
          }
        }

        // Try day detector (only if month didn't match to avoid conflicts)
        if (!matchedAny) {
          const dayHit = detectDaySpan(residual);
          if (dayHit) {
            hasMatch = true;
            matchedAny = true;
            logMI('hit', { kind: 'date.day', value: dayHit.value, span: dayHit.span, residualLen: residual.length, granular: true });

            for (const sid of mainNode.subs) {
              const sub = state.plan.byId[sid];
              if (!sub) continue;
              const label = String(sub?.label || '').toLowerCase().trim();
              const idLower = String(sid || '').toLowerCase().trim();
              if (label === 'day' || label.includes('day') || idLower === 'day' || label.includes('giorno')) {
                memory = setMemory(memory, sid, dayHit.value, false);
                logMI('memWrite', { id: sid, label, idLower, kind: 'date.day', value: dayHit.value, granular: true });
                subtract(dayHit.span);
              }
            }
          }
        }

        // Try year detector (only if month/day didn't match)
        if (!matchedAny) {
          const yearHit = detectYearSpan(residual);
          if (yearHit) {
            hasMatch = true;
            matchedAny = true;
            logMI('hit', { kind: 'date.year', value: yearHit.value, span: yearHit.span, residualLen: residual.length, granular: true });

            for (const sid of mainNode.subs) {
              const sub = state.plan.byId[sid];
              if (!sub) continue;
              const label = String(sub?.label || '').toLowerCase().trim();
              const idLower = String(sid || '').toLowerCase().trim();
              if (label === 'year' || label.includes('year') || idLower === 'year' || label.includes('anno')) {
                memory = setMemory(memory, sid, yearHit.value, false);
                logMI('memWrite', { id: sid, label, idLower, kind: 'date.year', value: yearHit.value, granular: true });
                subtract(yearHit.span);
              }
            }
          }
        }

        // If granular detectors matched, return early
        if (matchedAny) {
          return;
        }
      }

      // No match found (neither full date detection nor granular detectors matched)
      return;
    }
    if (kind === 'name') {
      const det = (getKind('name')?.detect(residual));
      const hit = det ? { firstname: (det as any).value?.firstname, lastname: (det as any).value?.lastname, span: (det as any).span } : detectNameFrom(residual);
      if (hit && (hit.firstname || hit.lastname)) {
        hasMatch = true; // Grammatica ha matchato qualcosa
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

  console.log('🔍 [EXTRACT] extractOrdered completato', {
    input: input.substring(0, 100),
    hasMatch,
    memoryKeys: Object.keys(memory),
    memoryValues: Object.keys(memory).map(k => ({ key: k, value: memory[k]?.value })),
    residual: residual.substring(0, 100),
    extractAllSubs,
    mainNodeId: mainNode?.id,
    mainNodeLabel: mainNode?.label
  });

  return { memory, residual, hasMatch };
}

// ============================================================================
// Implicit Correction Detection
// ============================================================================

function handleImplicitCorrection(
  input: string,
  state: SimulatorState,
  currentTarget: 'main' | 'sub',
  main: DDTNode,
  primaryKind: string
): { isCorrection: boolean; hasAnyMatch: boolean; correctedMemory?: Memory } {
  const correctionPattern = extractImplicitCorrection(input);
  if (!correctionPattern) {
    return { isCorrection: false, hasAnyMatch: false };
  }

  // Extract all possible matches from correction phrase
  const allMatches = extractOrdered(state, correctionPattern, primaryKind);
  const hasAnyMatch = allMatches.memory !== state.memory;

  if (hasAnyMatch) {
    return {
      isCorrection: true,
      hasAnyMatch: true,
      correctedMemory: allMatches.memory
    };
  }

  return { isCorrection: true, hasAnyMatch: false };
}

// ============================================================================
// Partial Confirmation Extraction
// ============================================================================

function extractPartialConfirmation(input: string): {
  isPartial: boolean;
  confirmedParts?: string[];
  correctedParts?: { [subId: string]: any };
} {
  // Pattern: "Sì, X è corretto ma Y è Z"
  const pattern1 = /(?:sì|ok|yes|corretto|va bene)[\s,]*([^,]+?)(?:è corretto|va bene|ok)[\s,]*ma[\s,]*([^,]+?)[\s,]*è[\s,]*([^\s,]+)/i;
  const m1 = pattern1.exec(input);
  if (m1) {
    // TODO: Parse confirmed and corrected parts
    // For now, return basic structure
    return { isPartial: true, confirmedParts: [], correctedParts: {} };
  }

  // Pattern: "X va bene, ma Y è Z"
  const pattern2 = /([^,]+?)(?:va bene|è corretto|ok)[\s,]*ma[\s,]*([^,]+?)[\s,]*è[\s,]*([^\s,]+)/i;
  const m2 = pattern2.exec(input);
  if (m2) {
    return { isPartial: true, confirmedParts: [], correctedParts: {} };
  }

  return { isPartial: false };
}

// ============================================================================
// State Mapping: Internal Node States → External Mode
// ============================================================================

function mapStateToMode(state: SimulatorState, main: DDTNode | undefined): Mode {
  if (!main) return 'Completed';

  const mainState = getNodeState(state, main.id);
  const currentSubId = state.currentSubId;

  // Map internal states to external modes
  // Context determinato da currentSubId, non da step
  switch (mainState.step) {
    case 'Start':
    case 'NoMatch':
    case 'NoInput':
      // Context determinato da currentSubId, non da step
      if (currentSubId) return 'CollectingSub';
      return 'CollectingMain';
    case 'Confirmation':
      return 'ConfirmingMain';
    case 'NotConfirmed':
      return 'NotConfirmed';
    case 'Success':
      return 'SuccessMain';
    default:
      return 'CollectingMain';
  }
}

// ============================================================================
// Advance Index (move to next main)
// ============================================================================

function advanceIndex(state: SimulatorState): SimulatorState {
  let nextIdx = state.currentIndex + 1;
  while (nextIdx < state.plan.order.length) {
    const nextId = state.plan.order[nextIdx];
    const nextNode = state.plan.byId[nextId];
    if (nextNode && nextNode.type === 'main') break;
    nextIdx += 1;
  }
  if (nextIdx >= state.plan.order.length) {
    return { ...state, mode: 'Completed', currentIndex: nextIdx };
  }

  const nextMain = state.plan.byId[state.plan.order[nextIdx]];
  let newState: SimulatorState = {
    ...state,
    currentIndex: nextIdx,
    currentSubId: undefined,
    mode: 'CollectingMain'
  };

  // Initialize node state for next main if not present
  if (!newState.nodeStates[nextMain.id]) {
    newState.nodeStates[nextMain.id] = {
      step: 'Start',
      counters: { noMatch: 0, noInput: 0, confirmation: 0, notConfirmed: 0 }
    };
  }

  // If next main has subs and they are all present, compose its main value
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

  // Check if next main has required subs missing
  if (nextMain && Array.isArray((nextMain as any).subs) && (nextMain as any).subs.length > 0) {
    const subsArr: string[] = (nextMain as any).subs.filter((sid: string) => !!newState.plan.byId[sid]);
    const anyPresent = subsArr.some((sid) => {
      const m = newState.memory[sid];
      return m && m.value !== undefined && m.value !== null && String(m.value).length > 0;
    });
    const missingSub = nextMissingRequired(nextMain as any, newState.plan.byId, newState.memory);
    if (missingSub && anyPresent) {
      logMI('advanceIndex', { nextIdx, nextMain: nextMain?.label, nextMode: 'CollectingSub', currentSubId: missingSub });
      return { ...newState, mode: 'CollectingSub', currentSubId: missingSub };
    }
  }

  const nextMode: Mode = (nextMain && isSaturatedRequired(nextMain as any, newState.plan.byId, newState.memory)) ? 'ConfirmingMain' : 'CollectingMain';
  logMI('advanceIndex', { nextIdx, nextMain: nextMain?.label, nextMode });
  return { ...newState, mode: nextMode };
}

// ============================================================================
// Main Advance Function
// ============================================================================

export function initEngine(template: DDTTemplateV2): SimulatorState {
  const plan = buildPlan(template.nodes);
  const nodeStates: Record<string, NodeState> = {};

  // Initialize node states for all nodes
  for (const node of template.nodes) {
    nodeStates[node.id] = {
      step: 'Start',
      counters: { noMatch: 0, noInput: 0, confirmation: 0, notConfirmed: 0 }
    };
  }

  return {
    plan,
    mode: 'CollectingMain',
    currentIndex: 0,
    memory: {},
    transcript: [],
    counters: { notConfirmed: 0 }, // Legacy
    nodeStates
  };
}

export function advance(state: SimulatorState, input: string, extractedVariables?: Record<string, any>): SimulatorState {
  const main = currentMain(state);
  if (!main) {
    const finalState = { ...state, mode: 'Completed' };
    return finalState;
  }

  const trimmedInput = String(input || '').trim();

  // Handle empty input (noInput)
  if (trimmedInput.length === 0) {
    const newState = handleNoInput(state, main);
    return { ...newState, mode: mapStateToMode(newState, main) };
  }

  // Get current node state
  const mainState = getNodeState(state, main.id);
  const currentSubId = state.currentSubId;
  const sub = currentSubId ? state.plan.byId[currentSubId] : undefined;

  // Determine target node (main or sub)
  const targetNode = sub || main;
  const targetState = getNodeState(state, targetNode.id);

  let newState: SimulatorState = state;

  // Handle by current step - check mainState for Confirmation/NotConfirmed/Success
  if (mainState.step === 'Confirmation') {
    newState = handleConfirmation(state, main, trimmedInput);
  } else if (mainState.step === 'NotConfirmed') {
    newState = handleNotConfirmed(state, main, sub, trimmedInput, extractedVariables);
  } else if (mainState.step === 'Success') {
    // Move to next main
    newState = advanceIndex({ ...state, mode: 'CollectingMain' });
  } else if (targetState.step === 'Start' || targetState.step === 'NoMatch' || targetState.step === 'NoInput') {
    // Collecting data
    newState = handleCollecting(state, main, sub, trimmedInput, extractedVariables);
  }

  // Map internal states to external mode
  const updatedMain = currentMain(newState);
  newState = { ...newState, mode: mapStateToMode(newState, updatedMain) };

  return newState;
}

// ============================================================================
// Handle Collecting (Normal, ToComplete, NoMatch, NoInput)
// ============================================================================

function handleCollecting(
  state: SimulatorState,
  main: DDTNode,
  sub: DDTNode | undefined,
  input: string,
  extractedVariables?: Record<string, any>
): SimulatorState {
  // Determina il nodo in contesto (main o sub)
  const contextNode = sub || main;
  const contextType = sub ? 'collectingSub' : 'collectingMain';

  const mainState = getNodeState(state, main.id);
  const contextState = getNodeState(state, contextNode.id);

  // Se il nodo in contesto era in NoMatch/NoInput, torna a Start quando ricevi nuovo input
  if (contextState.step === 'NoMatch' || contextState.step === 'NoInput') {
    console.log('🔄 [ENGINE] Nodo in contesto era in NoMatch/NoInput, tornando a Start', {
      contextNodeId: contextNode.id,
      contextType,
      previousStep: contextState.step,
      newInput: input.substring(0, 50)
    });
    state = setNodeState(state, contextNode.id, (ns) => ({ ...ns, step: 'Start' }));
  }

  const targetNode = sub || main;
  const targetState = getNodeState(state, targetNode.id);

  // Check for implicit correction
  const mainKind = String(main.kind || '').toLowerCase();
  const labelStr = String((main as any)?.label || '').toLowerCase();
  let primaryKind = mainKind;
  if (!primaryKind || primaryKind === 'generic') {
    if (/phone|telefono|cellulare/.test(labelStr)) primaryKind = 'phone';
    else if (/email|e-?mail/.test(labelStr)) primaryKind = 'email';
    else if (/date\s*of\s*birth|data\s*di\s*nascita|dob|birth/.test(labelStr)) primaryKind = 'date';
    else if (/full\s*name|name|nome/.test(labelStr)) primaryKind = 'name';
  }
  if (primaryKind === 'address' && /phone|telefono|cellulare/.test(labelStr)) primaryKind = 'phone';

  const correction = handleImplicitCorrection(input, state, sub ? 'sub' : 'main', main, primaryKind);
  if (correction.isCorrection && correction.hasAnyMatch && correction.correctedMemory) {
    // Apply correction and repeat active question (don't change state)
    let newState: SimulatorState = { ...state, memory: correction.correctedMemory };
    // Recompose main if needed
    if (Array.isArray(main.subs) && main.subs.length > 0) {
      const composeFromSubs = (m: DDTNode, memory: Memory) => {
        if (!Array.isArray(m.subs) || m.subs.length === 0) return memory[m.id]?.value;
        const out: Record<string, any> = {};
        for (const s of (m.subs || [])) {
          const v = memory[s]?.value;
          if (v !== undefined) out[s] = v;
        }
        return out;
      };
      newState = { ...newState, memory: setMemory(newState.memory, main.id, composeFromSubs(main, newState.memory), false) };
    }
    // Reset to Start to repeat question (keep same currentSubId if sub)
    const startState = setNodeState(newState, targetNode.id, (ns) => ({ ...ns, step: 'Start' }));
    return { ...startState, mode: mapStateToMode(startState, main) };
  }

  let mem = state.memory;
  let extracted: { memory: Memory; residual: string; hasMatch: boolean } | undefined = undefined;

  // Priority: use extractedVariables if provided
  if (extractedVariables && typeof extractedVariables === 'object' && Object.keys(extractedVariables).length > 0) {
      logMI('extractedVariables', { extractedVariables, mainKind: main.kind });

      if (Array.isArray(main.subs) && main.subs.length > 0) {
        for (const sid of main.subs) {
        const subNode = state.plan.byId[sid];
        if (!subNode) continue;

        const labelNorm = (subNode?.label || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
          let v: any = undefined;

          if (main.kind === 'name') {
            if (labelNorm.includes('first')) v = extractedVariables.firstname;
            else if (labelNorm.includes('last')) v = extractedVariables.lastname;
          } else if (main.kind === 'date') {
            if (labelNorm.includes('day') || labelNorm.includes('giorno')) v = extractedVariables.day;
            else if (labelNorm.includes('month') || labelNorm.includes('mese')) v = extractedVariables.month;
            else if (labelNorm.includes('year') || labelNorm.includes('anno')) v = extractedVariables.year;
          } else if (main.kind === 'address') {
            if (labelNorm.includes('street')) v = extractedVariables.street;
            else if (labelNorm.includes('city')) v = extractedVariables.city;
            else if (labelNorm.includes('postal') || labelNorm.includes('zip')) v = extractedVariables.postal_code;
            else if (labelNorm.includes('country')) v = extractedVariables.country;
          }

          if (v !== undefined && v !== null && (mem[sid]?.value === undefined)) {
            mem = setMemory(mem, sid, v, false);
          logMI('memWriteFromExtracted', { sid, label: subNode.label, value: v });
          }
        }

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
        state = { ...state, memory: mem };
      } else {
        const value = extractedVariables.value ?? extractedVariables;
        if (value !== undefined && value !== null) {
          mem = setMemory(state.memory, main.id, value, false);
          state = { ...state, memory: mem };
        }
      }
      mem = state.memory;

      // Always create extracted object with hasMatch=true when extractedVariables are provided
      // because those variables come from a successful match
      extracted = { memory: mem, residual: input, hasMatch: true };
      logMI('extractedFromVariables', { hasMatch: true, memoryKeys: Object.keys(mem) });
    } else {
    // Fallback to mixed-initiative extraction
      logMI('primaryKind', { mainKind, label: labelStr, chosen: primaryKind });

    // When in collectingSub context, extract ALL subs of the main
    // This allows user to answer the direct question AND provide other subs
    // Context determinato da currentSubId, non da step
    const isCollectingSub = sub !== undefined;
    extracted = extractOrdered(state, input, primaryKind, isCollectingSub, main);

    // Use extracted memory directly - it already has the values from extractOrdered
    mem = extracted.memory;

    // Only use applyComposite if extractOrdered didn't find anything (residual is still the input)
      const residual = extracted.residual ?? input;
    const extractedFoundSomething = Object.keys(extracted.memory).length > Object.keys(state.memory).length ||
      Object.keys(extracted.memory).some(key => {
        const oldVal = state.memory[key];
        const newVal = extracted.memory[key];
        return !oldVal || (oldVal.value !== newVal?.value);
      });

    if (!extractedFoundSomething && residual.trim() === input.trim()) {
      // extractOrdered didn't find anything, try applyComposite as fallback
      const dateDet = getKind('date')?.detect(residual);
      const corrected = extractImplicitCorrection(residual) || dateDet?.value || residual;
      const applied = applyComposite(main.kind, corrected);
      const variables = applied.variables;

      // For mains with subs, populate only subs
      if (Array.isArray(main.subs) && main.subs.length > 0) {
        for (const sid of main.subs) {
        const subNode = state.plan.byId[sid];
        const labelNorm = (subNode?.label || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
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
        const nextVal = (variables as any).value ?? corrected;
        const hasExisting = mem[main.id]?.value !== undefined;
        const isEmpty = nextVal === undefined || String(nextVal).trim().length === 0;
        if (!hasExisting && !isEmpty) {
          mem = setMemory(state.memory, main.id, nextVal, false);
        }
      }

    // Propagate composite parts into sub memory
      if (Array.isArray(main.subs) && main.subs.length > 0) {
        for (const sid of main.subs) {
          const val = (applied.variables as any)[sid];
          const alt = Object.entries(applied.variables as any).find(([k]) => k === sid || k.replace(/[^a-z0-9]+/g, '') === sid.replace(/[^a-z0-9]+/g, ''));
          const chosen = val !== undefined ? val : (alt ? alt[1] : undefined);
          if (chosen !== undefined) {
            mem = setMemory(mem, sid, chosen, false);
          }
        }
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
    }
  }

  // Separate concepts: matchOccurred vs memoryChanged
  // matchOccurred: grammar recognized something (even if value already present)
  // memoryChanged: memory actually changed (new value or different value)

  // Check if a match occurred (grammar recognized something)
  // This is separate from memoryChanged: a match can occur even if memory doesn't change
  // (e.g., user says "dicembre" when month=12 already in memory)
  const matchOccurred = extracted?.hasMatch === true;

  // Check if memory changed (deep comparison)
  let memoryChanged = false;
  const oldKeys = Object.keys(state.memory);
  const newKeys = Object.keys(mem);
  if (newKeys.length !== oldKeys.length) {
    memoryChanged = true;
  } else {
    // Check if existing values changed or new values added
    for (const key of newKeys) {
      const newVal = mem[key];
      const oldVal = state.memory[key];

      // New key added
      if (!oldVal) {
        memoryChanged = true;
        break;
      }

      // Value changed
      if (typeof newVal.value === 'object' && newVal.value !== null && typeof oldVal.value === 'object' && oldVal.value !== null) {
        // Deep comparison for objects
        try {
          if (JSON.stringify(newVal.value) !== JSON.stringify(oldVal.value)) {
            memoryChanged = true;
            break;
          }
        } catch {
          // If JSON.stringify fails, compare by reference
          if (newVal.value !== oldVal.value) {
            memoryChanged = true;
            break;
          }
        }
      } else if (newVal.value !== oldVal.value) {
        memoryChanged = true;
        break;
      }

      // Confirmed flag changed
      if (newVal.confirmed !== oldVal.confirmed) {
        memoryChanged = true;
        break;
      }
    }
  }

  // Logging mirato per debug
  logMI('matchCheck', {
    hasExtracted: !!extracted,
    extractedHasMatch: extracted?.hasMatch,
    matchOccurred,
    memoryChanged,
    currentSubId: state.currentSubId,
    mainId: main.id,
    subId: sub?.id
  });

  // Use matchOccurred to determine if we should go to noMatch
  // NOT memoryChanged (which can be false even if match occurred)
  if (!matchOccurred) {
    // NoMatch totale → incrementa contatore sul nodo in contesto (main o sub)
    console.log('🚨 [ENGINE] NoMatch totale rilevato', {
      contextType,
      contextNodeId: contextNode.id,
      contextNodeLabel: contextNode.label,
      mainId: main.id,
      mainLabel: main.label,
      subId: sub?.id,
      subLabel: sub?.label,
      extractedHasMatch: extracted?.hasMatch,
      memoryChanged,
      matchOccurred,
      input: input.substring(0, 50)
    });

    logMI('noMatchTotal', {
      contextType,
      contextNodeId: contextNode.id,
      mainId: main.id,
      currentSubId: state.currentSubId,
      reason: 'NoMatch totale: nessuna grammatica ha riconosciuto nulla'
    });

    // NoMatch sul nodo in contesto (main se collectingMain, sub se collectingSub)
    const noMatchState = handleNoMatch(state, contextNode);

    console.log('🚨 [ENGINE] Dopo handleNoMatch sul nodo in contesto', {
      contextType,
      contextNodeId: contextNode.id,
      contextCounter: noMatchState.nodeStates[contextNode.id]?.counters?.noMatch,
      contextStep: noMatchState.nodeStates[contextNode.id]?.step,
      mode: noMatchState.mode,
      currentSubId: noMatchState.currentSubId,
      note: 'Nodo in contesto rimane in NoMatch per permettere alla UI di mostrare escalation'
    });

    // Preserva currentSubId se eravamo in collectingSub
    const preservedState = state.currentSubId
      ? { ...noMatchState, currentSubId: state.currentSubId }
      : noMatchState;

    return { ...preservedState, mode: mapStateToMode(preservedState, main) };
  }

  // Match occurred → update memory and check saturation
  state = { ...state, memory: mem };

  // Handle sub collection
  if (sub) {
    // Recompose main value from current sub values
    const composeFromSubs = (m: DDTNode, memory: Memory) => {
      if (!Array.isArray(m.subs) || m.subs.length === 0) return memory[m.id]?.value;
      const out: Record<string, any> = {};
      for (const s of (m.subs || [])) {
        const v = memory[s]?.value;
        if (v !== undefined) out[s] = v;
      }
      return out;
    };
    state = { ...state, memory: setMemory(state.memory, main.id, composeFromSubs(main, state.memory), false) };

    // Check if the active sub matched (per distinguere match utile da irrilevante)
    const activeSubMatched = mem[sub.id]?.value !== undefined &&
                             mem[sub.id]?.value !== state.memory[sub.id]?.value;

    // Find next missing required sub
    const requiredIds = (main.subs || []).filter((s) => !!state.plan.byId[s] && state.plan.byId[s].required !== false);
    const nextRequiredMissing = requiredIds.find((s) => {
      const m = mem[s];  // Usa memoria aggiornata (mem) invece di state.memory
      return !m || m.value === undefined || m.value === null || String(m.value).length === 0;
    });

    if (nextRequiredMissing) {
      // More subs to collect
      // Match irrilevante: se il sub attivo non ha matchato, rimani su quello stesso
      if (nextRequiredMissing === sub.id && !activeSubMatched) {
        // Match irrilevante → non cambia step, ripete prompt stesso context
        // Rimani in Start (non ToComplete) con lo stesso sub
        return setNodeState(
          { ...state, currentSubId: sub.id },
          main.id,
          (ns) => ({ ...ns, step: 'Start' })
        );
      }
      // Match utile → passa al prossimo sub mancante (o stesso se era quello)
      return setNodeState(
        { ...state, currentSubId: nextRequiredMissing },
        main.id,
        (ns) => ({ ...ns, step: 'Start' })
      );
    }

    // All subs filled → go to confirmation
    const confirmState = setNodeState(
      { ...state, currentSubId: undefined },
      main.id,
      (ns) => ({ ...ns, step: 'Confirmation' })
    );
    return { ...confirmState, mode: mapStateToMode(confirmState, main) };
  }

  // Handle main collection
  // First, recompose main value from subs if needed
  if (Array.isArray(main.subs) && main.subs.length > 0) {
    const composeFromSubs = (m: DDTNode, memory: Memory) => {
      if (!Array.isArray(m.subs) || m.subs.length === 0) return memory[m.id]?.value;
      const out: Record<string, any> = {};
      for (const s of (m.subs || [])) {
        const v = memory[s]?.value;
        if (v !== undefined) out[s] = v;
      }
      return out;
    };
    state = { ...state, memory: setMemory(state.memory, main.id, composeFromSubs(main, state.memory), false) };
  }

  const missing = nextMissingRequired(main, state.plan.byId, state.memory);
  const saturated = isSaturatedRequired(main, state.plan.byId, state.memory);

  if (saturated && !missing) {
    // All filled → check if confirmation step exists
    const hasConfirmation = main.steps?.confirm && (
      (typeof main.steps.confirm === 'object' && main.steps.confirm.base) ||
      (Array.isArray(main.steps.confirm) && main.steps.confirm.length > 0)
    );

    if (hasConfirmation) {
      // Confirmation step exists → go to Confirmation
      const confirmState = setNodeState(state, main.id, (ns) => ({ ...ns, step: 'Confirmation' }));
      return { ...confirmState, mode: mapStateToMode(confirmState, main) };
    } else {
      // No confirmation step → go directly to Success
      const successState = setNodeState(state, main.id, (ns) => ({ ...ns, step: 'Success' }));
      return { ...successState, mode: mapStateToMode(successState, main) };
    }
  }

  if (missing) {
    // Some subs missing → passa al primo sub mancante, step = Start
    const startState = setNodeState(
      { ...state, currentSubId: missing },
      main.id,
      (ns) => ({ ...ns, step: 'Start' })
    );
    return { ...startState, mode: mapStateToMode(startState, main) };
  }

  // Still collecting main → stay in Start
  const startState = setNodeState(state, main.id, (ns) => ({ ...ns, step: 'Start' }));
  return { ...startState, mode: mapStateToMode(startState, main) };
}

// ============================================================================
// Handle NoMatch
// ============================================================================

function handleNoMatch(state: SimulatorState, node: DDTNode): SimulatorState {
  const nodeState = getNodeState(state, node.id);
  const nextCounter = Math.min(3, nodeState.counters.noMatch + 1);
  const main = currentMain(state);

  // Set step to NoMatch and increment counter
  // DO NOT return to Start immediately - let the UI show the escalation message
  // The step will return to Start when the user provides a new input (handled in handleCollecting)
  const newState = setNodeState(
    state,
    node.id,
    (ns) => ({
      ...ns,
      step: 'NoMatch',
      counters: { ...ns.counters, noMatch: nextCounter }
    })
  );

  console.log('🚨 [ENGINE] handleNoMatch completato', {
    nodeId: node.id,
    nodeLabel: node.label,
    step: 'NoMatch',
    counter: nextCounter,
    note: 'Step rimane NoMatch per permettere alla UI di mostrare escalation'
  });

  return newState;
}

// ============================================================================
// Handle NoInput
// ============================================================================

function handleNoInput(state: SimulatorState, main: DDTNode): SimulatorState {
  const currentSubId = state.currentSubId;
  const targetNode = currentSubId ? state.plan.byId[currentSubId] : main;
  if (!targetNode) return state;

  const nodeState = getNodeState(state, targetNode.id);
  const nextCounter = Math.min(3, nodeState.counters.noInput + 1);

  const newState = setNodeState(
    state,
    targetNode.id,
    (ns) => ({
      ...ns,
      step: 'NoInput',
      counters: { ...ns.counters, noInput: nextCounter }
    })
  );

  // DO NOT return to Start immediately - let the UI show the escalation message
  // The step will return to Start when the user provides a new input (handled in handleCollecting)
  return newState;
}

// ============================================================================
// Handle Confirmation
// ============================================================================

function handleConfirmation(state: SimulatorState, main: DDTNode, input: string): SimulatorState {
    if (isYes(input)) {
    // Confirmed → mark as confirmed and go to Success
      const mem = setMemory(state.memory, main.id, state.memory[main.id]?.value, true);
    const successState = setNodeState(
      { ...state, memory: mem },
      main.id,
      (ns) => ({ ...ns, step: 'Success' })
    );
    return { ...successState, mode: mapStateToMode(successState, main) };
  }

    if (isNo(input)) {
    // Not confirmed → go to NotConfirmed
    const nodeState = getNodeState(state, main.id);
    const nextCounter = Math.min(3, nodeState.counters.notConfirmed + 1);
    const notConfirmedState = setNodeState(
      state,
      main.id,
      (ns) => ({
        ...ns,
        step: 'NotConfirmed',
        counters: { ...ns.counters, notConfirmed: nextCounter }
      })
    );
    return { ...notConfirmedState, mode: mapStateToMode(notConfirmedState, main) };
  }

  // Check for partial confirmation
  const partial = extractPartialConfirmation(input);
  if (partial.isPartial && partial.correctedParts) {
    // Apply corrections
    let mem = state.memory;
    for (const [subId, value] of Object.entries(partial.correctedParts)) {
      mem = setMemory(mem, subId, value, false);
    }
    // Recompose main
    if (Array.isArray(main.subs) && main.subs.length > 0) {
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
    // Find corrected sub and go back to collecting it
    const correctedSubId = Object.keys(partial.correctedParts)[0];
    if (correctedSubId && main.subs?.includes(correctedSubId)) {
      const startState = setNodeState(
        { ...state, memory: mem, currentSubId: correctedSubId },
        main.id,
        (ns) => ({ ...ns, step: 'Start' })
      );
      return { ...startState, mode: mapStateToMode(startState, main) };
    } else {
      const startState = setNodeState(
        { ...state, memory: mem },
        main.id,
        (ns) => ({ ...ns, step: 'Start' })
      );
      return { ...startState, mode: mapStateToMode(startState, main) };
    }
  }

  // Unknown input in confirmation → stay in Confirmation
  return { ...state, mode: mapStateToMode(state, main) };
}

// ============================================================================
// Handle NotConfirmed
// ============================================================================

function handleNotConfirmed(
  state: SimulatorState,
  main: DDTNode,
  sub: DDTNode | undefined,
  input: string,
  extractedVariables?: Record<string, any>
): SimulatorState {
  // Try to extract correction
  const mainKind = String(main.kind || '').toLowerCase();
  const labelStr = String((main as any)?.label || '').toLowerCase();
  let primaryKind = mainKind;
  if (!primaryKind || primaryKind === 'generic') {
    if (/phone|telefono|cellulare/.test(labelStr)) primaryKind = 'phone';
    else if (/email|e-?mail/.test(labelStr)) primaryKind = 'email';
    else if (/date\s*of\s*birth|data\s*di\s*nascita|dob|birth/.test(labelStr)) primaryKind = 'date';
    else if (/full\s*name|name|nome/.test(labelStr)) primaryKind = 'name';
  }

  let mem = state.memory;
  let hasMatch = false;

  if (extractedVariables && typeof extractedVariables === 'object' && Object.keys(extractedVariables).length > 0) {
    // Use extracted variables
    if (Array.isArray(main.subs) && main.subs.length > 0) {
      for (const sid of main.subs) {
        const subNode = state.plan.byId[sid];
        if (!subNode) continue;
        const labelNorm = (subNode?.label || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
        let v: any = undefined;
        if (main.kind === 'name') {
          if (labelNorm.includes('first')) v = extractedVariables.firstname;
          else if (labelNorm.includes('last')) v = extractedVariables.lastname;
        } else if (main.kind === 'date') {
          if (labelNorm.includes('day') || labelNorm.includes('giorno')) v = extractedVariables.day;
          else if (labelNorm.includes('month') || labelNorm.includes('mese')) v = extractedVariables.month;
          else if (labelNorm.includes('year') || labelNorm.includes('anno')) v = extractedVariables.year;
        }
        if (v !== undefined && v !== null) {
          mem = setMemory(mem, sid, v, false);
          hasMatch = true;
        }
      }
    } else {
      const value = extractedVariables.value ?? extractedVariables;
      if (value !== undefined && value !== null) {
        mem = setMemory(mem, main.id, value, false);
        hasMatch = true;
      }
    }
  } else {
    // Try extraction
    const extracted = extractOrdered(state, input, primaryKind);
    if (extracted.memory !== state.memory) {
      mem = extracted.memory;
    }
    // hasMatch is now tracked inside extractOrdered
  }

  if (hasMatch) {
    // Correction provided → go back to Normal
    // Recompose main if needed
    if (Array.isArray(main.subs) && main.subs.length > 0) {
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

    // Find which sub was corrected (if any)
    const missing = nextMissingRequired(main, state.plan.byId, mem);
    if (missing) {
      const startState = setNodeState(
        { ...state, memory: mem, currentSubId: missing },
        main.id,
        (ns) => ({ ...ns, step: 'Start' })
      );
      return { ...startState, mode: mapStateToMode(startState, main) };
    } else {
      const startState = setNodeState(
        { ...state, memory: mem },
        main.id,
        (ns) => ({ ...ns, step: 'Start' })
      );
      return { ...startState, mode: mapStateToMode(startState, main) };
    }
  }

  // No match → increment counter and stay in NotConfirmed
  const nodeState = getNodeState(state, main.id);
  const nextCounter = Math.min(3, nodeState.counters.notConfirmed + 1);
  const notConfirmedState = setNodeState(
    state,
    main.id,
    (ns) => ({
      ...ns,
      counters: { ...ns.counters, notConfirmed: nextCounter }
    })
  );
  return { ...notConfirmedState, mode: mapStateToMode(notConfirmedState, main) };
}
