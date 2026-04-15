// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Grammar } from '@components/GrammarEditor/types/grammarTypes';
import {
  registerGrammarFlowSnapshotGetter,
  getGrammarSnapshotForOpenTemplate,
} from '../grammarFlowEditorSnapshotRegistry';

const REGISTRY_KEY = '__grammarFlowGrammarGetters';

describe('grammarFlowEditorSnapshotRegistry', () => {
  let prev: unknown;

  beforeEach(() => {
    prev = (globalThis as Record<string, unknown>)[REGISTRY_KEY];
    delete (globalThis as Record<string, unknown>)[REGISTRY_KEY];
  });

  afterEach(() => {
    if (prev !== undefined) {
      (globalThis as Record<string, unknown>)[REGISTRY_KEY] = prev;
    } else {
      delete (globalThis as Record<string, unknown>)[REGISTRY_KEY];
    }
  });

  it('registers per-template getters and unregisters on cleanup', () => {
    const g: Grammar = {
      id: 'g1',
      name: 'test',
      nodes: [],
      edges: [],
      slots: [],
      semanticSets: [],
      metadata: { createdAt: 1, updatedAt: 1, version: '1.0.0' },
    };

    const unregister = registerGrammarFlowSnapshotGetter('tpl-a', () => g);
    expect(getGrammarSnapshotForOpenTemplate('tpl-a')).toBe(g);
    expect(getGrammarSnapshotForOpenTemplate('other')).toBeNull();

    unregister();
    expect(getGrammarSnapshotForOpenTemplate('tpl-a')).toBeNull();
  });
});
