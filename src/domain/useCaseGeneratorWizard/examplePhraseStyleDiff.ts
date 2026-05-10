/**
 * Passo «Frasi di esempio»: confronto testo assistente vs baseline (ultimo snapshot al passo),
 * con normalizzazione per ignorare differenze solo di spazi.
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';

/** Primo turno assistente (frase di esempio) per ogni use case. */
export function getFirstAssistantContent(useCase: AIAgentUseCase): string {
  const t = useCase.dialogue.find((x) => x.role === 'assistant');
  return typeof t?.content === 'string' ? t.content : '';
}

/**
 * Normalizza per confronto «stesso testo»: trim, spazi consecutivi, spazi intorno a newline.
 * Non applica lower-case (stile e maiuscole contano per coerenza visiva con l’utente).
 */
export function normalizeExamplePhraseForDiff(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .trim()
    .replace(/\s+/g, ' ');
}

export function snapshotAssistantContentByUseCaseId(
  useCases: readonly AIAgentUseCase[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const u of useCases) {
    out[u.id] = getFirstAssistantContent(u);
  }
  return out;
}

export interface ExamplePhraseStylePlan {
  /** Almeno un use case con frase diversa dalla baseline. */
  modifiedIds: string[];
  /** Almeno un use case ancora uguale alla baseline (candidato a rigenerazione). */
  unmodifiedIds: string[];
  /** Sottoinsieme di unmodified: presenti in baseline. */
  targetIds: string[];
  showStyleCta: boolean;
}

/**
 * Confronta lo stato attuale con la baseline catturata all’ingresso nel passo (o dopo «Aggiorna stile»).
 * Un id assente da `baselineById` è trattato come non modificato rispetto a se stesso (verrà backfillato lato UI).
 */
export function computeExamplePhraseStylePlan(
  useCases: readonly AIAgentUseCase[],
  baselineById: Readonly<Record<string, string>>
): ExamplePhraseStylePlan {
  const modifiedIds: string[] = [];
  const unmodifiedIds: string[] = [];
  for (const u of useCases) {
    const cur = normalizeExamplePhraseForDiff(getFirstAssistantContent(u));
    const baseRaw = baselineById[u.id];
    if (baseRaw === undefined) {
      unmodifiedIds.push(u.id);
      continue;
    }
    const base = normalizeExamplePhraseForDiff(baseRaw);
    if (cur !== base) {
      modifiedIds.push(u.id);
    } else {
      unmodifiedIds.push(u.id);
    }
  }
  const targetIds = unmodifiedIds.filter((id) => baselineById[id] !== undefined);
  const showStyleCta = modifiedIds.length >= 1 && targetIds.length >= 1;
  return { modifiedIds, unmodifiedIds, targetIds, showStyleCta };
}
