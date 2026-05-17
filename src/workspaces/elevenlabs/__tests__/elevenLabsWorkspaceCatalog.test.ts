import { describe, expect, it } from 'vitest';
import { filterElevenLabsWorkspaceEntries } from '../elevenLabsWorkspaceCatalog';
import type { ManualCatalogEntry } from '@domain/backendCatalog/catalogTypes';

const base = (over: Partial<ManualCatalogEntry>): ManualCatalogEntry => ({
  id: 'x',
  label: 't',
  endpointUrl: '',
  frozenMeta: {
    lastImportedAt: null,
    specSourceUrl: null,
    contentHash: null,
    importState: 'none',
  },
  lastStructuralEditAt: '2026-01-01',
  ...over,
});

describe('filterElevenLabsWorkspaceEntries', () => {
  it('filters by scope, kind and nodeId', () => {
    const entries = [
      base({
        id: 'a',
        elevenLabsWorkspaceTool: { kind: 'webhook', scope: 'node', nodeId: 'n1', agentId: 'ag' },
      }),
      base({
        id: 'b',
        elevenLabsWorkspaceTool: { kind: 'webhook', scope: 'agent', agentId: 'ag' },
      }),
      base({ id: 'c' }),
    ];
    expect(
      filterElevenLabsWorkspaceEntries(entries, { scope: 'node', nodeId: 'n1', kind: 'webhook' }).map(
        (e) => e.id
      )
    ).toEqual(['a']);
  });
});
