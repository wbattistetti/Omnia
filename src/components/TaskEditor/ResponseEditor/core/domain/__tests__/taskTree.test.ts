// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getMainNodes,
  getSubNodes,
  hasMultipleMainNodes,
  findNodeByIndices,
} from '../taskTree';
import * as migrationHelpers from '../../../../../../utils/taskTreeMigrationHelpers';
import type { TaskTree } from '../../../../../../types/taskTypes';

describe('Domain: TaskTree Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMainNodes', () => {
    it('should return empty array for null taskTree', () => {
      const result = getMainNodes(null);
      expect(result).toEqual([]);
    });

    it('should return empty array for undefined taskTree', () => {
      const result = getMainNodes(undefined);
      expect(result).toEqual([]);
    });

    it('should use getNodesWithFallback helper', () => {
      const getNodesWithFallbackSpy = vi.spyOn(migrationHelpers, 'getNodesWithFallback');
      const mockNodes = [{ id: 'node-1', label: 'Node 1' }];
      getNodesWithFallbackSpy.mockReturnValue(mockNodes);

      const taskTree: TaskTree = {
        id: 'test-1',
        nodes: mockNodes as any,
      };

      const result = getMainNodes(taskTree);

      expect(getNodesWithFallbackSpy).toHaveBeenCalledWith(taskTree, 'getdataList');
      expect(result).toEqual(mockNodes);
      expect(result).toHaveLength(1);

      getNodesWithFallbackSpy.mockRestore();
    });

    it('should return nodes when available', () => {
      const mockNodes = [
        { id: 'node-1', label: 'Node 1' },
        { id: 'node-2', label: 'Node 2' },
      ];
      vi.spyOn(migrationHelpers, 'getNodesWithFallback').mockReturnValue(mockNodes);

      const taskTree: TaskTree = {
        id: 'test-2',
        nodes: mockNodes as any,
      };

      const result = getMainNodes(taskTree);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('node-1');
      expect(result[1].id).toBe('node-2');
    });

    it('should return empty array when no nodes', () => {
      vi.spyOn(migrationHelpers, 'getNodesWithFallback').mockReturnValue([]);

      const taskTree: TaskTree = {
        id: 'test-3',
        nodes: [],
      };

      const result = getMainNodes(taskTree);
      expect(result).toEqual([]);
    });
  });

  describe('getSubNodes', () => {
    it('should return empty array for null main', () => {
      const result = getSubNodes(null);
      expect(result).toEqual([]);
    });

    it('should return empty array for undefined main', () => {
      const result = getSubNodes(undefined);
      expect(result).toEqual([]);
    });

    it('should return empty array when subNodes is not an array', () => {
      const main = { id: 'main-1', label: 'Main 1' };
      const result = getSubNodes(main);
      expect(result).toEqual([]);
    });

    it('should return empty array when subNodes is null', () => {
      const main = { id: 'main-1', subNodes: null };
      const result = getSubNodes(main);
      expect(result).toEqual([]);
    });

    it('should return subNodes when available', () => {
      const subNodes = [
        { id: 'sub-1', label: 'Sub 1' },
        { id: 'sub-2', label: 'Sub 2' },
      ];
      const main = { id: 'main-1', subNodes };
      const result = getSubNodes(main);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('sub-1');
      expect(result[1].id).toBe('sub-2');
    });

    it('should filter out falsy values', () => {
      const subNodes = [
        { id: 'sub-1', label: 'Sub 1' },
        null,
        { id: 'sub-2', label: 'Sub 2' },
        undefined,
        { id: 'sub-3', label: 'Sub 3' },
      ];
      const main = { id: 'main-1', subNodes };
      const result = getSubNodes(main);

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('sub-1');
      expect(result[1].id).toBe('sub-2');
      expect(result[2].id).toBe('sub-3');
    });

    it('should return empty array for empty subNodes', () => {
      const main = { id: 'main-1', subNodes: [] };
      const result = getSubNodes(main);
      expect(result).toEqual([]);
    });
  });

  describe('hasMultipleMainNodes', () => {
    it('should return false for null taskTree', () => {
      const result = hasMultipleMainNodes(null);
      expect(result).toBe(false);
    });

    it('should return false for undefined taskTree', () => {
      const result = hasMultipleMainNodes(undefined);
      expect(result).toBe(false);
    });

    it('should return false for 0 nodes', () => {
      vi.spyOn(migrationHelpers, 'getNodesWithFallback').mockReturnValue([]);
      const taskTree: TaskTree = { id: 'test', nodes: [] };
      const result = hasMultipleMainNodes(taskTree);
      expect(result).toBe(false);
    });

    it('should return false for 1 node', () => {
      const mockNodes = [{ id: 'node-1', label: 'Node 1' }];
      vi.spyOn(migrationHelpers, 'getNodesWithFallback').mockReturnValue(mockNodes);
      const taskTree: TaskTree = { id: 'test', nodes: mockNodes as any };
      const result = hasMultipleMainNodes(taskTree);
      expect(result).toBe(false);
    });

    it('should return true for 2 nodes', () => {
      const mockNodes = [
        { id: 'node-1', label: 'Node 1' },
        { id: 'node-2', label: 'Node 2' },
      ];
      vi.spyOn(migrationHelpers, 'getNodesWithFallback').mockReturnValue(mockNodes);
      const taskTree: TaskTree = { id: 'test', nodes: mockNodes as any };
      const result = hasMultipleMainNodes(taskTree);
      expect(result).toBe(true);
    });

    it('should return true for 3+ nodes', () => {
      const mockNodes = [
        { id: 'node-1', label: 'Node 1' },
        { id: 'node-2', label: 'Node 2' },
        { id: 'node-3', label: 'Node 3' },
      ];
      vi.spyOn(migrationHelpers, 'getNodesWithFallback').mockReturnValue(mockNodes);
      const taskTree: TaskTree = { id: 'test', nodes: mockNodes as any };
      const result = hasMultipleMainNodes(taskTree);
      expect(result).toBe(true);
    });
  });

  describe('findNodeByIndices', () => {
    beforeEach(() => {
      vi.spyOn(migrationHelpers, 'getNodesWithFallback').mockImplementation((taskTree: any) => {
        return taskTree?.nodes || [];
      });
    });

    it('should return null for null taskTree', () => {
      const result = findNodeByIndices(null, 0, null);
      expect(result).toBeNull();
    });

    it('should return null for undefined taskTree', () => {
      const result = findNodeByIndices(undefined, 0, null);
      expect(result).toBeNull();
    });

    it('should return null for empty nodes', () => {
      const taskTree: TaskTree = { id: 'test', nodes: [] };
      const result = findNodeByIndices(taskTree, 0, null);
      expect(result).toBeNull();
    });

    it('should return main node when subIndex is null', () => {
      const mainNode = { id: 'main-1', label: 'Main 1' };
      const taskTree: TaskTree = {
        id: 'test',
        nodes: [mainNode as any],
      };
      const result = findNodeByIndices(taskTree, 0, null);
      expect(result).toEqual(mainNode);
    });

    it('should return main node when subIndex is undefined', () => {
      const mainNode = { id: 'main-1', label: 'Main 1' };
      const taskTree: TaskTree = {
        id: 'test',
        nodes: [mainNode as any],
      };
      const result = findNodeByIndices(taskTree, 0, undefined as any);
      expect(result).toEqual(mainNode);
    });

    it('should return correct main node for valid mainIndex', () => {
      const nodes = [
        { id: 'main-1', label: 'Main 1' },
        { id: 'main-2', label: 'Main 2' },
      ];
      const taskTree: TaskTree = { id: 'test', nodes: nodes as any };
      const result = findNodeByIndices(taskTree, 1, null);
      expect(result).toEqual(nodes[1]);
    });

    it('should return first node when mainIndex is out of bounds (negative)', () => {
      const mainNode = { id: 'main-1', label: 'Main 1' };
      const taskTree: TaskTree = {
        id: 'test',
        nodes: [mainNode as any],
      };
      const result = findNodeByIndices(taskTree, -1, null);
      expect(result).toEqual(mainNode);
    });

    it('should return first node when mainIndex is out of bounds (too large)', () => {
      const mainNode = { id: 'main-1', label: 'Main 1' };
      const taskTree: TaskTree = {
        id: 'test',
        nodes: [mainNode as any],
      };
      const result = findNodeByIndices(taskTree, 999, null);
      expect(result).toEqual(mainNode);
    });

    it('should return first node when mainIndex is NaN', () => {
      const mainNode = { id: 'main-1', label: 'Main 1' };
      const taskTree: TaskTree = {
        id: 'test',
        nodes: [mainNode as any],
      };
      const result = findNodeByIndices(taskTree, NaN as any, null);
      expect(result).toEqual(mainNode);
    });

    it('should return sub node when subIndex is valid', () => {
      const subNode = { id: 'sub-1', label: 'Sub 1' };
      const mainNode = {
        id: 'main-1',
        label: 'Main 1',
        subNodes: [subNode],
      };
      const taskTree: TaskTree = {
        id: 'test',
        nodes: [mainNode as any],
      };
      const result = findNodeByIndices(taskTree, 0, 0);
      expect(result).toEqual(subNode);
    });

    it('should return main node when subIndex is valid but no subNodes', () => {
      const mainNode = { id: 'main-1', label: 'Main 1' };
      const taskTree: TaskTree = {
        id: 'test',
        nodes: [mainNode as any],
      };
      const result = findNodeByIndices(taskTree, 0, 0);
      expect(result).toEqual(mainNode);
    });

    it('should return correct sub node for valid indices', () => {
      const subNodes = [
        { id: 'sub-1', label: 'Sub 1' },
        { id: 'sub-2', label: 'Sub 2' },
      ];
      const mainNode = {
        id: 'main-1',
        label: 'Main 1',
        subNodes,
      };
      const taskTree: TaskTree = {
        id: 'test',
        nodes: [mainNode as any],
      };
      const result = findNodeByIndices(taskTree, 0, 1);
      expect(result).toEqual(subNodes[1]);
    });

    it('should return main node when subIndex is out of bounds (negative)', () => {
      const subNode = { id: 'sub-1', label: 'Sub 1' };
      const mainNode = {
        id: 'main-1',
        label: 'Main 1',
        subNodes: [subNode],
      };
      const taskTree: TaskTree = {
        id: 'test',
        nodes: [mainNode as any],
      };
      const result = findNodeByIndices(taskTree, 0, -1);
      expect(result).toEqual(mainNode);
    });

    it('should return main node when subIndex is out of bounds (too large)', () => {
      const subNode = { id: 'sub-1', label: 'Sub 1' };
      const mainNode = {
        id: 'main-1',
        label: 'Main 1',
        subNodes: [subNode],
      };
      const taskTree: TaskTree = {
        id: 'test',
        nodes: [mainNode as any],
      };
      const result = findNodeByIndices(taskTree, 0, 999);
      expect(result).toEqual(mainNode);
    });

    it('should return main node when subIndex is NaN', () => {
      const mainNode = { id: 'main-1', label: 'Main 1' };
      const taskTree: TaskTree = {
        id: 'test',
        nodes: [mainNode as any],
      };
      const result = findNodeByIndices(taskTree, 0, NaN as any);
      expect(result).toEqual(mainNode);
    });

    it('should handle multiple main nodes with sub nodes', () => {
      const subNode1 = { id: 'sub-1-1', label: 'Sub 1-1' };
      const subNode2 = { id: 'sub-2-1', label: 'Sub 2-1' };
      const nodes = [
        { id: 'main-1', label: 'Main 1', subNodes: [subNode1] },
        { id: 'main-2', label: 'Main 2', subNodes: [subNode2] },
      ];
      const taskTree: TaskTree = { id: 'test', nodes: nodes as any };
      
      const result1 = findNodeByIndices(taskTree, 0, 0);
      const result2 = findNodeByIndices(taskTree, 1, 0);
      
      expect(result1).toEqual(subNode1);
      expect(result2).toEqual(subNode2);
    });
  });
});
