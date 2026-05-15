/**
 * Operazioni sul modello phrase/variant (schema v2): sincronismo con dialogue legacy e varianti strutturali.
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

function nextStructuralVariantId(variants: readonly AIAgentPhraseVariant[]): string {
  let max = 0;
  for (const v of variants) {
    const m = /^structural_(\d+)$/.exec(v.variantId);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `structural_${max + 1}`;
}

/** Aggiunge una variante strutturale vuota sulla prima frase (template dedicato + when). */
export function addStructuralVariantToPrimaryPhrase(uc: AIAgentUseCase): AIAgentUseCase {
  const base = ensureUseCasePhrases(uc);
  const phrases = [...(base.phrases ?? [])];
  if (phrases.length === 0) return base;

  const p0 = { ...phrases[0], variants: [...phrases[0].variants] };
  const nv: AIAgentPhraseVariant = {
    variantId: nextStructuralVariantId(p0.variants),
    naturalText: '',
    when: '',
  };
  p0.variants = [...p0.variants, nv];
  phrases[0] = p0;
  return { ...base, phrases };
}

export function removeStructuralVariant(uc: AIAgentUseCase, variantId: string): AIAgentUseCase {
  if (variantId === 'default') return uc;
  const base = ensureUseCasePhrases(uc);
  const phrases = [...(base.phrases ?? [])];
  if (phrases.length === 0) return base;

  const p0 = {
    ...phrases[0],
    variants: phrases[0].variants.filter((v) => v.variantId !== variantId),
  };
  phrases[0] = p0;
  return { ...base, phrases };
}

export function patchStructuralVariant(
  uc: AIAgentUseCase,
  variantId: string,
  patch: { naturalText?: string; when?: string }
): AIAgentUseCase {
  const base = ensureUseCasePhrases(uc);
  const phrases = [...(base.phrases ?? [])];
  if (phrases.length === 0) return base;

  const p0 = { ...phrases[0], variants: [...phrases[0].variants] };
  p0.variants = p0.variants.map((v) =>
    v.variantId !== variantId
      ? v
      : {
          ...v,
          ...(patch.naturalText !== undefined ? { naturalText: patch.naturalText } : {}),
          ...(patch.when !== undefined ? { when: patch.when } : {}),
          compiled: undefined,
        }
  );
  phrases[0] = p0;
  return { ...base, phrases };
}
