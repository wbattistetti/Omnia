/**
 * Migrazione use case v1 (solo `dialogue[0]`) → modello `phrases[]` v2.
 */

import { newAgentUseCaseTurnId } from '@types/aiAgentUseCases';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import type { AIAgentCanonicalPhrase, AIAgentPhraseVariant } from './schema';

/** Id stabile per migrazione v1 → v2 (deterministico nel prompt deploy). */
function defaultPhraseIdForUseCase(useCaseId: string): string {
  return `ph-${useCaseId}-0`;
}

function dialogueAssistantContent(uc: AIAgentUseCase): string {
  const dialogue = Array.isArray(uc.dialogue) ? uc.dialogue : [];
  const assistant = dialogue.find((t) => t && t.role === 'assistant');
  return assistant && typeof assistant.content === 'string' ? assistant.content : '';
}

/**
 * True se lo use case ha già il modello frasi v2.
 */
export function useCaseHasPhrasesModel(uc: AIAgentUseCase): boolean {
  return Array.isArray(uc.phrases) && uc.phrases.length > 0;
}

/**
 * Garantisce `phrases[]` popolato da dialogue legacy se assente.
 */
export function ensureUseCasePhrases(uc: AIAgentUseCase): AIAgentUseCase {
  if (useCaseHasPhrasesModel(uc)) return uc;
  const naturalText = dialogueAssistantContent(uc).trim();
  const phraseId = defaultPhraseIdForUseCase(uc.id);
  const variant: AIAgentPhraseVariant = {
    variantId: 'default',
    ...(naturalText ? {} : {}),
  };
  const phrase: AIAgentCanonicalPhrase = {
    phraseId,
    naturalText,
    variants: [variant],
  };
  const dialogue = Array.isArray(uc.dialogue) ? uc.dialogue : [];
  const assistant = dialogue.find((t) => t && t.role === 'assistant');
  const syncedDialogue =
    assistant && naturalText
      ? dialogue.map((t) =>
          t.role === 'assistant' && t.turn_id === assistant.turn_id
            ? { ...t, content: naturalText }
            : t
        )
      : dialogue.length > 0
        ? dialogue
        : [
            {
              turn_id: newAgentUseCaseTurnId(),
              role: 'assistant' as const,
              content: naturalText,
              editable: true,
            },
          ];
  return { ...uc, phrases: [phrase], dialogue: syncedDialogue };
}

/**
 * Sincronizza `dialogue[0].assistant.content` dalla prima frase (compat editor legacy).
 */
export function syncDialogueFromPrimaryPhrase(uc: AIAgentUseCase): AIAgentUseCase {
  const withPhrases = ensureUseCasePhrases(uc);
  const primary = withPhrases.phrases?.[0];
  if (!primary) return withPhrases;
  const text = primary.naturalText;
  const dialogue = Array.isArray(withPhrases.dialogue) ? [...withPhrases.dialogue] : [];
  const idx = dialogue.findIndex((t) => t && t.role === 'assistant');
  if (idx >= 0) {
    dialogue[idx] = { ...dialogue[idx], content: text };
  } else {
    dialogue.unshift({
      turn_id: newAgentUseCaseTurnId(),
      role: 'assistant',
      content: text,
      editable: true,
    });
  }
  return { ...withPhrases, dialogue };
}
