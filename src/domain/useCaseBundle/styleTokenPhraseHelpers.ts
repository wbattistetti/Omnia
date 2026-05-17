/**
 * Style tokens su `phrases[0]`: varianti conversazionali marcate con «…» nel naturalText.
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import {
  extractStyleTokenSurfacesFromText,
  styleTokenIdFromSurface,
} from './agentMessageTokenSyntax';
import type { AIAgentPhraseStyleToken } from './schema';
import { ensureUseCasePhrases } from './migrateUseCase';

function primaryPhrase(uc: AIAgentUseCase) {
  return ensureUseCasePhrases(uc).phrases?.[0];
}

/** Mantiene solo style token ancora presenti nel testo («surface»). */
export function pruneStyleTokensToNaturalText(uc: AIAgentUseCase): AIAgentUseCase {
  const base = ensureUseCasePhrases(uc);
  const phrase = base.phrases?.[0];
  if (!phrase?.styleTokens?.length) return base;
  const surfaces = new Set(extractStyleTokenSurfacesFromText(phrase.naturalText));
  const styleTokens = phrase.styleTokens.filter((t) => surfaces.has(t.defaultSurface));
  if (styleTokens.length === phrase.styleTokens.length) return base;
  const phrases = [...(base.phrases ?? [])];
  phrases[0] = { ...phrase, styleTokens: styleTokens.length ? styleTokens : undefined };
  return { ...base, phrases };
}

/** Registra o aggiorna un style token dopo wrap «surface». */
export function upsertStyleTokenOnWrap(uc: AIAgentUseCase, surface: string): AIAgentUseCase {
  const trimmed = surface.trim();
  if (!trimmed) return uc;
  const base = ensureUseCasePhrases(uc);
  const phrase = base.phrases?.[0];
  if (!phrase) return base;
  const existing = phrase.styleTokens ?? [];
  const found = existing.find((t) => t.defaultSurface === trimmed);
  const styleTokens: AIAgentPhraseStyleToken[] = found
    ? existing
    : [
        ...existing,
        {
          styleTokenId: styleTokenIdFromSurface(trimmed),
          defaultSurface: trimmed,
          variants: [trimmed],
        },
      ];
  const phrases = [...(base.phrases ?? [])];
  phrases[0] = { ...phrase, styleTokens };
  return { ...base, phrases };
}

/** Rimuove metadata style token quando si fa untokenize di «surface». */
export function removeStyleTokenOnUnwrap(uc: AIAgentUseCase, surface: string): AIAgentUseCase {
  const trimmed = surface.trim();
  if (!trimmed) return uc;
  const base = ensureUseCasePhrases(uc);
  const phrase = base.phrases?.[0];
  if (!phrase?.styleTokens?.length) return base;
  const styleTokens = phrase.styleTokens.filter((t) => t.defaultSurface !== trimmed);
  const phrases = [...(base.phrases ?? [])];
  phrases[0] = {
    ...phrase,
    styleTokens: styleTokens.length ? styleTokens : undefined,
  };
  return { ...base, phrases };
}

/** Aggiorna l'elenco varianti per uno style token (per id). */
export function patchStyleTokenVariants(
  uc: AIAgentUseCase,
  styleTokenId: string,
  variants: readonly string[]
): AIAgentUseCase {
  const cleaned = variants.map((v) => v.trim()).filter(Boolean);
  if (cleaned.length === 0) return uc;
  const base = ensureUseCasePhrases(uc);
  const phrase = base.phrases?.[0];
  if (!phrase?.styleTokens?.length) return base;
  const styleTokens = phrase.styleTokens.map((t) =>
    t.styleTokenId === styleTokenId ? { ...t, variants: [...cleaned] } : t
  );
  const phrases = [...(base.phrases ?? [])];
  phrases[0] = { ...phrase, styleTokens };
  return { ...base, phrases };
}

export function getPrimaryPhraseStyleTokens(uc: AIAgentUseCase): readonly AIAgentPhraseStyleToken[] {
  return primaryPhrase(uc)?.styleTokens ?? [];
}

export function findStyleTokenBySurface(
  uc: AIAgentUseCase,
  surface: string
): AIAgentPhraseStyleToken | undefined {
  const trimmed = surface.trim();
  return getPrimaryPhraseStyleTokens(uc).find((t) => t.defaultSurface === trimmed);
}
