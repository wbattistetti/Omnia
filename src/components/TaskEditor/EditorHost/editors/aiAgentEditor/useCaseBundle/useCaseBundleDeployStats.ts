/**
 * Statistiche deploy per riga use case (chip nella lista composer).
 */

import { ensureUseCasePhrases } from '@domain/useCaseBundle/migrateUseCase';
import type { ProjectSlotLexicon } from '@domain/useCaseBundle/projectSlotLexicon';
import { projectUseCaseToConversationalJson } from '@domain/useCaseGeneratorWizard/useCaseJsonProjection';
import {
  isUseCaseIncludedInConversations,
  type AIAgentUseCase,
} from '@types/aiAgentUseCases';

export interface UseCaseDeployRowStats {
  useCaseId: string;
  label: string;
  included: boolean;
  projectable: boolean;
  deployVariantCount: number;
  structuralReady: number;
  structuralDraft: number;
  staleVariantCount: number;
  needsCompile: boolean;
}

function variantNeedsCompile(
  variant: { compiled?: { tokenizedText?: string; status?: string } }
): boolean {
  const text = variant.compiled?.tokenizedText?.trim();
  return !text || variant.compiled?.status === 'stale';
}

export function getUseCaseDeployRowStats(
  uc: AIAgentUseCase,
  lexicon: ProjectSlotLexicon
): UseCaseDeployRowStats {
  const included = isUseCaseIncludedInConversations(uc);
  const withPhrases = ensureUseCasePhrases(uc);
  const phrase = withPhrases.phrases?.[0];
  const variants = phrase?.variants ?? [];

  let structuralDraft = 0;
  let structuralReady = 0;
  let staleVariantCount = 0;
  let needsCompile = false;

  for (const v of variants) {
    if (v.compiled?.status === 'stale') staleVariantCount += 1;
    if (variantNeedsCompile(v)) needsCompile = true;
    if (v.variantId === 'default') continue;
    const hasOwn =
      typeof v.naturalText === 'string' && v.naturalText.trim().length > 0;
    if (hasOwn) structuralReady += 1;
    else structuralDraft += 1;
  }

  const projected = projectUseCaseToConversationalJson(withPhrases, { lexicon });
  const deployVariantCount = projected?.variants.length ?? 0;

  return {
    useCaseId: uc.id,
    label: uc.label ?? '',
    included,
    projectable: deployVariantCount > 0,
    deployVariantCount,
    structuralReady,
    structuralDraft,
    staleVariantCount,
    needsCompile,
  };
}
