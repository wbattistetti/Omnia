/**
 * Macro / micro rule grouping for KB review UI and chat summaries.
 */

import { isKbRuleStatusClosed } from './kbRuleStatus';
import type { KbInducedRule, KbRuleStatus } from './kbRuleTypes';

function isReviewClosed(status: KbRuleStatus): boolean {
  return isKbRuleStatusClosed(status);
}

export type KbRuleKind = 'macro' | 'micro' | 'atomic';

export type KbRuleTreeNode = {
  rule: KbInducedRule;
  children: readonly KbInducedRule[];
};

export type KbRuleReviewVisualState = 'open' | 'in_review' | 'closed';

export function isKbMacroRule(rule: KbInducedRule): boolean {
  return rule.ruleKind === 'macro';
}

export function isKbMicroRule(rule: KbInducedRule): boolean {
  return rule.ruleKind === 'micro';
}

/** Normalize parent links and ruleKind after LLM or legacy payloads. */
export function linkKbRuleHierarchy(rules: readonly KbInducedRule[]): KbInducedRule[] {
  const byId = new Map(rules.map((r) => [r.id, r]));
  return rules.map((r) => {
    let ruleKind = r.ruleKind ?? 'atomic';
    let parentRuleId = r.parentRuleId?.trim() || null;

    if (parentRuleId && !byId.has(parentRuleId)) {
      parentRuleId = null;
      ruleKind = 'atomic';
    }
    if (ruleKind === 'macro') {
      parentRuleId = null;
    }
    if (parentRuleId && ruleKind !== 'macro') {
      ruleKind = 'micro';
    }
    if (!parentRuleId && ruleKind === 'micro') {
      ruleKind = 'atomic';
    }
    return { ...r, ruleKind, parentRuleId };
  });
}

export function buildKbRuleForest(rules: readonly KbInducedRule[]): KbRuleTreeNode[] {
  const linked = linkKbRuleHierarchy(rules.filter((r) => !r.deleted));
  const macros = linked.filter((r) => r.ruleKind === 'macro');
  const micros = linked.filter((r) => r.ruleKind === 'micro');
  const atomics = linked.filter((r) => r.ruleKind === 'atomic');

  const childrenByParent = new Map<string, KbInducedRule[]>();
  for (const m of micros) {
    const pid = m.parentRuleId;
    if (!pid) continue;
    const list = childrenByParent.get(pid) ?? [];
    list.push(m);
    childrenByParent.set(pid, list);
  }

  const forest: KbRuleTreeNode[] = [];

  for (const macro of macros) {
    forest.push({
      rule: macro,
      children: childrenByParent.get(macro.id) ?? [],
    });
    childrenByParent.delete(macro.id);
  }

  for (const [pid, children] of childrenByParent) {
    const parent = linked.find((r) => r.id === pid);
    if (parent) {
      forest.push({ rule: parent, children });
    } else {
      for (const c of children) forest.push({ rule: c, children: [] });
    }
  }

  for (const a of atomics) {
    forest.push({ rule: a, children: [] });
  }

  return forest;
}

export function countKbHierarchyStats(rules: readonly KbInducedRule[]): {
  macroCount: number;
  microCount: number;
  atomicCount: number;
} {
  const visible = rules.filter((r) => !r.deleted);
  return {
    macroCount: visible.filter((r) => r.ruleKind === 'macro').length,
    microCount: visible.filter((r) => r.ruleKind === 'micro').length,
    atomicCount: visible.filter((r) => r.ruleKind === 'atomic').length,
  };
}

/** Italian summary for chat after analyze / reanalyze. */
export function kbHierarchyAnalysisSummary(rules: readonly KbInducedRule[]): string {
  const visible = rules.filter((r) => !r.deleted && r.status !== 'invalid');
  if (visible.length === 0) {
    return 'Analisi completata. Non ho trovato regole utili per il task — vuoi indicare cosa cercare?';
  }

  const { macroCount, microCount, atomicCount } = countKbHierarchyStats(visible);
  const exampleMicros = visible
    .filter((r) => r.ruleKind === 'micro')
    .slice(0, 3)
    .map((r) => r.title || r.field)
    .filter(Boolean);

  if (macroCount > 0 && microCount > 0) {
    const examples =
      exampleMicros.length > 0
        ? ` Esempi: ${exampleMicros.join(', ')}${microCount > exampleMicros.length ? ` (+${microCount - exampleMicros.length})` : ''}.`
        : '';
    return (
      `Ho trovato ${microCount} regole specifiche che possono essere sussunte in ${macroCount} macro-regola/e.` +
      ` Apri le macro-regole nell'elenco per rivedere gli esempi.${examples} ` +
      `Partiamo dalla prima in sospeso?`
    );
  }

  const titles = visible
    .slice(0, 4)
    .map((r) => r.title || r.field)
    .filter(Boolean)
    .join(', ');
  const more = visible.length > 4 ? ` (+${visible.length - 4})` : '';
  return `Ho trovato ${visible.length} regola/e${titles ? `: ${titles}${more}` : ''}. Usa gli accordion sopra per confermare o rigettare.`;
}

export function getKbRuleReviewVisualState(
  rule: KbInducedRule,
  currentRuleId: string | null
): KbRuleReviewVisualState {
  if (rule.id === currentRuleId) return 'in_review';
  if (isReviewClosed(rule.status)) return 'closed';
  return 'open';
}

/** Prefer reviewing micro rules, then atomics, then macros. */
export function pickNextReviewRuleIdHierarchical(
  rules: readonly KbInducedRule[],
  currentRuleId: string | null | undefined
): string | null {
  const visible = rules.filter((r) => !r.deleted);
  const open = visible.filter((r) => !isReviewClosed(r.status));
  if (open.length === 0) return null;
  if (currentRuleId && open.some((r) => r.id === currentRuleId)) {
    return currentRuleId;
  }

  const tier = (r: KbInducedRule) => {
    if (r.ruleKind === 'micro') return 0;
    if (r.ruleKind === 'atomic') return 1;
    if (r.ruleKind === 'macro') return 2;
    return 1;
  };
  const statusPri = (s: KbRuleStatus) => {
    if (s === 'hypothesized') return 0;
    if (s === 'corrected') return 1;
    if (s === 'reworked') return 2;
    return 3;
  };

  open.sort((a, b) => {
    const t = tier(a) - tier(b);
    if (t !== 0) return t;
    return statusPri(a.status) - statusPri(b.status);
  });
  return open[0]!.id;
}

export function formatMacroReviewPrompt(macro: KbInducedRule, childCount: number): string {
  const title = macro.title || macro.field || 'Macro-regola';
  return (
    `Ho raggruppato ${childCount} regole specifiche sotto la macro-regola **${title}**. ` +
    `Apri l'accordion e rivedi gli esempi uno per uno. La macro descrive il pattern generale; gli esempi sono le specialità nel documento.`
  );
}
