import { describe, it, expect, vi } from 'vitest';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import {
  buildExistingRootDraftDedupKeys,
  dedupeRootDraftLabels,
  normalizeRootUseCaseDraftDisplay,
  normalizeRootUseCaseDraftDedupKey,
  parseRootUseCaseDraftSegmentsFallback,
  resolveRootUseCaseDraftForCreateAsync,
  ROOT_USE_CASE_BATCH_MAX,
  ROOT_USE_CASE_DRAFT_MIN_LLM_CHARS,
} from '../parseRootUseCaseDraft';

function stubUseCase(partial: Partial<AIAgentUseCase> & { id: string; label: string }): AIAgentUseCase {
  return {
    parent_id: null,
    sort_order: 0,
    refinement_prompt: '',
    style_id: 'cortese',
    payoff: '',
    dialogue: [],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
    ...partial,
  };
}

describe('parseRootUseCaseDraftSegmentsFallback', () => {
  it('splits on semicolon', () => {
    expect(parseRootUseCaseDraftSegmentsFallback('a;b;c')).toEqual(['a', 'b', 'c']);
  });

  it('splits on comma', () => {
    expect(parseRootUseCaseDraftSegmentsFallback('a, b, c')).toEqual(['a', 'b', 'c']);
  });

  it('splits on newlines', () => {
    expect(parseRootUseCaseDraftSegmentsFallback('line1\nline2')).toEqual(['line1', 'line2']);
  });

  it('trims and drops empties', () => {
    expect(parseRootUseCaseDraftSegmentsFallback(' x ;  ; y ')).toEqual(['x', 'y']);
  });
});

describe('normalizeRootUseCaseDraftDisplay', () => {
  it('renders one line per segment', () => {
    expect(normalizeRootUseCaseDraftDisplay('foo;bar')).toBe('foo\nbar');
  });
});

describe('dedupeRootDraftLabels', () => {
  it('skips catalog and batch duplicates', () => {
    const keys = buildExistingRootDraftDedupKeys([
      stubUseCase({ id: '1', label: 'Existing', notes: { behavior: 'x', tone: '' } }),
    ]);
    const { toCreate, skippedCount } = dedupeRootDraftLabels(
      ['Existing', 'New one', 'New one'],
      keys
    );
    expect(toCreate).toEqual(['New one']);
    expect(skippedCount).toBe(2);
  });
});

describe('resolveRootUseCaseDraftForCreateAsync', () => {
  it('calls splitApi when draft is long enough', async () => {
    const splitApi = vi.fn().mockResolvedValue(['Alpha', 'Beta']);
    const draft = 'x'.repeat(ROOT_USE_CASE_DRAFT_MIN_LLM_CHARS);
    const result = await resolveRootUseCaseDraftForCreateAsync({
      raw: draft,
      catalog: [],
      splitApi,
    });
    expect(splitApi).toHaveBeenCalledWith(draft);
    expect(result.usedLlm).toBe(true);
    expect(result.labels).toEqual(['Alpha', 'Beta']);
  });

  it('falls back to punctuation split when splitApi throws', async () => {
    const splitApi = vi.fn().mockRejectedValue(new Error('fail'));
    const result = await resolveRootUseCaseDraftForCreateAsync({
      raw: 'one; two',
      catalog: [],
      splitApi,
    });
    expect(result.usedLlm).toBe(true);
    expect(result.labels).toEqual(['one', 'two']);
  });

  it('uses single segment for short draft without splitApi', async () => {
    const result = await resolveRootUseCaseDraftForCreateAsync({
      raw: 'short',
      catalog: [],
    });
    expect(result.labels).toEqual(['short']);
    expect(result.usedLlm).toBe(false);
  });

  it('normalizes dedup keys without punctuation', () => {
    expect(normalizeRootUseCaseDraftDedupKey('Hello, World!')).toBe('hello world');
  });
});

describe('ROOT_USE_CASE_BATCH_MAX', () => {
  it('is a positive cap', () => {
    expect(ROOT_USE_CASE_BATCH_MAX).toBe(30);
  });
});
