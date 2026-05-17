/**
 * Combinatoria varianti style token «…» su un template messaggio.
 */

import { splitAgentMessageParts } from './agentMessageTokenSyntax';
import type { AIAgentPhraseStyleToken } from './schema';

export const MAX_STYLE_TOKEN_COMBINATIONS = 30;

export type StyleTokenCombinationPick = Record<string, string>;

/** Prodotto cartesiano delle varianti (cap {@link MAX_STYLE_TOKEN_COMBINATIONS}). */
export function buildStyleTokenCombinations(
  styleTokens: readonly AIAgentPhraseStyleToken[],
  max = MAX_STYLE_TOKEN_COMBINATIONS
): { combinations: StyleTokenCombinationPick[]; truncated: boolean } {
  const tokens = styleTokens.filter((t) => t.variants.some((v) => v.trim()));
  if (tokens.length === 0) {
    return { combinations: [], truncated: false };
  }

  let combos: StyleTokenCombinationPick[] = [{}];
  let truncated = false;

  for (const token of tokens) {
    const variants = token.variants.map((v) => v.trim()).filter(Boolean);
    const next: StyleTokenCombinationPick[] = [];
    for (const base of combos) {
      for (const variant of variants) {
        next.push({ ...base, [token.styleTokenId]: variant });
        if (next.length >= max) {
          truncated = true;
          return { combinations: next, truncated: true };
        }
      }
    }
    combos = next;
  }

  return { combinations: combos, truncated };
}

/** Sostituisce ogni `«…»` con la variante scelta per lo style token corrispondente. */
export function materializeStyleCombination(
  template: string,
  styleTokens: readonly AIAgentPhraseStyleToken[],
  picks: StyleTokenCombinationPick
): string {
  const parts = splitAgentMessageParts(template);
  return parts
    .map((part) => {
      if (part.kind === 'semantic') return part.text;
      if (part.kind !== 'style') return part.text;
      const inner = part.text.slice(1, -1);
      const token = styleTokens.find((t) => t.defaultSurface === inner);
      const surface = token ? picks[token.styleTokenId] ?? inner : inner;
      return `«${surface}»`;
    })
    .join('');
}

/** Frasi candidate (combinazioni materializzate sul template). */
export function buildMaterializedStylePhrases(
  template: string,
  styleTokens: readonly AIAgentPhraseStyleToken[],
  max = MAX_STYLE_TOKEN_COMBINATIONS
): { phrases: string[]; truncated: boolean } {
  const { combinations, truncated } = buildStyleTokenCombinations(styleTokens, max);
  const phrases = combinations.map((pick) =>
    materializeStyleCombination(template, styleTokens, pick)
  );
  return { phrases, truncated };
}
