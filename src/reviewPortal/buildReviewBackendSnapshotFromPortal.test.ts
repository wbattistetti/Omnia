import { describe, expect, it } from 'vitest';
import { buildReviewBackendSnapshotFromPortal } from './buildReviewBackendSnapshotFromPortal';

describe('buildReviewBackendSnapshotFromPortal', () => {
  it('includes manual entries added in portal', () => {
    const snap = buildReviewBackendSnapshotFromPortal({
      taskInstanceId: 'agent-1',
      taskLabel: 'Agent',
      manualEntries: [
        {
          id: 'be-1',
          label: 'Prenota',
          method: 'POST',
          endpointUrl: 'https://api.example.com/book',
          creationMode: 'import',
          importSpecRevealed: true,
          frozenMeta: {
            lastImportedAt: null,
            specSourceUrl: null,
            contentHash: null,
            importState: 'none',
          },
          lastStructuralEditAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      backendPlaceholders: [],
      previousSnapshot: null,
    });
    expect(snap?.manualEntries).toHaveLength(1);
    expect(snap?.manualEntries?.[0]?.id).toBe('be-1');
    expect(snap?.catalogRows.some((r) => r.sources.manual)).toBe(true);
  });

  it('preserves derived graph/tools rows from previous snapshot', () => {
    const snap = buildReviewBackendSnapshotFromPortal({
      taskInstanceId: 'agent-1',
      taskLabel: 'Agent',
      manualEntries: [],
      backendPlaceholders: [],
      previousSnapshot: {
        catalogRows: [
          {
            key: 'g1',
            label: 'Grafo',
            method: 'GET',
            pathnameDisplay: '/x',
            sources: { graph: true, tools: false, manual: false },
            bindings: [],
          },
        ],
        structuredPlaceholders: [],
      },
    });
    expect(snap?.catalogRows).toHaveLength(1);
    expect(snap?.catalogRows[0]?.sources.graph).toBe(true);
  });

  it('is stable when rebuilt from the same inputs', () => {
    const previousSnapshot = {
      catalogRows: [
        {
          key: 'g1',
          label: 'Grafo',
          method: 'GET',
          pathnameDisplay: '/x',
          sources: { graph: true, tools: false, manual: false },
          bindings: [],
        },
      ],
      structuredPlaceholders: [{ id: 'p1', definitionId: 'user_utterance_in' }],
    };
    const params = {
      taskInstanceId: 'agent-1',
      taskLabel: 'Agent',
      manualEntries: [] as const,
      backendPlaceholders: [{ id: 'p1', definitionId: 'user_utterance_in' }],
      previousSnapshot,
    };
    const a = buildReviewBackendSnapshotFromPortal(params);
    const b = buildReviewBackendSnapshotFromPortal(params);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
