/**
 * Token compilati (`giorno_1`, `ora_2`, …) presenti nel catalogo use case — input compile IA.
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { ensureUseCasePhrases } from '@domain/useCaseBundle/migrateUseCase';
import { isUseCaseIncludedInConversations } from '@types/aiAgentUseCases';
import { isStartAgentUseCase } from '@domain/useCaseGeneratorWizard/agentStartPrompt';

export function collectPhraseTokensFromUseCases(useCases: readonly AIAgentUseCase[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const uc of useCases) {
    if (!isUseCaseIncludedInConversations(uc) || isStartAgentUseCase(uc)) continue;
    const withPhrases = ensureUseCasePhrases(uc);
    for (const phrase of withPhrases.phrases ?? []) {
      for (const variant of phrase.variants) {
        const compiled = variant.compiled;
        if (!compiled?.tokenizedText?.trim()) continue;
        for (const token of compiled.tokens ?? []) {
          const t = String(token ?? '').trim();
          if (!t || seen.has(t)) continue;
          seen.add(t);
          out.push(t);
        }
      }
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}
