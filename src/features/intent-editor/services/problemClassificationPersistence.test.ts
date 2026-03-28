import { describe, it, expect } from 'vitest';
import { mergeProblemPayloadsForHydration } from './problemClassificationPersistence';
import { normalizeProblemPayload } from '../../../utils/semanticValueClassificationBridge';
import type { SemanticValue } from '../../../types/taskTypes';

function sv(id: string, label: string): SemanticValue {
  return {
    id,
    label,
    embedding: {
      threshold: 0.6,
      enabled: true,
      phrases: { matching: [], notMatching: [], keywords: [] },
    },
  };
}

describe('mergeProblemPayloadsForHydration', () => {
  it('returns empty when both sources lack semantic values', () => {
    const merged = mergeProblemPayloadsForHydration({ version: 1, semanticValues: [] }, null, 0);
    expect(merged.semanticValues?.length ?? 0).toBe(0);
  });

  it('uses task only when localStorage is null', () => {
    const fromTask = { version: 1 as const, semanticValues: [sv('a', 'A')] };
    const merged = mergeProblemPayloadsForHydration(fromTask, null, 5000);
    expect(merged.semanticValues?.[0].id).toBe('a');
  });

  it('uses local when task has no semantic values', () => {
    const fromTask = { version: 1 as const, semanticValues: [] };
    const fromLs = { version: 1 as const, semanticValues: [sv('b', 'B')], persistedAt: 1000 };
    const merged = mergeProblemPayloadsForHydration(fromTask, fromLs, 0);
    expect(merged.semanticValues?.[0].id).toBe('b');
  });

  it('prefers localStorage when persistedAt is newer than task updated time', () => {
    const fromTask = { version: 1 as const, semanticValues: [sv('a', 'A')] };
    const fromLs = { version: 1 as const, semanticValues: [sv('b', 'B')], persistedAt: 2000 };
    const merged = mergeProblemPayloadsForHydration(fromTask, fromLs, 1000);
    expect(merged.semanticValues?.[0].id).toBe('b');
  });

  it('prefers task when task updated time is newer than LS persistedAt', () => {
    const fromTask = { version: 1 as const, semanticValues: [sv('a', 'A')] };
    const fromLs = { version: 1 as const, semanticValues: [sv('b', 'B')], persistedAt: 1000 };
    const merged = mergeProblemPayloadsForHydration(fromTask, fromLs, 2000);
    expect(merged.semanticValues?.[0].id).toBe('a');
  });
});

describe('normalizeProblemPayload (problem classification)', () => {
  it('keeps semanticValues when version is undefined', () => {
    const p = normalizeProblemPayload({
      semanticValues: [sv('x', 'X')],
    } as unknown);
    expect(p.semanticValues?.length).toBe(1);
    expect(p.semanticValues?.[0].label).toBe('X');
  });

  it('accepts version string "1"', () => {
    const p = normalizeProblemPayload({ version: '1', semanticValues: [] } as unknown);
    expect(p.version).toBe(1);
  });

  it('preserves persistedAt when present', () => {
    const p = normalizeProblemPayload({ version: 1, semanticValues: [], persistedAt: 42 });
    expect(p.persistedAt).toBe(42);
  });
});
