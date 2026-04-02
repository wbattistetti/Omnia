/**
 * Italian user-facing names for dialogue step keys (keep in sync with
 * `stepMeta` in Response Editor `ddtUtils.tsx`).
 */

/** Keys normalized with toLowerCase() for lookup (aligned with ddtUtils stepMeta labels). */
const STEP_KEY_LABELS: Record<string, string> = {
  start: 'Chiedo il dato',
  introduction: 'Introduzione',
  nomatch: 'Non capisco',
  noinput: 'Non sento',
  confirmation: 'Devo confermare',
  notconfirmed: 'Non Confermato',
  invalid: 'Non valido',
  success: 'Ho capito!',
};

/**
 * Returns a short label for a dialogue step key, or a fallback when unknown.
 */
export function getDialogueStepUserLabel(stepKey: string | undefined): string {
  const k = (stepKey ?? '').trim().toLowerCase();
  if (!k) return 'questo passo';
  return STEP_KEY_LABELS[k] ?? (stepKey?.trim() || 'questo passo');
}

/**
 * Italian ordinal for escalation slot index (0 → primo, 1 → secondo, …).
 */
export function ordinalItalianEscalation(zeroBasedIndex: number | undefined): string {
  const i =
    zeroBasedIndex === undefined || !Number.isFinite(zeroBasedIndex)
      ? 0
      : Math.max(0, Math.floor(zeroBasedIndex));
  const words = [
    'primo',
    'secondo',
    'terzo',
    'quarto',
    'quinto',
    'sesto',
    'settimo',
    'ottavo',
    'nono',
    'decimo',
  ];
  if (i < words.length) return words[i];
  return `${i + 1}°`;
}
