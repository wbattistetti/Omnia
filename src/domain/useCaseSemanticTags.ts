/**
 * Closed vocabulary for assistant-turn semantic tags (design-time use cases).
 */
export const USE_CASE_TAG_ENUM_VALUES = [
  'proposta',
  'rifiuto',
  'alternativa',
  'chiarimento',
  'conferma',
] as const;

export type UseCaseTagEnum = (typeof USE_CASE_TAG_ENUM_VALUES)[number];

/** Short Italian labels for UI payoffs. */
export const USE_CASE_TAG_ENUM_LABELS: Record<UseCaseTagEnum, string> = {
  proposta: 'Proposta',
  rifiuto: 'Rifiuto',
  alternativa: 'Alternativa',
  chiarimento: 'Chiarimento',
  conferma: 'Conferma',
};

/**
 * Maps free-form or synonym strings to the canonical enum; defaults to chiarimento.
 */
export function coerceUseCaseTagEnum(raw: unknown): UseCaseTagEnum {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if ((USE_CASE_TAG_ENUM_VALUES as readonly string[]).includes(s)) {
    return s as UseCaseTagEnum;
  }
  const compact = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
  const synonymHits: Array<{ keys: string[]; tag: UseCaseTagEnum }> = [
    { keys: ['proposta', 'offerta', 'suggerisco', 'propongo'], tag: 'proposta' },
    { keys: ['rifiuto', 'negazione', 'non posso', 'non e possibile'], tag: 'rifiuto' },
    { keys: ['alternativa', 'altra data', 'proposta alternativa', 'dopo rifiuto'], tag: 'alternativa' },
    { keys: ['chiarimento', 'chiarire', 'ambiguo', 'capire'], tag: 'chiarimento' },
    { keys: ['conferma', 'confermo', 'va bene', 'accetto'], tag: 'conferma' },
  ];
  for (const { keys, tag } of synonymHits) {
    if (keys.some((k) => compact.includes(k))) return tag;
  }
  return 'chiarimento';
}

/**
 * Builds a deterministic fragment for conversational style / scenario context (system prompt section).
 */
export function buildUseCaseMicroScenarioStyleLines(params: {
  useCaseLabel: string;
  styleId: string;
  payoff?: string;
}): string[] {
  const lines: string[] = [
    `Use case: ${params.useCaseLabel}`,
    `Stile conversazionale globale (style_id): ${params.styleId}`,
  ];
  const p = typeof params.payoff === 'string' ? params.payoff.trim() : '';
  if (p) lines.push(`Contesto scenario (payoff): ${p}`);
  return lines;
}
