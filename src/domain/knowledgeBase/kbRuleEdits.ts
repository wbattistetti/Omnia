/**
 * Detect meaningful edits to KB induced rules (for chat nudge / reanalyze).
 */

import type { KbInducedRule } from './kbRuleTypes';

const FIELDS: (keyof KbInducedRule)[] = [
  'title',
  'field',
  'rule',
  'trigger',
  'action',
  'fallback',
  'note',
];

export function kbRulesContentSignature(rules: readonly KbInducedRule[]): string {
  return rules
    .filter((r) => !r.deleted)
    .map((r) =>
      [r.id, ...FIELDS.map((f) => String(r[f] ?? '').trim())].join('\u001f')
    )
    .join('\u001e');
}

export function kbRulesWereEdited(
  before: readonly KbInducedRule[],
  after: readonly KbInducedRule[]
): boolean {
  return kbRulesContentSignature(before) !== kbRulesContentSignature(after);
}
