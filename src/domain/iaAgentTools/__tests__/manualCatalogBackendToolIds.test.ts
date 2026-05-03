/**
 * Id Backend Call del catalogo manuale progetto + lista ConvAI persistita.
 */

import { describe, expect, it } from 'vitest';
import {
  extractManualCatalogBackendTaskIdsFromProjectData,
  mergeConvaiBackendToolIdLists,
} from '../manualCatalogBackendToolIds';

describe('manualCatalogBackendToolIds', () => {
  it('mergeConvaiBackendToolIdLists preserves order and dedupes', () => {
    expect(mergeConvaiBackendToolIdLists(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('extractManualCatalogBackendTaskIdsFromProjectData reads manualEntries ids', () => {
    const ids = extractManualCatalogBackendTaskIdsFromProjectData({
      backendCatalog: {
        manualEntries: [{ id: ' x ' }, { id: 'y' }, { id: 'y' }],
      },
    });
    expect(ids).toEqual(['x', 'y']);
  });

  it('extractManualCatalogBackendTaskIdsFromProjectData returns empty on invalid input', () => {
    expect(extractManualCatalogBackendTaskIdsFromProjectData(null)).toEqual([]);
    expect(extractManualCatalogBackendTaskIdsFromProjectData({})).toEqual([]);
  });
});
