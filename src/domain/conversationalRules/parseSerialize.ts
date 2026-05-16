/**
 * Parse and serialize conversational rules persisted on Task (`agentConversationalRulesJson`).
 */

import { DEFAULT_CONVERSATIONAL_RULES_LIBRARY } from './defaultConversationalRulesLibrary';
import type { ConversationalRule } from './types';

function newRuleId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `cr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Materialize a full task catalog from the shared library (snapshot for new / empty tasks). */
export function materializeConversationalRulesFromLibrary(): ConversationalRule[] {
  return DEFAULT_CONVERSATIONAL_RULES_LIBRARY.map((entry) => ({
    id: newRuleId(),
    libraryRuleId: entry.id,
    label: entry.label,
    scenario: entry.scenario,
    exampleMessage: entry.exampleMessage,
    sort_order: entry.sort_order,
    enabled: true,
  }));
}

function parseRuleElement(e: unknown): ConversationalRule | null {
  if (!e || typeof e !== 'object') return null;
  const o = e as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id.trim() : '';
  if (!id) return null;
  const label = typeof o.label === 'string' ? o.label : 'Regola';
  const scenario = typeof o.scenario === 'string' ? o.scenario : '';
  const exampleMessage =
    typeof o.exampleMessage === 'string'
      ? o.exampleMessage
      : typeof o.example_message === 'string'
        ? o.example_message
        : '';
  const libraryRuleId =
    o.libraryRuleId === null || o.libraryRuleId === undefined
      ? null
      : typeof o.libraryRuleId === 'string' && o.libraryRuleId.trim()
        ? o.libraryRuleId.trim()
        : null;
  const sort_order =
    typeof o.sort_order === 'number' && Number.isFinite(o.sort_order) ? o.sort_order : 0;
  const enabled = o.enabled === false ? false : true;
  return {
    id,
    libraryRuleId,
    label,
    scenario,
    exampleMessage,
    sort_order,
    enabled,
  };
}

/** Parse task JSON; empty/invalid → materialize from library. */
export function parseAgentConversationalRulesJson(raw: string | undefined): ConversationalRule[] {
  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    return materializeConversationalRulesFromLibrary();
  }
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v) || v.length === 0) {
      return materializeConversationalRulesFromLibrary();
    }
    const out: ConversationalRule[] = [];
    for (const e of v) {
      const rule = parseRuleElement(e);
      if (rule) out.push(rule);
    }
    return out.length > 0 ? out : materializeConversationalRulesFromLibrary();
  } catch {
    return materializeConversationalRulesFromLibrary();
  }
}

export function serializeConversationalRules(rules: readonly ConversationalRule[]): string {
  return JSON.stringify(
    rules.map((r) => ({
      id: r.id,
      libraryRuleId: r.libraryRuleId,
      label: r.label,
      scenario: r.scenario,
      exampleMessage: r.exampleMessage,
      sort_order: r.sort_order,
      ...(r.enabled === false ? { enabled: false } : {}),
    }))
  );
}

/** Create a task-only rule from a label (batch textarea). */
export function createConversationalRuleFromLabel(label: string, sort_order: number): ConversationalRule {
  return {
    id: newRuleId(),
    libraryRuleId: null,
    label: label.trim(),
    scenario: '',
    exampleMessage: '',
    sort_order,
    enabled: true,
  };
}
