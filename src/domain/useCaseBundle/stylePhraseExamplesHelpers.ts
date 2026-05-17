/**
 * Esempi frase stile a design-time su `phrases[0].styleExamples`.
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { ensureUseCasePhrases } from './migrateUseCase';
import type {
  AIAgentPhraseStyleExample,
  AIAgentPhraseStyleExampleSource,
} from './schema';
import { agentMessageToPlainPreview, normalizePlainPhraseKey } from './stylePhrasePlainText';

export function createStyleExampleId(): string {
  return `se-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function sortStyleExamplesByPlainText(
  examples: readonly AIAgentPhraseStyleExample[]
): AIAgentPhraseStyleExample[] {
  return [...examples].sort((a, b) =>
    a.plainText.localeCompare(b.plainText, 'it', { sensitivity: 'base' })
  );
}

export function getPrimaryPhraseStyleExamples(
  uc: AIAgentUseCase
): AIAgentPhraseStyleExample[] {
  return [...(ensureUseCasePhrases(uc).phrases?.[0]?.styleExamples ?? [])];
}

export function setPrimaryPhraseStyleExamples(
  uc: AIAgentUseCase,
  examples: readonly AIAgentPhraseStyleExample[]
): AIAgentUseCase {
  const base = ensureUseCasePhrases(uc);
  const phrase = base.phrases?.[0];
  if (!phrase) return base;
  const sorted = dedupeStyleExamples(examples);
  const phrases = [...(base.phrases ?? [])];
  phrases[0] = {
    ...phrase,
    styleExamples: sorted.length > 0 ? sorted : undefined,
  };
  return { ...base, phrases };
}

export function examplesFromPlainTexts(
  texts: readonly string[],
  source: AIAgentPhraseStyleExampleSource,
  options?: { accepted?: boolean }
): AIAgentPhraseStyleExample[] {
  const accepted = options?.accepted ?? false;
  const seen = new Set<string>();
  const uniquePlain: string[] = [];
  for (const raw of texts) {
    const plainText = agentMessageToPlainPreview(raw);
    if (!plainText) continue;
    const key = normalizePlainPhraseKey(plainText);
    if (seen.has(key)) continue;
    seen.add(key);
    uniquePlain.push(plainText);
  }
  return uniquePlain.map((plainText) => ({
    exampleId: createStyleExampleId(),
    plainText,
    accepted,
    source,
  }));
}

/** Mantiene la prima occorrenza per chiave deduplicata (spazi/punteggiatura). */
export function dedupeStyleExamples(
  examples: readonly AIAgentPhraseStyleExample[]
): AIAgentPhraseStyleExample[] {
  const byKey = new Map<string, AIAgentPhraseStyleExample>();
  for (const ex of examples) {
    const key = normalizePlainPhraseKey(ex.plainText);
    if (!byKey.has(key)) {
      byKey.set(key, ex);
    }
  }
  return sortStyleExamplesByPlainText([...byKey.values()]);
}

/** Unisce testi plain deduplicati; le esistenti vincono su accettazione/source. */
export function mergeStyleExamples(
  existing: readonly AIAgentPhraseStyleExample[],
  incoming: readonly AIAgentPhraseStyleExample[]
): AIAgentPhraseStyleExample[] {
  const byKey = new Map<string, AIAgentPhraseStyleExample>();
  for (const ex of existing) {
    const key = normalizePlainPhraseKey(ex.plainText);
    if (!byKey.has(key)) {
      byKey.set(key, ex);
    }
  }
  for (const ex of incoming) {
    const key = normalizePlainPhraseKey(ex.plainText);
    if (!byKey.has(key)) {
      byKey.set(key, ex);
    }
  }
  return sortStyleExamplesByPlainText([...byKey.values()]);
}

export function patchStyleExample(
  uc: AIAgentUseCase,
  exampleId: string,
  patch: Partial<Pick<AIAgentPhraseStyleExample, 'plainText' | 'accepted' | 'source'>>
): AIAgentUseCase {
  const current = getPrimaryPhraseStyleExamples(uc);
  const next = current.map((ex) =>
    ex.exampleId === exampleId
      ? {
          ...ex,
          ...patch,
          ...(patch.plainText !== undefined
            ? { plainText: agentMessageToPlainPreview(patch.plainText) }
            : {}),
        }
      : ex
  );
  return setPrimaryPhraseStyleExamples(uc, next);
}

export function removeStyleExample(uc: AIAgentUseCase, exampleId: string): AIAgentUseCase {
  return setPrimaryPhraseStyleExamples(
    uc,
    getPrimaryPhraseStyleExamples(uc).filter((ex) => ex.exampleId !== exampleId)
  );
}

export function acceptStyleExample(uc: AIAgentUseCase, exampleId: string): AIAgentUseCase {
  return patchStyleExample(uc, exampleId, { accepted: true });
}
