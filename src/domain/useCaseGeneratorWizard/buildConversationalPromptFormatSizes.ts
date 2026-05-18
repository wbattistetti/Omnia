/**
 * Pre-calcolo dimensioni prompt per tutti i formati catalogo (confronto nel menu Deploy).
 */

import {
  CONVERSATIONAL_CATALOG_FORMAT_OPTIONS,
  type ConversationalCatalogFormat,
} from './catalogFormat';
import {
  buildConversationalPrompt,
  type BuildConversationalPromptOptions,
} from './buildConversationalPrompt';
import { serializeConversationalCatalog } from './serializeConversationalCatalog';
import {
  areAllUseCasesProjectable,
  projectAllUseCasesToConversationalJson,
} from './useCaseJsonProjection';
import { measurePromptText, type PromptTextMetrics } from './promptTextMetrics';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';

export interface ConversationalPromptFormatSizeEntry {
  readonly total: PromptTextMetrics;
  /** Solo blocco catalogo (dove i formati differiscono davvero). */
  readonly catalog: PromptTextMetrics;
  /**
   * Risparmio token stimato sul catalogo rispetto a `json-pretty` (positivo = più piccolo).
   * Es. 35 → il catalogo pesa ~35% token in meno del JSON completo.
   */
  readonly catalogTokenSavingsPercentVsPretty: number;
}

export type ConversationalPromptFormatSizes = Readonly<
  Record<ConversationalCatalogFormat, ConversationalPromptFormatSizeEntry>
>;

function savingsPercentVsBaseline(
  baselineTokens: number,
  candidateTokens: number
): number {
  if (baselineTokens <= 0) return 0;
  return Math.round((1 - candidateTokens / baselineTokens) * 100);
}

/**
 * Compila metriche totali + catalogo per ogni formato.
 * Pre-condizione: stessa di {@link buildConversationalPrompt}.
 */
export function buildConversationalPromptFormatSizes(
  useCases: readonly AIAgentUseCase[],
  options: Omit<BuildConversationalPromptOptions, 'catalogFormat'> = {}
): ConversationalPromptFormatSizes {
  if (!areAllUseCasesProjectable(useCases)) {
    throw new Error('buildConversationalPromptFormatSizes: use case non proiettabili.');
  }
  const includeLog = options.includeLog === true;
  const projected = projectAllUseCasesToConversationalJson(useCases, { includeLog });

  const catalogByFormat = {} as Record<ConversationalCatalogFormat, string>;
  for (const { id } of CONVERSATIONAL_CATALOG_FORMAT_OPTIONS) {
    catalogByFormat[id] = serializeConversationalCatalog(projected, id);
  }

  const prettyCatalogTokens = measurePromptText(catalogByFormat['json-pretty']).estimatedTokens;

  const out = {} as Record<ConversationalCatalogFormat, ConversationalPromptFormatSizeEntry>;
  for (const { id } of CONVERSATIONAL_CATALOG_FORMAT_OPTIONS) {
    const totalText = buildConversationalPrompt(useCases, { ...options, catalogFormat: id });
    const catalogText = catalogByFormat[id];
    out[id] = {
      total: measurePromptText(totalText),
      catalog: measurePromptText(catalogText),
      catalogTokenSavingsPercentVsPretty: savingsPercentVsBaseline(
        prettyCatalogTokens,
        measurePromptText(catalogText).estimatedTokens
      ),
    };
  }
  return out;
}
