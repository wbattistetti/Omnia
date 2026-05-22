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
  type ProjectSlotLexicon,
  isValidSlotId,
  CORE_SLOT_IDS,
  UNCLASSIFIED_SLOT_ID,
  normalizeSlotId,
} from './projectSlotLexicon';

const DOMAIN_SLOT_HINTS: ReadonlyArray<{ pattern: RegExp; slot_id: string }> = [
  { pattern: /^(cardiolog|ortoped|dermatolog|ocul|ginecolog|neurolog|urolog)/i, slot_id: 'prestazione' },
  { pattern: /^(eco|rx|rmn|tac|visita)\b/i, slot_id: 'prestazione' },
  { pattern: /^domani$/i, slot_id: 'datarelativa' },
  { pattern: /^dopodomani$/i, slot_id: 'datarelativa' },
];

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

function inferSlotIdForSurface(surface: string, lexicon: ProjectSlotLexicon): string {
  const fromLex = lookupApprovedSlotId(lexicon, surface);
  if (fromLex) return fromLex;

  const trimmed = surface.trim();
  for (const hint of DOMAIN_SLOT_HINTS) {
    if (hint.pattern.test(trimmed)) return hint.slot_id;
  }

  const inferred = autoTokenizeAnnotated(`[${trimmed}]`);
  const base = normalizeSlotId(inferred.brackets[0]?.finalName ?? UNCLASSIFIED_SLOT_ID);
  if ((CORE_SLOT_IDS as readonly string[]).includes(base)) return base;
  return UNCLASSIFIED_SLOT_ID;
}

function compileNaturalText(
  naturalText: string,
  lexicon: ProjectSlotLexicon,
  localMappings: readonly SlotSurfaceMapping[] = []
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
      slot_id = inferSlotIdForSurface(surface, lexicon);
    }
    if (!isValidSlotId(slot_id)) slot_id = UNCLASSIFIED_SLOT_ID;

    mappings.push({ surface, slot_id });
    bracketSlots.push(slot_id);
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
  lexicon: ProjectSlotLexicon
): PhraseCompiledSnapshot {
  const naturalText = variantNaturalText(phrase, variant);
  const local = [...(phrase.localMappings ?? [])];
  const { tokenizedText, mappings, tokens } = compileNaturalText(naturalText, lexicon, local);
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
  lexicon: ProjectSlotLexicon
): AIAgentUseCase {
  const base = ensureUseCasePhrases(uc);
  const phrases = (base.phrases ?? []).map((phrase) => ({
    ...phrase,
    variants: phrase.variants.map((variant) => ({
      ...variant,
      compiled: compilePhraseVariant(phrase, variant, lexicon),
    })),
  }));
  return syncDialogueFromPrimaryPhrase({ ...base, phrases });
}

export function compileAllUseCases(
  useCases: readonly AIAgentUseCase[],
  lexicon: ProjectSlotLexicon
): AIAgentUseCase[] {
  return useCases.map((uc) => compileUseCasePhrases(uc, lexicon));
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
