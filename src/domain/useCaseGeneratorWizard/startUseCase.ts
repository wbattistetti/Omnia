/**
 * Use case marcato come Start: regola di apertura sessione e frase ConvAI `first_message`.
 */

import {
  buildUseCaseCatalogNumberById,
} from '@domain/aiAgentUseCase/useCaseCatalogNumber';
import {
  getAssistantExample,
  isUseCaseIncludedInConversations,
  type AIAgentUseCase,
} from '@types/aiAgentUseCases';
import {
  projectUseCaseToConversationalJson,
} from './useCaseJsonProjection';
import { isStartAgentUseCase } from './agentStartPrompt';

/** Risolve l'use case Start se l'id è valido, incluso nel catalogo e proiettabile. */
export function resolveStartUseCase(
  useCases: readonly AIAgentUseCase[],
  startUseCaseId: string | undefined | null
): AIAgentUseCase | null {
  const id = String(startUseCaseId ?? '').trim();
  if (!id) return null;
  const uc = useCases.find((u) => u.id === id);
  if (!uc || isStartAgentUseCase(uc)) return null;
  if (!isUseCaseIncludedInConversations(uc)) return null;
  return uc;
}

/** Testo runtime (prima variante tokenizzata) per ElevenLabs `first_message`. */
export function resolveStartUseCaseSpeechText(
  useCases: readonly AIAgentUseCase[],
  startUseCaseId: string | undefined | null
): string {
  const uc = resolveStartUseCase(useCases, startUseCaseId);
  if (!uc) return '';
  const projected = projectUseCaseToConversationalJson(uc);
  const fromVariant = projected?.variants[0]?.tokenizedExample?.trim();
  if (fromVariant) return fromVariant;
  return getAssistantExample(uc).trim();
}

/**
 * Sezione «Regola di Start» nel system prompt. Vuota se nessun use case Start valido.
 */
export function buildStartUseCaseRuleSection(
  useCases: readonly AIAgentUseCase[],
  startUseCaseId: string | undefined | null
): string {
  const uc = resolveStartUseCase(useCases, startUseCaseId);
  if (!uc) return '';

  const included = useCases.filter(
    (u) => isUseCaseIncludedInConversations(u) && !isStartAgentUseCase(u)
  );
  const numberById = buildUseCaseCatalogNumberById(included);
  const catalogNumber = numberById.get(uc.id);
  const numLabel =
    typeof catalogNumber === 'number' && catalogNumber > 0
      ? String(catalogNumber)
      : '?';
  const label = String(uc.label ?? '').trim() || uc.id;
  const speech = resolveStartUseCaseSpeechText(useCases, uc.id);
  const speechLine = speech
    ? `\n\nFrase da pronunciare (template use case):\n> ${speech.replace(/\n/g, '\n> ')}`
    : '';

  const lines = [
    'Regola di Start',
    `All'inizio della sessione, se non c'è ancora alcun contesto, l'agente deve applicare l'Use Case ${numLabel} ('${label}') e pronunciare la frase corrispondente. Non deve usare saluti generici.`,
    speechLine,
  ];
  return lines.join('').trim();
}
