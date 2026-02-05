// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getNodesWithFallback, getMigrationMetrics, resetMigrationMetrics } from '../taskTreeMigrationHelpers';

describe('taskTreeMigrationHelpers', () => {
  beforeEach(() => {
    // Reset metrics before each test
    resetMigrationMetrics();
    // Clear console.warn mock
    vi.clearAllMocks();
  });

  describe('getNodesWithFallback', () => {
    it('should return nodes when available (new format)', () => {
      const taskTree = {
        id: 'test-1',
        label: 'Test',
        nodes: [
          { id: 'node-1', label: 'Node 1' },
          { id: 'node-2', label: 'Node 2' }
        ],
        data: [
          { id: 'data-1', label: 'Data 1' }
        ]
      };

      const result = getNodesWithFallback(taskTree, 'test-context');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('node-1');
      expect(result[1].id).toBe('node-2');
    });

    it('should return empty array when nodes not available but data exists (Phase 4A: no fallback)', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const taskTree = {
        id: 'test-2',
        label: 'Test',
        data: [
          { id: 'data-1', label: 'Data 1' },
          { id: 'data-2', label: 'Data 2' }
        ]
      };

      const result = getNodesWithFallback(taskTree, 'test-context');

      // ✅ Phase 4A: Should return empty array (no fallback to data)
      expect(result).toHaveLength(0);
      expect(result).toEqual([]);

      // ✅ Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[MIGRATION ERROR]'),
        expect.objectContaining({
          context: 'test-context',
          hasNodes: false,
          hasData: true,
          dataLength: 2
        })
      );

      consoleErrorSpy.mockRestore();
    });

    it('should return empty array when taskTree is null', () => {
      const result = getNodesWithFallback(null, 'test-context');
      expect(result).toEqual([]);
    });

    it('should return empty array when taskTree is undefined', () => {
      const result = getNodesWithFallback(undefined, 'test-context');
      expect(result).toEqual([]);
    });

    it('should return empty array when neither nodes nor data available', () => {
      const taskTree = {
        id: 'test-3',
        label: 'Test'
      };

      const result = getNodesWithFallback(taskTree, 'test-context');
      expect(result).toEqual([]);
    });

    it('should filter out falsy values', () => {
      const taskTree = {
        id: 'test-4',
        nodes: [
          { id: 'node-1', label: 'Node 1' },
          null,
          undefined,
          { id: 'node-2', label: 'Node 2' },
          false
        ]
      };

      const result = getNodesWithFallback(taskTree, 'test-context');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('node-1');
      expect(result[1].id).toBe('node-2');
    });

    it('should track metrics when using data fallback', () => {
      // Mock window object
      const mockWindow = {
        __migrationMetrics: {
          dataFallbackCount: 0,
          dataFallbackContexts: []
        }
      };
      (global as any).window = mockWindow;

      const taskTree = {
        id: 'test-5',
        data: [{ id: 'data-1' }]
      };

      getNodesWithFallback(taskTree, 'context-1');
      getNodesWithFallback(taskTree, 'context-2');
      getNodesWithFallback(taskTree, 'context-1'); // Same context again

      const metrics = getMigrationMetrics();
      expect(metrics.dataFallbackCount).toBe(3);
      expect(metrics.dataFallbackContexts).toEqual(['context-1', 'context-2']);
    });
  });

  describe('getMigrationMetrics', () => {
    it('should return default metrics when no fallback occurred', () => {
      const metrics = getMigrationMetrics();
      expect(metrics).toEqual({
        dataFallbackCount: 0,
        dataFallbackContexts: [],
        migrationComplete: true
      });
    });

    it('should return metrics with fallback count when fallback occurred', () => {
      // Mock window object
      const mockWindow = {
        __migrationMetrics: {
          dataFallbackCount: 5,
          dataFallbackContexts: ['context-1', 'context-2']
        }
      };
      (global as any).window = mockWindow;

      const metrics = getMigrationMetrics();
      expect(metrics.dataFallbackCount).toBe(5);
      expect(metrics.dataFallbackContexts).toEqual(['context-1', 'context-2']);
      expect(metrics.migrationComplete).toBe(false);
    });

    it('should return default metrics when window is undefined (Node.js environment)', () => {
      const originalWindow = (global as any).window;
      delete (global as any).window;

      const metrics = getMigrationMetrics();
      expect(metrics).toEqual({
        dataFallbackCount: 0,
        dataFallbackContexts: [],
        migrationComplete: true
      });

      (global as any).window = originalWindow;
    });
  });

  describe('resetMigrationMetrics', () => {
    it('should reset metrics to zero', () => {
      // Mock window object with existing metrics
      const mockWindow = {
        __migrationMetrics: {
          dataFallbackCount: 10,
          dataFallbackContexts: ['context-1', 'context-2', 'context-3']
        }
      };
      (global as any).window = mockWindow;

      resetMigrationMetrics();

      const metrics = getMigrationMetrics();
      expect(metrics.dataFallbackCount).toBe(0);
      expect(metrics.dataFallbackContexts).toEqual([]);
      expect(metrics.migrationComplete).toBe(true);
    });

    it('should handle reset when window is undefined', () => {
      const originalWindow = (global as any).window;
      delete (global as any).window;

      // Should not throw
      expect(() => resetMigrationMetrics()).not.toThrow();

      (global as any).window = originalWindow;
    });
  });
});
