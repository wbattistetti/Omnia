import { describe, it, expect } from 'vitest';
import { rebuildCatalog } from '../rebuildCatalog';
import type { DerivedBackendRef, ManualCatalogEntry } from '../catalogTypes';

const emptyFrozen = () => ({
  lastImportedAt: null as string | null,
  specSourceUrl: null as string | null,
  contentHash: null as string | null,
  importState: 'none' as const,
});

describe('rebuildCatalog dedup', () => {
  it('merges graph + manual same key with two badges', () => {
    const derived: DerivedBackendRef[] = [
      {
        source: 'graph',
        taskId: 't1',
        method: 'GET',
        pathnameDisplay: '/slots',
        endpointUrlForImport: 'http://localhost:3110/slots',
        label: 'g',
        frozenMeta: { ...emptyFrozen(), specSourceUrl: 'http://localhost:3110/slots' },
        lastStructuralEditAt: '2026-01-01',
      },
    ];
    const manual: ManualCatalogEntry[] = [
      {
        id: 'm1',
        label: 'Manuale',
        method: 'GET',
        endpointUrl: 'http://localhost:3110/slots',
        lastStructuralEditAt: '2026-01-02',
        frozenMeta: { ...emptyFrozen(), specSourceUrl: 'http://localhost:3110/slots' },
      },
    ];
    const { rows } = rebuildCatalog({ derived, manualEntries: manual });
    expect(rows).toHaveLength(1);
    expect(rows[0].sources.graph).toBe(true);
    expect(rows[0].sources.manual).toBe(true);
    expect(rows[0].bindings).toHaveLength(2);
  });

  it('merges two graph tasks same endpoint into one row two bindings', () => {
    const url = 'http://x/api';
    const derived: DerivedBackendRef[] = [
      {
        source: 'graph',
        taskId: 'a',
        method: 'POST',
        pathnameDisplay: '/api',
        endpointUrlForImport: url,
        label: 'a',
        frozenMeta: { ...emptyFrozen(), specSourceUrl: url },
        lastStructuralEditAt: '2026-01-01',
      },
      {
        source: 'graph',
        taskId: 'b',
        method: 'POST',
        pathnameDisplay: '/api',
        endpointUrlForImport: url,
        label: 'b',
        frozenMeta: { ...emptyFrozen(), specSourceUrl: url },
        lastStructuralEditAt: '2026-01-01',
      },
    ];
    const { rows } = rebuildCatalog({ derived, manualEntries: [] });
    expect(rows).toHaveLength(1);
    expect(rows[0].bindings).toHaveLength(2);
  });
});
