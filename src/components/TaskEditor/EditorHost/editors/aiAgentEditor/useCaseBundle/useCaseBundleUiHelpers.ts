/**
 * Helper UI per bundle v2: conteggi stale/conflitti.
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import type { ProjectSlotLexicon } from '@domain/useCaseBundle/projectSlotLexicon';

export function countLexiconConflicts(lexicon: ProjectSlotLexicon): number {
  return lexicon.entries.filter((e) => Boolean(e.conflictWith)).length;
}

export function countStaleCompiledPhrases(useCases: readonly AIAgentUseCase[]): number {
  let n = 0;
  for (const uc of useCases) {
    for (const phrase of uc.phrases ?? []) {
      for (const variant of phrase.variants) {
        if (variant.compiled?.status === 'stale') n += 1;
      }
    }
  }
  return n;
}
