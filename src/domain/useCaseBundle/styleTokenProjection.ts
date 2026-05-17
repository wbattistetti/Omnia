/**
 * Campi JSON conversazionale per token di stile «…» (regola LLM fissa + mappa varianti).
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { messageHasStyleTokens } from './agentMessageTokenSyntax';
import { ensureUseCasePhrases } from './migrateUseCase';
import type { AIAgentPhraseStyleToken } from './schema';

/** Regola invariante per LLM quando il messaggio contiene token di stile. */
export const STYLE_RULE_LLM_TEXT =
  'Puoi solo aggiustare la fluidità grammaticale e stilistica, senza cambiare né struttura né semantica. Non introdurre sinonimi, non aggiungere parole nuove, non modificare la semantica.';

export type UseCaseStyleTokenJsonFields = {
  /** Template designer con `[semantico]` e `«stile»`. */
  template: string;
  tokens_stile: Record<string, string[]>;
  style_rule: { llm: string };
};

function primaryPhraseNaturalText(uc: AIAgentUseCase): string {
  const phrase = ensureUseCasePhrases(uc).phrases?.[0];
  if (phrase?.naturalText?.trim()) return phrase.naturalText;
  const assistant = uc.dialogue.find((t) => t.role === 'assistant');
  return assistant?.content ?? '';
}

function buildTokensStileMap(
  styleTokens: readonly AIAgentPhraseStyleToken[]
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const t of styleTokens) {
    const variants = t.variants.map((v) => v.trim()).filter(Boolean);
    if (variants.length === 0) continue;
    out[t.styleTokenId] = variants;
  }
  return out;
}

/** True se la frase primaria ha metadata o marcatura `«…»` nel testo. */
export function useCaseHasStyleTokens(uc: AIAgentUseCase): boolean {
  const phrase = ensureUseCasePhrases(uc).phrases?.[0];
  const tokens = phrase?.styleTokens ?? [];
  if (tokens.length > 0) return true;
  return messageHasStyleTokens(primaryPhraseNaturalText(uc));
}

/**
 * Campi opzionali da unire al JSON conversazionale quando sono presenti token di stile.
 * `null` se nessun token di stile.
 */
export function buildUseCaseStyleTokenJsonFields(
  uc: AIAgentUseCase
): UseCaseStyleTokenJsonFields | null {
  if (!useCaseHasStyleTokens(uc)) return null;
  const phrase = ensureUseCasePhrases(uc).phrases?.[0];
  const styleTokens = phrase?.styleTokens ?? [];
  const template = primaryPhraseNaturalText(uc).trim();
  const tokens_stile = buildTokensStileMap(styleTokens);
  if (Object.keys(tokens_stile).length === 0 && !messageHasStyleTokens(template)) {
    return null;
  }
  return {
    template,
    tokens_stile,
    style_rule: { llm: STYLE_RULE_LLM_TEXT },
  };
}

/**
 * Scenario LLM per proiezione: include la regola fissa se il use case ha token di stile.
 */
export function projectScenarioLlmText(uc: AIAgentUseCase): string {
  const base = uc.scenario?.llm?.trim() || '';
  const fallback =
    base ||
    uc.scenario?.descrittivo?.trim() ||
    (typeof uc.payoff === 'string' ? uc.payoff.trim() : '');
  if (!useCaseHasStyleTokens(uc)) return fallback;
  if (!fallback) return STYLE_RULE_LLM_TEXT;
  if (fallback.includes(STYLE_RULE_LLM_TEXT)) return fallback;
  return `${fallback}\n\n${STYLE_RULE_LLM_TEXT}`;
}
