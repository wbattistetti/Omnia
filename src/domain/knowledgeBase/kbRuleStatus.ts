/**
 * KB rule review states (designer + IA lifecycle) with cycle order and legacy mapping.
 */

export type KbRuleStatus =
  | 'hypothesized'
  | 'validated'
  | 'corrected'
  | 'reworked'
  | 'invalid';

/** Designer cycle order (click on status control). */
export const KB_RULE_STATUS_CYCLE: readonly KbRuleStatus[] = [
  'hypothesized',
  'validated',
  'corrected',
  'reworked',
  'invalid',
];

export const KB_RULE_STATUS_LABEL: Record<KbRuleStatus, string> = {
  hypothesized: 'Ipotizzata (IA)',
  validated: 'Validata',
  corrected: 'Corretta',
  reworked: 'Rielaborata (IA)*',
  invalid: 'Non valida',
};

export function cycleKbRuleStatus(current: KbRuleStatus): KbRuleStatus {
  const i = KB_RULE_STATUS_CYCLE.indexOf(current);
  const next = i < 0 ? 0 : (i + 1) % KB_RULE_STATUS_CYCLE.length;
  return KB_RULE_STATUS_CYCLE[next]!;
}

export function isKbRuleStatusClosed(status: KbRuleStatus): boolean {
  return status === 'validated' || status === 'invalid';
}

export function isKbRuleStatusPromotable(status: KbRuleStatus): boolean {
  return status === 'validated' || status === 'reworked';
}

export function ruleIncludedDefaultForStatus(status: KbRuleStatus): boolean {
  return status !== 'invalid';
}

/** Map persisted / LLM legacy status strings. */
export function normalizeKbRuleStatusValue(raw: unknown, included: boolean): KbRuleStatus {
  const s = String(raw ?? '').trim().toLowerCase();
  switch (s) {
    case 'hypothesized':
    case 'hypothesis':
      return 'hypothesized';
    case 'validated':
    case 'confirmed':
      return 'validated';
    case 'corrected':
      return 'corrected';
    case 'reworked':
      return 'reworked';
    case 'invalid':
    case 'rejected':
    case 'skipped':
      return 'invalid';
    case 'deferred':
      return 'hypothesized';
    default:
      return included === false ? 'invalid' : 'hypothesized';
  }
}
