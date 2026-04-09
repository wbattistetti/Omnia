/**
 * Pure helpers for GrammarFlow <-> DataContract (grammarflow engine slice).
 * Keeps fingerprinting and merge logic out of React components.
 * G2: grammar slot identity is separate from flow variables; use slotBindings for resolution.
 */

import type { DataContract } from '@components/DialogueDataEngine/contracts/contractLoader';
import type { Grammar } from '@components/GrammarEditor/types/grammarTypes';

export function getGrammarFlowFromContract(c: DataContract | null | undefined): Grammar | null {
  if (!c?.engines?.length) return null;
  const grammarFlowEngine = c.engines.find((e: { type?: string }) => e.type === 'grammarflow');
  const grammarData = grammarFlowEngine?.grammarFlow ?? (grammarFlowEngine as { GrammarFlow?: Grammar })?.GrammarFlow;
  return grammarData ? (grammarData as Grammar) : null;
}

export function getTestPhrasesFromContract(c: DataContract | null | undefined): string[] {
  const tp = c?.testPhrases;
  return Array.isArray(tp) ? tp : [];
}

/** G2: grammarSlot.id → flowVariable.id via slotBindings. */
export function getFlowVariableIdForGrammarSlot(
  grammar: Grammar | null | undefined,
  grammarSlotId: string
): string | undefined {
  const g = String(grammarSlotId || '').trim();
  if (!g || !grammar?.slotBindings?.length) return undefined;
  const row = grammar.slotBindings.find(
    (b) => String(b?.grammarSlotId || '').trim().toLowerCase() === g.toLowerCase()
  );
  const fv = row ? String(row.flowVariableId || '').trim() : '';
  return fv || undefined;
}

/** G2: inverse mapping for extraction (flowVariableId → grammarSlotId). */
export function getGrammarSlotIdForFlowVariable(
  grammar: Grammar | null | undefined,
  flowVariableId: string
): string | undefined {
  const f = String(flowVariableId || '').trim();
  if (!f || !grammar?.slotBindings?.length) return undefined;
  const row = grammar.slotBindings.find(
    (b) => String(b?.flowVariableId || '').trim().toLowerCase() === f.toLowerCase()
  );
  const sid = row ? String(row.grammarSlotId || '').trim() : '';
  return sid || undefined;
}

/**
 * Fingerprint grammar graph only (no testPhrases).
 * Omits grammar `id` so two empty graphs with different UUIDs do not thrash sync.
 */
export function fingerprintGrammarFromContract(c: DataContract | null | undefined): string {
  if (!c) return 'null';
  const g = getGrammarFlowFromContract(c);
  if (!g) return 'null-g';
  const { id: _omitId, ...rest } = g;
  try {
    return JSON.stringify(rest);
  } catch {
    return 'fallback';
  }
}

export function fingerprintTestPhrasesFromContract(c: DataContract | null | undefined): string {
  try {
    return JSON.stringify(c?.testPhrases ?? []);
  } catch {
    return '[]';
  }
}

/**
 * Returns a new DataContract with grammarflow engine and optional testPhrases applied.
 */
export function mergeGrammarFlowIntoContract(
  base: DataContract | null | undefined,
  grammar: Grammar,
  testPhrases: string[]
): DataContract {
  const next: DataContract =
    base && typeof base === 'object'
      ? { ...base, engines: [...(base.engines || [])] }
      : {
          subDataMapping: {},
          engines: [],
          outputCanonical: { format: 'value' },
        };

  const engines = next.engines || [];
  const grammarFlowEngine = engines.find((e: { type?: string }) => e.type === 'grammarflow');

  if (grammarFlowEngine) {
    (grammarFlowEngine as { grammarFlow?: Grammar }).grammarFlow = grammar;
  } else {
    engines.push({
      type: 'grammarflow',
      enabled: true,
      grammarFlow: grammar,
    });
    next.engines = engines;
  }

  next.testPhrases = testPhrases.length > 0 ? testPhrases : undefined;
  return next;
}
