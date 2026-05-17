/**
 * Operazioni sul modello phrase/variant (schema v2): sincronismo con dialogue legacy.
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import type { AIAgentPhraseVariant } from './schema';
import { ensureUseCasePhrases } from './migrateUseCase';

/** Invalida snapshot compile quando cambia il testo sorgente. */
function variantsWithoutCompiled(variants: readonly AIAgentPhraseVariant[]): AIAgentPhraseVariant[] {
  return variants.map((v) => ({
    ...v,
    compiled: undefined,
    ...(v.variantId === 'default' ? { naturalText: undefined } : {}),
  }));
}

/**
 * Dopo edit del turno assistente: aggiorna `phrases[0].naturalText` e invalida compile.
 */
export function syncPrimaryPhraseNaturalFromAssistantTurn(
  uc: AIAgentUseCase,
  turnId: string,
  content: string
): AIAgentUseCase {
  const assistant = uc.dialogue.find((t) => t.role === 'assistant' && t.turn_id === turnId);
  if (!assistant) return uc;

  const base = ensureUseCasePhrases(uc);
  const phrases = [...(base.phrases ?? [])];
  if (phrases.length === 0) return base;

  const p0 = {
    ...phrases[0],
    naturalText: content,
    variants: variantsWithoutCompiled(phrases[0].variants),
  };
  phrases[0] = p0;
  return { ...base, phrases };
}
