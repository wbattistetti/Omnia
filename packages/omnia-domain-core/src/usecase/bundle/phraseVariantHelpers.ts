/**
 * Operazioni sul modello phrase/variant (schema v2): sincronismo con dialogue legacy.
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { extractTokenNames } from '@domain/useCaseGeneratorWizard/tokenizedText';
import type { AIAgentPhraseVariant, PhraseCompiledSnapshot, SlotSurfaceMapping } from './schema';
import { ensureUseCasePhrases } from './migrateUseCase';
import { variantNaturalText } from './semanticCompile';
import {
  replaceSlotIdInTokenizedText,
  resolveNaturalSurfaceAtTokenIndex,
} from './semanticTokenText';
import { isValidSlotId, isUnclassifiedSlotId, normalizeSlotId, normalizeSurface } from './projectSlotLexicon';

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

function patchDefaultVariantCompiled(
  variants: readonly AIAgentPhraseVariant[],
  compiled: PhraseCompiledSnapshot
): AIAgentPhraseVariant[] {
  return variants.map((v) =>
    v.variantId === 'default' ? { ...v, compiled } : v
  );
}

/**
 * Persiste override manuale del testo tokenizzato sulla variante `default` (design-time).
 */
export function patchPrimaryPhraseVariantTokenizedText(
  uc: AIAgentUseCase,
  tokenizedText: string
): AIAgentUseCase {
  const base = ensureUseCasePhrases(uc);
  const phrases = [...(base.phrases ?? [])];
  if (phrases.length === 0) return base;

  const trimmed = tokenizedText.trim();
  const tokens: string[] = [];
  const seen = new Set<string>();
  for (const name of extractTokenNames(trimmed)) {
    if (seen.has(name)) continue;
    seen.add(name);
    tokens.push(name);
  }

  const phrase = phrases[0];
  const prev = phrase.variants.find((v) => v.variantId === 'default')?.compiled;
  const compiled: PhraseCompiledSnapshot = {
    tokenizedText: trimmed,
    tokens,
    mappings: prev?.mappings ?? [],
    status: 'fresh',
    compiledAt: new Date().toISOString(),
  };

  phrases[0] = {
    ...phrase,
    variants: patchDefaultVariantCompiled(phrase.variants, compiled),
  };
  return { ...base, phrases };
}

function upsertPhraseLocalMapping(
  localMappings: readonly SlotSurfaceMapping[] | undefined,
  surface: string,
  slot_id: string
): SlotSurfaceMapping[] {
  const key = normalizeSurface(surface);
  const next = (localMappings ?? []).filter((m) => normalizeSurface(m.surface) !== key);
  next.push({ surface: surface.trim(), slot_id: normalizeSlotId(slot_id) });
  return next;
}

function upsertMappingList(
  mappings: readonly SlotSurfaceMapping[],
  surface: string,
  slot_id: string
): SlotSurfaceMapping[] {
  const key = normalizeSurface(surface);
  const next = mappings.filter((m) => normalizeSurface(m.surface) !== key);
  next.push({ surface: surface.trim(), slot_id: normalizeSlotId(slot_id) });
  return next;
}

/**
 * Assegna slot_id a un token del layer semantico: aggiorna testo tokenizzato, mapping locale e snapshot fresh.
 */
export function patchPrimaryPhraseSemanticSlotAssignment(
  uc: AIAgentUseCase,
  input: {
    tokenizedText: string;
    oldToken: string;
    newSlotId: string;
  }
): AIAgentUseCase {
  const newSlot = normalizeSlotId(input.newSlotId);
  if (!isValidSlotId(newSlot) || isUnclassifiedSlotId(newSlot)) return uc;

  const base = ensureUseCasePhrases(uc);
  const phrases = [...(base.phrases ?? [])];
  if (phrases.length === 0) return base;

  const phrase = phrases[0];
  const variant =
    phrase.variants.find((v) => v.variantId === 'default') ?? phrase.variants[0];
  const naturalText = variant ? variantNaturalText(phrase, variant) : phrase.naturalText;

  const nextTokenized = replaceSlotIdInTokenizedText(
    input.tokenizedText,
    input.oldToken,
    newSlot
  );

  const surface = resolveNaturalSurfaceAtTokenIndex(
    naturalText,
    input.tokenizedText,
    input.oldToken
  );

  const prevCompiled = variant?.compiled;
  const mappings = surface
    ? upsertMappingList(prevCompiled?.mappings ?? [], surface, newSlot)
    : prevCompiled?.mappings ?? [];

  const tokens: string[] = [];
  const seen = new Set<string>();
  for (const name of extractTokenNames(nextTokenized)) {
    if (seen.has(name)) continue;
    seen.add(name);
    tokens.push(name);
  }

  const compiled: PhraseCompiledSnapshot = {
    tokenizedText: nextTokenized.trim(),
    tokens,
    mappings,
    status: 'fresh',
    compiledAt: new Date().toISOString(),
  };

  phrases[0] = {
    ...phrase,
    ...(surface
      ? { localMappings: upsertPhraseLocalMapping(phrase.localMappings, surface, newSlot) }
      : {}),
    variants: patchDefaultVariantCompiled(phrase.variants, compiled),
  };
  return { ...base, phrases };
}
