/**
 * Serializzazione del catalogo use case proiettato nel prompt conversazionale.
 * Pure function: stessa semantica per ogni formato, diverso solo il testo esposto all'LLM.
 */

import type { ConversationalCatalogFormat } from './catalogFormat';
import type {
  UseCaseConversationalJson,
  UseCaseConversationalVariantJson,
} from './useCaseJsonProjection';

/** Payload runtime senza id wizard (useCaseId, label, variantId, tokens ridondanti). */
interface SlimUseCaseExport {
  readonly scenario: string;
  readonly variants: ReadonlyArray<{ readonly tokenizedExample: string; readonly when?: string }>;
  readonly template?: string;
  readonly tokens_stile?: Record<string, readonly string[]>;
  readonly style_rule?: { readonly llm: string };
  readonly log?: string;
}

function slimUseCase(uc: UseCaseConversationalJson): SlimUseCaseExport {
  const variants = uc.variants.map((v) => {
    const row: { tokenizedExample: string; when?: string } = {
      tokenizedExample: v.tokenizedExample,
    };
    if (v.when?.trim()) row.when = v.when.trim();
    return row;
  });
  return {
    scenario: uc.scenario.trim(),
    variants,
    ...(uc.template ? { template: uc.template } : {}),
    ...(uc.tokens_stile ? { tokens_stile: uc.tokens_stile } : {}),
    ...(uc.style_rule ? { style_rule: uc.style_rule } : {}),
    ...(uc.log?.trim() ? { log: uc.log.trim() } : {}),
  };
}

/** Oggetto JSON minimo (chiavi corte, niente lista tokens). */
function buildMinimalUseCaseJson(uc: UseCaseConversationalJson): Record<string, unknown> {
  const s = uc.scenario.trim();
  if (uc.variants.length === 1 && !uc.variants[0].when?.trim()) {
    const only = uc.variants[0];
    return {
      s,
      t: only.tokenizedExample,
      ...(uc.tokens_stile ? { ts: uc.tokens_stile } : {}),
      ...(uc.log ? { l: uc.log } : {}),
    };
  }
  return {
    s,
    v: uc.variants.map((variant) => ({
      t: variant.tokenizedExample,
      ...(variant.when?.trim() ? { w: variant.when.trim() } : {}),
    })),
    ...(uc.tokens_stile ? { ts: uc.tokens_stile } : {}),
    ...(uc.log ? { l: uc.log } : {}),
  };
}

function serializeVariantDslStandard(variant: UseCaseConversationalVariantJson): string {
  const lines: string[] = [];
  if (variant.when?.trim()) {
    lines.push(`? ${variant.when.trim()}`);
  }
  lines.push(`> ${variant.tokenizedExample}`);
  return lines.join('\n');
}

function serializeUseCaseDslStandard(uc: UseCaseConversationalJson, index: number): string {
  const num = uc.catalogNumber ?? index + 1;
  const lines = [`[${num}] ${uc.scenario.trim()}`];
  if (uc.tokens_stile && Object.keys(uc.tokens_stile).length > 0) {
    for (const [id, variants] of Object.entries(uc.tokens_stile)) {
      lines.push(`@ ${id}: ${variants.join('|')}`);
    }
  }
  for (const variant of uc.variants) {
    lines.push(serializeVariantDslStandard(variant));
  }
  if (uc.log?.trim()) {
    lines.push(`# ${uc.log.trim()}`);
  }
  return lines.join('\n');
}

/** Scenario LLM una sola volta per UC; varianti successive solo template (niente paragrafo duplicato). */
function serializeUseCaseDslUltra(uc: UseCaseConversationalJson, ucIndex: number): string {
  return uc.variants
    .map((variant, vi) => {
      const whenPart = variant.when?.trim() ? ` ?${variant.when.trim()}` : '';
      if (vi === 0) {
        return `[${ucIndex + 1}] ${uc.scenario.trim()}${whenPart} >${variant.tokenizedExample}`;
      }
      return `  ${whenPart ? `${whenPart.trim()} ` : ''}>${variant.tokenizedExample}`;
    })
    .join('\n');
}

/**
 * Serializza l'intero catalogo proiettato nel formato richiesto.
 */
export function serializeConversationalCatalog(
  projected: readonly UseCaseConversationalJson[],
  format: ConversationalCatalogFormat
): string {
  if (projected.length === 0) return '';

  switch (format) {
    case 'json-pretty':
      return projected
        .map(
          (uc, index) => `### Use case ${index + 1}\n${JSON.stringify(uc, null, 2)}`
        )
        .join('\n\n');
    case 'json-compact':
      return projected
        .map((uc, index) => `### Use case ${index + 1}\n${JSON.stringify(slimUseCase(uc))}`)
        .join('\n\n');
    case 'json-minimal':
      return projected.map((uc) => JSON.stringify(buildMinimalUseCaseJson(uc))).join('\n');
    case 'dsl-standard':
      return projected.map((uc, i) => serializeUseCaseDslStandard(uc, i)).join('\n\n');
    case 'dsl-ultra':
      return projected.map((uc, i) => serializeUseCaseDslUltra(uc, i)).join('\n\n');
    default: {
      const _exhaustive: never = format;
      return _exhaustive;
    }
  }
}
