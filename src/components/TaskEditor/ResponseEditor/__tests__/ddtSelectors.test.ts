// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getdataList } from '../ddtSelectors';
import * as migrationHelpers from '@utils/taskTreeMigrationHelpers';

describe('ddtSelectors - Migration Phase 0', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use getNodesWithFallback helper', () => {
    const getNodesWithFallbackSpy = vi.spyOn(migrationHelpers, 'getNodesWithFallback');

    const taskTree = {
      id: 'test-1',
      nodes: [
        { id: 'node-1', label: 'Node 1' }
      ]
    };

    const result = getdataList(taskTree);

    // ✅ Verify helper was called
    expect(getNodesWithFallbackSpy).toHaveBeenCalledWith(taskTree, 'getdataList');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('node-1');

    getNodesWithFallbackSpy.mockRestore();
  });

  it('should return nodes when available', () => {
    const taskTree = {
      id: 'test-2',
      nodes: [
        { id: 'node-1', label: 'Node 1' },
        { id: 'node-2', label: 'Node 2' }
      ]
    };

    const result = getdataList(taskTree);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('node-1');
    expect(result[1].id).toBe('node-2');
  });

  it('should return empty array when nodes not available but data exists (Phase 4A: no fallback)', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const taskTree = {
      id: 'test-3',
      data: [
        { id: 'data-1', label: 'Data 1' }
      ]
    };

    const result = getdataList(taskTree);

    // ✅ Phase 4A: Should return empty array (no fallback to data)
    expect(result).toHaveLength(0);
    expect(result).toEqual([]);

    // ✅ Verify error was logged (via helper)
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('should return empty array when taskTree is null', () => {
    const result = getdataList(null);
    expect(result).toEqual([]);
  });

  it('should return empty array when taskTree is undefined', () => {
    const result = getdataList(undefined);
    expect(result).toEqual([]);
  });

  it('should prefer nodes over data when both available', () => {
    const taskTree = {
      id: 'test-4',
      nodes: [
        { id: 'node-1', label: 'Node 1' }
      ],
      data: [
        { id: 'data-1', label: 'Data 1' }
      ]
    };

    const result = getdataList(taskTree);

    // ✅ Should prefer nodes
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('node-1');
    expect(result[0].label).toBe('Node 1');
  });
});
