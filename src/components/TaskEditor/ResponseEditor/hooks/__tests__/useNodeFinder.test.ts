// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNodeFinder } from '@responseEditor/features/node-editing/hooks/useNodeFinder';
import type { TaskTree } from '@types/taskTypes';

/**
 * Tests for useNodeFinder
 *
 * This hook provides findAndSelectNodeById function for finding and selecting nodes by ID.
 * We test observable behaviors: node finding, selection triggering, and fallback logic.
 *
 * WHAT WE TEST:
 * - Finding and selecting main node by ID
 * - Finding and selecting sub node by ID
 * - Not finding node (no selection triggered)
 * - Using id/templateId/_id as fallback for node identification
 * - Fallback to taskTreeRef.current when taskTree is null
 * - Edge cases (non-existent ID, null/undefined TaskTree, nodes without ID)
 *
 * WHY IT'S IMPORTANT:
 * - Node finding is critical for navigation and programmatic selection
 * - Used by parser handlers to navigate to specific nodes
 * - Incorrect finding can break user workflows
 * - Fallback logic (id/templateId/_id) ensures compatibility with different data structures
 *
 * MOCKS:
 * - getdataList, getSubDataList (ddtSelectors) - mocked to return predictable values
 * - handleSelectMain, handleSelectSub - mocked to verify calls
 */

// Mock ddtSelectors
vi.mock('../../ddtSelectors', () => ({
  getdataList: vi.fn((taskTree: any) => {
    if (!taskTree) return [];
    if (Array.isArray(taskTree.nodes)) {
      return taskTree.nodes.filter(Boolean);
    }
    return [];
  }),
  getSubDataList: vi.fn((main: any) => {
    if (!main) return [];
    if (Array.isArray(main.subNodes)) {
      return main.subNodes.filter(Boolean);
    }
    return [];
  }),
}));

import { getdataList, getSubDataList } from '../../ddtSelectors';

describe('useNodeFinder', () => {
  let handleSelectMain: ReturnType<typeof vi.fn>;
  let handleSelectSub: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handleSelectMain = vi.fn();
    handleSelectSub = vi.fn();
  });

  describe('finding main nodes', () => {
    it('should find and select main node by id', () => {
      const taskTree: TaskTree = {
        nodes: [
          { id: 'main-1', label: 'Main 1' },
          { id: 'main-2', label: 'Main 2' },
        ],
      };

      const taskTreeRef = { current: null };
      const { result } = renderHook(() =>
        useNodeFinder({
          taskTree,
          taskTreeRef: taskTreeRef as React.MutableRefObject<TaskTree | null | undefined>,
          handleSelectMain,
          handleSelectSub,
        })
      );

      act(() => {
        result.current('main-2');
      });

      expect(handleSelectMain).toHaveBeenCalledWith(1);
      expect(handleSelectSub).toHaveBeenCalledWith(undefined);
      expect(handleSelectMain).toHaveBeenCalledTimes(1);
      expect(handleSelectSub).toHaveBeenCalledTimes(1);
    });

    it('should find and select main node by templateId when id is missing', () => {
      const taskTree: TaskTree = {
        nodes: [
          { id: 'main-1', label: 'Main 1' },
          { templateId: 'main-2-template', label: 'Main 2' },
        ],
      };

      const taskTreeRef = { current: null };
      const { result } = renderHook(() =>
        useNodeFinder({
          taskTree,
          taskTreeRef: taskTreeRef as React.MutableRefObject<TaskTree | null | undefined>,
          handleSelectMain,
          handleSelectSub,
        })
      );

      act(() => {
        result.current('main-2-template');
      });

      expect(handleSelectMain).toHaveBeenCalledWith(1);
      expect(handleSelectSub).toHaveBeenCalledWith(undefined);
    });

    it('should find and select main node by _id when id and templateId are missing', () => {
      const taskTree: TaskTree = {
        nodes: [
          { id: 'main-1', label: 'Main 1' },
          { _id: 'main-2-legacy', label: 'Main 2' },
        ],
      };

      const taskTreeRef = { current: null };
      const { result } = renderHook(() =>
        useNodeFinder({
          taskTree,
          taskTreeRef: taskTreeRef as React.MutableRefObject<TaskTree | null | undefined>,
          handleSelectMain,
          handleSelectSub,
        })
      );

      act(() => {
        result.current('main-2-legacy');
      });

      expect(handleSelectMain).toHaveBeenCalledWith(1);
      expect(handleSelectSub).toHaveBeenCalledWith(undefined);
    });

    it('should prefer id over templateId and _id', () => {
      const taskTree: TaskTree = {
        nodes: [
          { id: 'main-1', templateId: 'template-1', _id: 'legacy-1', label: 'Main 1' },
        ],
      };

      const taskTreeRef = { current: null };
      const { result } = renderHook(() =>
        useNodeFinder({
          taskTree,
          taskTreeRef: taskTreeRef as React.MutableRefObject<TaskTree | null | undefined>,
          handleSelectMain,
          handleSelectSub,
        })
      );

      act(() => {
        result.current('main-1');
      });

      expect(handleSelectMain).toHaveBeenCalledWith(0);
    });
  });

  describe('finding sub nodes', () => {
    it('should find and select sub node by id', () => {
      const taskTree: TaskTree = {
        nodes: [
          {
            id: 'main-1',
            label: 'Main 1',
            subNodes: [
              { id: 'sub-1', label: 'Sub 1' },
              { id: 'sub-2', label: 'Sub 2' },
            ],
          },
        ],
      };

      const taskTreeRef = { current: null };
      const { result } = renderHook(() =>
        useNodeFinder({
          taskTree,
          taskTreeRef: taskTreeRef as React.MutableRefObject<TaskTree | null | undefined>,
          handleSelectMain,
          handleSelectSub,
        })
      );

      act(() => {
        result.current('sub-2');
      });

      expect(handleSelectMain).toHaveBeenCalledWith(0);
      expect(handleSelectSub).toHaveBeenCalledWith(1, 0);
    });

    it('should find and select sub node by templateId when id is missing', () => {
      const taskTree: TaskTree = {
        nodes: [
          {
            id: 'main-1',
            label: 'Main 1',
            subNodes: [
              { id: 'sub-1', label: 'Sub 1' },
              { templateId: 'sub-2-template', label: 'Sub 2' },
            ],
          },
        ],
      };

      const taskTreeRef = { current: null };
      const { result } = renderHook(() =>
        useNodeFinder({
          taskTree,
          taskTreeRef: taskTreeRef as React.MutableRefObject<TaskTree | null | undefined>,
          handleSelectMain,
          handleSelectSub,
        })
      );

      act(() => {
        result.current('sub-2-template');
      });

      expect(handleSelectMain).toHaveBeenCalledWith(0);
      expect(handleSelectSub).toHaveBeenCalledWith(1, 0);
    });

    it('should find and select sub node by _id when id and templateId are missing', () => {
      const taskTree: TaskTree = {
        nodes: [
          {
            id: 'main-1',
            label: 'Main 1',
            subNodes: [
              { id: 'sub-1', label: 'Sub 1' },
              { _id: 'sub-2-legacy', label: 'Sub 2' },
            ],
          },
        ],
      };

      const taskTreeRef = { current: null };
      const { result } = renderHook(() =>
        useNodeFinder({
          taskTree,
          taskTreeRef: taskTreeRef as React.MutableRefObject<TaskTree | null | undefined>,
          handleSelectMain,
          handleSelectSub,
        })
      );

      act(() => {
        result.current('sub-2-legacy');
      });

      expect(handleSelectMain).toHaveBeenCalledWith(0);
      expect(handleSelectSub).toHaveBeenCalledWith(1, 0);
    });

    it('should find sub node in second main node', () => {
      const taskTree: TaskTree = {
        nodes: [
          {
            id: 'main-1',
            label: 'Main 1',
            subNodes: [{ id: 'sub-1', label: 'Sub 1' }],
          },
          {
            id: 'main-2',
            label: 'Main 2',
            subNodes: [{ id: 'sub-2', label: 'Sub 2' }],
          },
        ],
      };

      const taskTreeRef = { current: null };
      const { result } = renderHook(() =>
        useNodeFinder({
          taskTree,
          taskTreeRef: taskTreeRef as React.MutableRefObject<TaskTree | null | undefined>,
          handleSelectMain,
          handleSelectSub,
        })
      );

      act(() => {
        result.current('sub-2');
      });

      expect(handleSelectMain).toHaveBeenCalledWith(1);
      expect(handleSelectSub).toHaveBeenCalledWith(0, 1);
    });
  });

  describe('not finding nodes', () => {
    it('should not trigger selection when node ID does not exist', () => {
      const taskTree: TaskTree = {
        nodes: [
          { id: 'main-1', label: 'Main 1' },
        ],
      };

      const taskTreeRef = { current: null };
      const { result } = renderHook(() =>
        useNodeFinder({
          taskTree,
          taskTreeRef: taskTreeRef as React.MutableRefObject<TaskTree | null | undefined>,
          handleSelectMain,
          handleSelectSub,
        })
      );

      act(() => {
        result.current('non-existent-id');
      });

      expect(handleSelectMain).not.toHaveBeenCalled();
      expect(handleSelectSub).not.toHaveBeenCalled();
    });

    it('should not trigger selection when TaskTree is empty', () => {
      const taskTree: TaskTree = {
        nodes: [],
      };

      const taskTreeRef = { current: null };
      const { result } = renderHook(() =>
        useNodeFinder({
          taskTree,
          taskTreeRef: taskTreeRef as React.MutableRefObject<TaskTree | null | undefined>,
          handleSelectMain,
          handleSelectSub,
        })
      );

      act(() => {
        result.current('any-id');
      });

      expect(handleSelectMain).not.toHaveBeenCalled();
      expect(handleSelectSub).not.toHaveBeenCalled();
    });
  });

  describe('fallback logic', () => {
    it('should use taskTreeRef.current when taskTree is null', () => {
      const taskTreeRef = {
        current: {
          nodes: [
            { id: 'main-1', label: 'Main 1' },
          ],
        },
      };

      const { result } = renderHook(() =>
        useNodeFinder({
          taskTree: null,
          taskTreeRef: taskTreeRef as React.MutableRefObject<TaskTree | null | undefined>,
          handleSelectMain,
          handleSelectSub,
        })
      );

      act(() => {
        result.current('main-1');
      });

      expect(getdataList).toHaveBeenCalledWith(taskTreeRef.current);
      expect(handleSelectMain).toHaveBeenCalledWith(0);
    });

    it('should prefer taskTreeRef.current over taskTree', () => {
      const taskTree: TaskTree = {
        nodes: [{ id: 'main-from-prop', label: 'From Prop' }],
      };

      const taskTreeRef = {
        current: {
          nodes: [{ id: 'main-from-ref', label: 'From Ref' }],
        },
      };

      const { result } = renderHook(() =>
        useNodeFinder({
          taskTree,
          taskTreeRef: taskTreeRef as React.MutableRefObject<TaskTree | null | undefined>,
          handleSelectMain,
          handleSelectSub,
        })
      );

      act(() => {
        result.current('main-from-ref');
      });

      expect(getdataList).toHaveBeenCalledWith(taskTreeRef.current);
      expect(handleSelectMain).toHaveBeenCalledWith(0);
    });

    it('should use taskTree when taskTreeRef.current is null', () => {
      const taskTree: TaskTree = {
        nodes: [{ id: 'main-1', label: 'Main 1' }],
      };

      const taskTreeRef = { current: null };

      const { result } = renderHook(() =>
        useNodeFinder({
          taskTree,
          taskTreeRef: taskTreeRef as React.MutableRefObject<TaskTree | null | undefined>,
          handleSelectMain,
          handleSelectSub,
        })
      );

      act(() => {
        result.current('main-1');
      });

      expect(getdataList).toHaveBeenCalledWith(taskTree);
      expect(handleSelectMain).toHaveBeenCalledWith(0);
    });
  });

  describe('edge cases', () => {
    it('should handle undefined taskTree', () => {
      const taskTreeRef = {
        current: {
          nodes: [{ id: 'main-1', label: 'Main 1' }],
        },
      };

      const { result } = renderHook(() =>
        useNodeFinder({
          taskTree: undefined,
          taskTreeRef: taskTreeRef as React.MutableRefObject<TaskTree | null | undefined>,
          handleSelectMain,
          handleSelectSub,
        })
      );

      act(() => {
        result.current('main-1');
      });

      expect(getdataList).toHaveBeenCalledWith(taskTreeRef.current);
      expect(handleSelectMain).toHaveBeenCalledWith(0);
    });

    it('should handle nodes without id, templateId, or _id', () => {
      const taskTree: TaskTree = {
        nodes: [
          { label: 'Main without ID' },
        ],
      };

      const taskTreeRef = { current: null };
      const { result } = renderHook(() =>
        useNodeFinder({
          taskTree,
          taskTreeRef: taskTreeRef as React.MutableRefObject<TaskTree | null | undefined>,
          handleSelectMain,
          handleSelectSub,
        })
      );

      act(() => {
        result.current('any-id');
      });

      expect(handleSelectMain).not.toHaveBeenCalled();
      expect(handleSelectSub).not.toHaveBeenCalled();
    });

    it('should handle sub nodes without id, templateId, or _id', () => {
      const taskTree: TaskTree = {
        nodes: [
          {
            id: 'main-1',
            label: 'Main 1',
            subNodes: [{ label: 'Sub without ID' }],
          },
        ],
      };

      const taskTreeRef = { current: null };
      const { result } = renderHook(() =>
        useNodeFinder({
          taskTree,
          taskTreeRef: taskTreeRef as React.MutableRefObject<TaskTree | null | undefined>,
          handleSelectMain,
          handleSelectSub,
        })
      );

      act(() => {
        result.current('any-id');
      });

      expect(handleSelectMain).not.toHaveBeenCalled();
      expect(handleSelectSub).not.toHaveBeenCalled();
    });

    it('should stop searching after finding first match', () => {
      const taskTree: TaskTree = {
        nodes: [
          { id: 'main-1', label: 'Main 1' },
          { id: 'main-1', label: 'Main 1 Duplicate' }, // Same ID (shouldn't happen but test edge case)
        ],
      };

      const taskTreeRef = { current: null };
      const { result } = renderHook(() =>
        useNodeFinder({
          taskTree,
          taskTreeRef: taskTreeRef as React.MutableRefObject<TaskTree | null | undefined>,
          handleSelectMain,
          handleSelectSub,
        })
      );

      act(() => {
        result.current('main-1');
      });

      // Should only be called once (first match)
      expect(handleSelectMain).toHaveBeenCalledTimes(1);
      expect(handleSelectMain).toHaveBeenCalledWith(0);
    });

    it('should handle empty subNodes array', () => {
      const taskTree: TaskTree = {
        nodes: [
          {
            id: 'main-1',
            label: 'Main 1',
            subNodes: [],
          },
        ],
      };

      const taskTreeRef = { current: null };
      const { result } = renderHook(() =>
        useNodeFinder({
          taskTree,
          taskTreeRef: taskTreeRef as React.MutableRefObject<TaskTree | null | undefined>,
          handleSelectMain,
          handleSelectSub,
        })
      );

      act(() => {
        result.current('sub-1');
      });

      expect(handleSelectMain).not.toHaveBeenCalled();
      expect(handleSelectSub).not.toHaveBeenCalled();
    });

    it('should handle null/undefined subNodes', () => {
      const taskTree: TaskTree = {
        nodes: [
          {
            id: 'main-1',
            label: 'Main 1',
            // subNodes is undefined
          },
        ],
      };

      const taskTreeRef = { current: null };
      const { result } = renderHook(() =>
        useNodeFinder({
          taskTree,
          taskTreeRef: taskTreeRef as React.MutableRefObject<TaskTree | null | undefined>,
          handleSelectMain,
          handleSelectSub,
        })
      );

      act(() => {
        result.current('sub-1');
      });

      expect(handleSelectMain).not.toHaveBeenCalled();
      expect(handleSelectSub).not.toHaveBeenCalled();
    });
  });

  describe('callback stability', () => {
    it('should return stable callback reference when dependencies do not change', () => {
      const taskTree: TaskTree = {
        nodes: [{ id: 'main-1', label: 'Main 1' }],
      };

      const taskTreeRef = { current: null };
      const { result, rerender } = renderHook(
        ({ taskTree }) =>
          useNodeFinder({
            taskTree,
            taskTreeRef: taskTreeRef as React.MutableRefObject<TaskTree | null | undefined>,
            handleSelectMain,
            handleSelectSub,
          }),
        {
          initialProps: { taskTree },
        }
      );

      const firstCallback = result.current;

      rerender({ taskTree });

      expect(result.current).toBe(firstCallback);
    });

    it('should return new callback when taskTree changes', () => {
      const taskTree1: TaskTree = {
        nodes: [{ id: 'main-1', label: 'Main 1' }],
      };

      const taskTree2: TaskTree = {
        nodes: [{ id: 'main-2', label: 'Main 2' }],
      };

      const taskTreeRef = { current: null };
      const { result, rerender } = renderHook(
        ({ taskTree }) =>
          useNodeFinder({
            taskTree,
            taskTreeRef: taskTreeRef as React.MutableRefObject<TaskTree | null | undefined>,
            handleSelectMain,
            handleSelectSub,
          }),
        {
          initialProps: { taskTree: taskTree1 },
        }
      );

      const firstCallback = result.current;

      rerender({ taskTree: taskTree2 });

      expect(result.current).not.toBe(firstCallback);
    });
  });
});
