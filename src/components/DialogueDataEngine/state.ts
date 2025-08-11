import type { DDTNode, Kind } from './model/ddt.v2.types';

export type MemoryEntry = { value: any; confirmed: boolean };
export type Memory = Record<string, MemoryEntry>;

export interface Plan {
  order: string[];
  byId: Record<string, DDTNode>;
}

export function buildPlan(nodes: DDTNode[]): Plan {
  const byId: Record<string, DDTNode> = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const order: string[] = [];
  const mains = nodes.filter((n) => n.type === 'main');
  for (const main of mains) {
    order.push(main.id);
    const subs = (main.subs || []).filter((sid) => byId[sid]);
    order.push(...subs);
  }
  return { order, byId };
}

export function isSaturated(node: DDTNode, memory: Memory): boolean {
  const entry = memory[node.id];
  if (node.kind === 'date') {
    const v = entry?.value || {};
    return Boolean(v.day && v.month && v.year);
  }
  return Boolean(entry && entry.value !== undefined && entry.value !== null && String(entry.value).length > 0);
}

export function nextMissingSub(mainNode: DDTNode, memory: Memory): string | undefined {
  const subs = mainNode.subs || [];
  for (const sid of subs) {
    const m = memory[sid];
    if (!m || m.value === undefined || m.value === null || String(m.value).length === 0) return sid;
  }
  return undefined;
}

export interface CompositeApplyResult {
  variables: Record<string, any>;
  complete: boolean;
  missing: string[];
}

export function applyComposite(kind: Kind, input: string): CompositeApplyResult {
  if (kind === 'date') {
    const text = String(input || '').trim();
    if (!text) return { variables: {}, complete: false, missing: ['day', 'month', 'year'] };
    const m = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (m) {
      const day = Number(m[1]);
      const month = Number(m[2]);
      const year = Number(m[3]);
      return { variables: { day, month, year }, complete: true, missing: [] };
    }
    const yearMatch = text.match(/\b(\d{4})\b/);
    const monthMatch = text.match(/\b(0?[1-9]|1[0-2])\b/);
    const dayMatch = text.match(/\b(0?[1-9]|[12][0-9]|3[01])\b/);
    const vars: Record<string, any> = {};
    const missing: string[] = [];
    if (dayMatch) vars.day = Number(dayMatch[0]); else missing.push('day');
    if (monthMatch) vars.month = Number(monthMatch[0]); else missing.push('month');
    if (yearMatch) vars.year = Number(yearMatch[0]); else missing.push('year');
    return { variables: vars, complete: missing.length === 0, missing };
  }
  return { variables: { value: input }, complete: Boolean(input && String(input).trim().length > 0), missing: [] };
}

export function getMemory(memory: Memory, slotId: string): MemoryEntry | undefined {
  return memory[slotId];
}

export function setMemory(memory: Memory, slotId: string, value: any, confirmed = false): Memory {
  return { ...memory, [slotId]: { value, confirmed } };
}


