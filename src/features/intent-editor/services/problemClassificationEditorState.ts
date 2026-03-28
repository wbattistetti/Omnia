/**
 * Maps ProblemPayload ↔ intent/test Zustand stores for the embeddings (problem classification) editor.
 */
import type { ProblemPayload, ProblemIntent, ProblemEditorState } from '../../../types/project';
import type { Intent } from '../types/types';
import type { TestItem } from '../state/testStore';
import { semanticValuesToProblemIntents, problemIntentsToSemanticValues } from '../../../utils/semanticValueClassificationBridge';
import { useIntentStore } from '../state/intentStore';
import { useTestStore } from '../state/testStore';
import { taskRepository } from '../../../services/TaskRepository';

export function problemPayloadToIntentAndTests(payload: ProblemPayload): { intents: Intent[]; tests: TestItem[] } {
  const piList = semanticValuesToProblemIntents(payload.semanticValues);
  const intents: Intent[] = piList.map((pi: ProblemIntent) => ({
    id: pi.id,
    name: pi.name,
    description: pi.description,
    langs: ['it'],
    threshold: pi.threshold ?? 0.6,
    status: 'draft' as const,
    variants: {
      curated: (pi.phrases?.matching || []).map(p => ({ id: p.id, text: p.text, lang: (p.lang as any) || 'it' })),
      staging: [],
      hardNeg: (pi.phrases?.notMatching || []).map(p => ({ id: p.id, text: p.text, lang: (p.lang as any) || 'it' })),
    },
    signals: { keywords: (pi.phrases?.keywords || []), synonymSets: [], patterns: [] },
  }));
  const tests: TestItem[] = (payload.editor?.tests || []).map(t => ({
    id: t.id,
    text: t.text,
    status: t.status,
  }));
  return { intents, tests };
}

/**
 * Builds the canonical ProblemPayload from current stores (for persist).
 */
export function buildProblemPayloadFromStores(instanceId: string): ProblemPayload {
  const intents = useIntentStore.getState().intents;
  const testItems = useTestStore.getState().items;
  const outIntents: ProblemIntent[] = intents.map(it => ({
    id: it.id,
    name: it.name,
    description: it.description,
    threshold: it.threshold,
    phrases: {
      matching: it.variants.curated.map(v => ({ id: v.id, text: v.text, lang: v.lang as any })),
      notMatching: it.variants.hardNeg.map(v => ({ id: v.id, text: v.text, lang: v.lang as any })),
      keywords: it.signals.keywords,
    },
  }));
  const prev = taskRepository.getTask(instanceId)?.semanticValues;
  const semanticValues = problemIntentsToSemanticValues(outIntents, prev ?? null);
  const editor: ProblemEditorState = {
    tests: testItems.map(t => ({ id: t.id, text: t.text, status: t.status })),
  };
  return { version: 1, semanticValues, editor };
}
