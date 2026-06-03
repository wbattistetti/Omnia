/**
 * Compilazione semantica design-time: bracket letterali → slot_id via lessico + inferenza.
 */

import { autoTokenizeAnnotated } from '@domain/useCaseGeneratorWizard/tokenTypeInference';
import { extractTokenNames } from '@domain/useCaseGeneratorWizard/tokenizedText';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import type {
  AIAgentCanonicalPhrase,
  AIAgentPhraseVariant,
  PhraseCompiledSnapshot,
  SlotSurfaceMapping,
} from './schema';
import { ensureUseCasePhrases, syncDialogueFromPrimaryPhrase } from './migrateUseCase';
import {
  lookupApprovedSlotId,
  lookupLexiconSlotId,
  type ProjectSlotLexicon,
  isValidSlotId,
  isUnclassifiedSlotId,
  UNCLASSIFIED_SLOT_ID,
  normalizeSlotId,
  normalizeSurface,
} from './projectSlotLexicon';

/** Opzioni compile catalogo: classificazione solo da lessico/IA (nessun vocabolario statico). */
export type SemanticCompileOptions = {
  /** @deprecated Ignorato: nessuna euristica dominio predefinita. */
  inferDomainHints?: boolean;
  /** Se true, usa anche voci lessico non ancora approvate (dopo proposta IA). */
  useLexiconClassifiedEntries?: boolean;
};

export const CATALOG_IA_FIRST_COMPILE_OPTIONS: SemanticCompileOptions = {
  inferDomainHints: false,
  useLexiconClassifiedEntries: true,
};

function uniqueTokens(tokenizedText: string): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const name of extractTokenNames(tokenizedText)) {
    if (seen.has(name)) continue;
    seen.add(name);
    tokens.push(name);
  }
  return tokens;
}

function inferSlotIdForSurface(
  surface: string,
  lexicon: ProjectSlotLexicon,
  options?: SemanticCompileOptions
): string {
  const fromApproved = lookupApprovedSlotId(lexicon, surface);
  if (fromApproved) return fromApproved;

  if (options?.useLexiconClassifiedEntries) {
    const fromLex = lookupLexiconSlotId(lexicon, surface);
    if (fromLex) return fromLex;
  }

  if (options?.inferDomainHints === false) {
    return UNCLASSIFIED_SLOT_ID;
  }

  const inferred = autoTokenizeAnnotated(`[${surface.trim()}]`);
  const base = normalizeSlotId(inferred.brackets[0]?.finalName ?? UNCLASSIFIED_SLOT_ID);
  if (isValidSlotId(base) && !isUnclassifiedSlotId(base)) return base;
  return UNCLASSIFIED_SLOT_ID;
}

function tokenLabelForCompilePass(
  slot_id: string,
  surfaceKey: string
): string {
  if (isUnclassifiedSlotId(slot_id)) return surfaceKey;
  return slot_id;
}

function compileNaturalText(
  naturalText: string,
  lexicon: ProjectSlotLexicon,
  localMappings: readonly SlotSurfaceMapping[] = [],
  options?: SemanticCompileOptions
): { tokenizedText: string; mappings: SlotSurfaceMapping[]; tokens: string[] } {
  const localBySurface = new Map(
    localMappings.map((m) => [m.surface.trim().toLowerCase(), m.slot_id])
  );
  const mappings: SlotSurfaceMapping[] = [];
  let tokenized = '';
  let i = 0;
  const bracketSlots: string[] = [];

  while (i < naturalText.length) {
    if (naturalText[i] !== '[') {
      tokenized += naturalText[i];
      i += 1;
      continue;
    }
    const close = naturalText.indexOf(']', i + 1);
    if (close === -1) {
      tokenized += naturalText.slice(i);
      break;
    }
    const inner = naturalText.slice(i + 1, close);
    const surface = inner.trim();
    const surfaceKey = surface.toLowerCase();

    let slot_id = localBySurface.get(surfaceKey);
    if (!slot_id) {
      slot_id = inferSlotIdForSurface(surface, lexicon, options);
    }
    if (!isValidSlotId(slot_id)) slot_id = UNCLASSIFIED_SLOT_ID;

    mappings.push({ surface, slot_id });
    bracketSlots.push(tokenLabelForCompilePass(slot_id, surfaceKey));
    i = close + 1;
  }

  const counts: Record<string, number> = {};
  for (const s of bracketSlots) counts[s] = (counts[s] ?? 0) + 1;
  const running: Record<string, number> = {};
  let bi = 0;
  i = 0;
  tokenized = '';
  while (i < naturalText.length) {
    if (naturalText[i] !== '[') {
      tokenized += naturalText[i];
      i += 1;
      continue;
    }
    const close = naturalText.indexOf(']', i + 1);
    if (close === -1) {
      tokenized += naturalText.slice(i);
      break;
    }
    const slot_id = bracketSlots[bi];
    bi += 1;
    const finalName =
      (counts[slot_id] ?? 0) <= 1
        ? slot_id
        : `${slot_id}${(running[slot_id] = (running[slot_id] ?? 0) + 1)}`;
    tokenized += `[${finalName}]`;
    i = close + 1;
  }

  return {
    tokenizedText: tokenized,
    mappings,
    tokens: uniqueTokens(tokenized),
  };
}

/** Testo surface usato per compile: template variante se presente, altrimenti il canonico della frase. */
export function variantNaturalText(
  phrase: AIAgentCanonicalPhrase,
  variant: AIAgentPhraseVariant
): string {
  if (typeof variant.naturalText === 'string' && variant.naturalText.trim()) {
    return variant.naturalText.trim();
  }
  return phrase.naturalText;
}

export function compilePhraseVariant(
  phrase: AIAgentCanonicalPhrase,
  variant: AIAgentPhraseVariant,
  lexicon: ProjectSlotLexicon,
  options?: SemanticCompileOptions
): PhraseCompiledSnapshot {
  const naturalText = variantNaturalText(phrase, variant);
  const local = [...(phrase.localMappings ?? [])];
  const { tokenizedText, mappings, tokens } = compileNaturalText(
    naturalText,
    lexicon,
    local,
    options
  );
  return {
    tokenizedText,
    tokens,
    mappings,
    status: 'fresh',
    compiledAt: new Date().toISOString(),
  };
}

export function compileUseCasePhrases(
  uc: AIAgentUseCase,
  lexicon: ProjectSlotLexicon,
  options?: SemanticCompileOptions
): AIAgentUseCase {
  const base = ensureUseCasePhrases(uc);
  const phrases = (base.phrases ?? []).map((phrase) => ({
    ...phrase,
    variants: phrase.variants.map((variant) => ({
      ...variant,
      compiled: compilePhraseVariant(phrase, variant, lexicon, options),
    })),
  }));
  return syncDialogueFromPrimaryPhrase({ ...base, phrases });
}

export function compileAllUseCases(
  useCases: readonly AIAgentUseCase[],
  lexicon: ProjectSlotLexicon,
  options?: SemanticCompileOptions
): AIAgentUseCase[] {
  return useCases.map((uc) => compileUseCasePhrases(uc, lexicon, options));
}

/** Surface e token per la chiamata compile IA (senza euristiche locali). */
export function collectCatalogCompileInputs(
  useCases: readonly AIAgentUseCase[],
  lexicon: ProjectSlotLexicon
): { surfaces: string[]; phraseTokens: string[] } {
  const surfaceSet = collectSurfacesInCatalogUseCases(useCases);
  const surfaces = [...surfaceSet].sort((a, b) => a.localeCompare(b));
  const compiled = compileAllUseCases(useCases, lexicon, CATALOG_IA_FIRST_COMPILE_OPTIONS);
  const tokenSet = new Set<string>();
  for (const t of extractPhraseTokensFromCompiled(compiled)) tokenSet.add(t);
  for (const s of surfaces) {
    if (/^[a-z][a-z0-9_]*$/i.test(s)) tokenSet.add(s.toLowerCase());
  }
  return {
    surfaces,
    phraseTokens: [...tokenSet].sort((a, b) => a.localeCompare(b)),
  };
}

function extractPhraseTokensFromCompiled(useCases: readonly AIAgentUseCase[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const uc of useCases) {
    for (const phrase of uc.phrases ?? []) {
      for (const variant of phrase.variants) {
        for (const token of variant.compiled?.tokens ?? []) {
          const t = String(token ?? '').trim();
          if (!t || seen.has(t)) continue;
          seen.add(t);
          out.push(t);
        }
      }
    }
  }
  return out;
}

/** Estrae le surface (testo tra `[` e `]`) da un testo naturale. */
export function extractBracketSurfacesFromText(text: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] !== '[') {
      i += 1;
      continue;
    }
    const close = text.indexOf(']', i + 1);
    if (close === -1) break;
    const inner = text.slice(i + 1, close).trim();
    if (inner) out.push(normalizeSurface(inner));
    i = close + 1;
  }
  return out;
}

/**
 * Tutte le surface ancora presenti nei messaggi del catalogo (frasi, varianti, parametrico, dialogue).
 * Usato per eliminare voci orfane dal lessico progetto.
 */
export function collectSurfacesInCatalogUseCases(
  useCases: readonly AIAgentUseCase[]
): ReadonlySet<string> {
  const seen = new Set<string>();
  const addFrom = (text: string | undefined) => {
    if (!text?.trim()) return;
    for (const s of extractBracketSurfacesFromText(text)) seen.add(s);
  };

  for (const uc of useCases) {
    const withPhrases = ensureUseCasePhrases(uc);
    for (const phrase of withPhrases.phrases ?? []) {
      addFrom(phrase.naturalText);
      for (const variant of phrase.variants) {
        addFrom(variantNaturalText(phrase, variant));
      }
      const param = phrase.parametric;
      if (param?.enabled) {
        for (const row of param.rows ?? []) {
          addFrom(
            typeof row.promptNaturalText === 'string' ? row.promptNaturalText : undefined
          );
        }
      }
    }
    for (const turn of withPhrases.dialogue ?? []) {
      if (turn?.role === 'assistant') addFrom(turn.content);
    }
  }
  return seen;
}

export function collectMappingsFromUseCases(
  useCases: readonly AIAgentUseCase[]
): SlotSurfaceMapping[] {
  const out: SlotSurfaceMapping[] = [];
  for (const uc of useCases) {
    for (const phrase of uc.phrases ?? []) {
      for (const variant of phrase.variants) {
        for (const m of variant.compiled?.mappings ?? []) {
          out.push(m);
        }
      }
    }
  }
  return out;
}
