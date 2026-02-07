// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSidebar } from '@responseEditor/hooks/useSidebar';
import type { TaskTree } from '@types/taskTypes';

/**
 * Tests for useSidebar
 *
 * This hook consolidates all sidebar-related functionality from 4 separate hooks.
 * We test observable behaviors: cleanup, drag handling, resize, and business logic handlers.
 *
 * WHAT WE TEST:
 * - Cleanup removes localStorage item on mount
 * - Drag handling sets up event listeners correctly
 * - Resize handler initializes drag state
 * - Business logic handlers (onChangeSubRequired, onReorderSub, etc.)
 * - Edge cases (null taskTree, invalid indices, immutability)
 *
 * WHY IT'S IMPORTANT:
 * - Sidebar functionality is critical for user experience
 * - Consolidation from 4 hooks must work correctly
 * - Business logic handlers modify taskTree structure
 * - Immutability must be preserved
 *
 * MOCKS:
 * - getMainNodes, getSubNodesStrict (domain functions)
 * - localStorage (browser API)
 * - window.addEventListener/removeEventListener (browser API)
 */

// Mock domain functions
const mockGetMainNodes = vi.fn();
const mockGetSubNodes = vi.fn();
const mockGetSubNodesStrict = vi.fn();

vi.mock('@responseEditor/core/domain', () => ({
  getMainNodes: (taskTree: TaskTree) => mockGetMainNodes(taskTree),
  getSubNodes: (node: any) => mockGetSubNodes(node),
}));

vi.mock('@responseEditor/core/domain/nodeStrict', () => ({
  getSubNodesStrict: (node: any) => mockGetSubNodesStrict(node),
}));

import { getMainNodes } from '@responseEditor/core/domain';
import { getSubNodesStrict } from '@responseEditor/core/domain/nodeStrict';

describe('useSidebar - Composite Hook', () => {
  let mockTaskTree: TaskTree;
  let mockReplaceSelectedTaskTree: ReturnType<typeof vi.fn>;
  let mockSetIsDraggingSidebar: ReturnType<typeof vi.fn>;
  let mockSetSidebarManualWidth: ReturnType<typeof vi.fn>;
  let sidebarStartWidthRef: React.MutableRefObject<number>;
  let sidebarStartXRef: React.MutableRefObject<number>;
  let sidebarRef: React.RefObject<HTMLDivElement>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {});

    mockTaskTree = {
      label: 'Test TaskTree',
      nodes: [
        {
          id: 'main-1',
          label: 'Main 1',
          subNodes: [
            { id: 'sub-1', label: 'Sub 1', required: true },
            { id: 'sub-2', label: 'Sub 2', required: false },
          ],
        },
        {
          id: 'main-2',
          label: 'Main 2',
          subNodes: [{ id: 'sub-3', label: 'Sub 3', required: true }],
        },
      ],
      steps: {},
    } as TaskTree;

    mockReplaceSelectedTaskTree = vi.fn();
    mockSetIsDraggingSidebar = vi.fn();
    mockSetSidebarManualWidth = vi.fn();

    sidebarStartWidthRef = { current: 200 };
    sidebarStartXRef = { current: 100 };
    sidebarRef = { current: document.createElement('div') };

    // Setup mocks
    mockGetMainNodes.mockImplementation((tree: TaskTree) => tree.nodes || []);
    mockGetSubNodesStrict.mockImplementation((node: any) => node.subNodes || []);
    mockGetSubNodes.mockImplementation((node: any) => node.subNodes || []);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Cleanup', () => {
    it('should remove localStorage item on mount', () => {
      renderHook(() =>
        useSidebar({
          isDraggingSidebar: false,
          setIsDraggingSidebar: mockSetIsDraggingSidebar,
          sidebarStartWidthRef,
          sidebarStartXRef,
          setSidebarManualWidth: mockSetSidebarManualWidth,
          sidebarRef,
          taskTree: mockTaskTree,
          replaceSelectedTaskTree: mockReplaceSelectedTaskTree,
        })
      );

      expect(localStorage.removeItem).toHaveBeenCalledWith(
        'responseEditor.sidebarWidth'
      );
    });

    it('should handle localStorage errors gracefully', () => {
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('Storage error');
      });

      expect(() => {
        renderHook(() =>
          useSidebar({
            isDraggingSidebar: false,
            setIsDraggingSidebar: mockSetIsDraggingSidebar,
            sidebarStartWidthRef,
            sidebarStartXRef,
            setSidebarManualWidth: mockSetSidebarManualWidth,
            sidebarRef,
            taskTree: mockTaskTree,
            replaceSelectedTaskTree: mockReplaceSelectedTaskTree,
          })
        );
      }).not.toThrow();
    });
  });

  describe('Drag Handling', () => {
    it('should set up mouse event listeners when dragging starts', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { rerender } = renderHook(
        ({ isDragging }) =>
          useSidebar({
            isDraggingSidebar: isDragging,
            setIsDraggingSidebar: mockSetIsDraggingSidebar,
            sidebarStartWidthRef,
            sidebarStartXRef,
            setSidebarManualWidth: mockSetSidebarManualWidth,
            sidebarRef,
            taskTree: mockTaskTree,
            replaceSelectedTaskTree: mockReplaceSelectedTaskTree,
          }),
        { initialProps: { isDragging: false } }
      );

      // Start dragging
      rerender({ isDragging: true });

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'mousemove',
        expect.any(Function)
      );
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'mouseup',
        expect.any(Function)
      );
    });

    it('should calculate width correctly during drag (MIN/MAX constraints)', () => {
      const { rerender } = renderHook(
        ({ isDragging }) =>
          useSidebar({
            isDraggingSidebar: isDragging,
            setIsDraggingSidebar: mockSetIsDraggingSidebar,
            sidebarStartWidthRef: { current: 200 },
            sidebarStartXRef: { current: 100 },
            setSidebarManualWidth: mockSetSidebarManualWidth,
            sidebarRef,
            taskTree: mockTaskTree,
            replaceSelectedTaskTree: mockReplaceSelectedTaskTree,
          }),
        { initialProps: { isDragging: false } }
      );

      rerender({ isDragging: true });

      // Simulate mouse move
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 250, // deltaX = 150, new width = 350
      });
      window.dispatchEvent(mouseMoveEvent);

      expect(mockSetSidebarManualWidth).toHaveBeenCalledWith(350);
    });

    it('should enforce MIN_WIDTH constraint', () => {
      const { rerender } = renderHook(
        ({ isDragging }) =>
          useSidebar({
            isDraggingSidebar: isDragging,
            setIsDraggingSidebar: mockSetIsDraggingSidebar,
            sidebarStartWidthRef: { current: 200 },
            sidebarStartXRef: { current: 100 },
            setSidebarManualWidth: mockSetSidebarManualWidth,
            sidebarRef,
            taskTree: mockTaskTree,
            replaceSelectedTaskTree: mockReplaceSelectedTaskTree,
          }),
        { initialProps: { isDragging: false } }
      );

      rerender({ isDragging: true });

      // Simulate mouse move that would result in width < MIN_WIDTH (160)
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 50, // deltaX = -50, new width = 150, but MIN is 160
      });
      window.dispatchEvent(mouseMoveEvent);

      expect(mockSetSidebarManualWidth).toHaveBeenCalledWith(160);
    });

    it('should enforce MAX_WIDTH constraint', () => {
      const { rerender } = renderHook(
        ({ isDragging }) =>
          useSidebar({
            isDraggingSidebar: isDragging,
            setIsDraggingSidebar: mockSetIsDraggingSidebar,
            sidebarStartWidthRef: { current: 200 },
            sidebarStartXRef: { current: 100 },
            setSidebarManualWidth: mockSetSidebarManualWidth,
            sidebarRef,
            taskTree: mockTaskTree,
            replaceSelectedTaskTree: mockReplaceSelectedTaskTree,
          }),
        { initialProps: { isDragging: false } }
      );

      rerender({ isDragging: true });

      // Simulate mouse move that would result in width > MAX_WIDTH (1000)
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 1000, // deltaX = 900, new width = 1100, but MAX is 1000
      });
      window.dispatchEvent(mouseMoveEvent);

      expect(mockSetSidebarManualWidth).toHaveBeenCalledWith(1000);
    });

    it('should stop dragging on mouseup', () => {
      const { rerender } = renderHook(
        ({ isDragging }) =>
          useSidebar({
            isDraggingSidebar: isDragging,
            setIsDraggingSidebar: mockSetIsDraggingSidebar,
            sidebarStartWidthRef,
            sidebarStartXRef,
            setSidebarManualWidth: mockSetSidebarManualWidth,
            sidebarRef,
            taskTree: mockTaskTree,
            replaceSelectedTaskTree: mockReplaceSelectedTaskTree,
          }),
        { initialProps: { isDragging: false } }
      );

      rerender({ isDragging: true });

      // Simulate mouseup
      const mouseUpEvent = new MouseEvent('mouseup');
      window.dispatchEvent(mouseUpEvent);

      expect(mockSetIsDraggingSidebar).toHaveBeenCalledWith(false);
    });

    it('should clean up event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { rerender, unmount } = renderHook(
        ({ isDragging }) =>
          useSidebar({
            isDraggingSidebar: isDragging,
            setIsDraggingSidebar: mockSetIsDraggingSidebar,
            sidebarStartWidthRef,
            sidebarStartXRef,
            setSidebarManualWidth: mockSetSidebarManualWidth,
            sidebarRef,
            taskTree: mockTaskTree,
            replaceSelectedTaskTree: mockReplaceSelectedTaskTree,
          }),
        { initialProps: { isDragging: false } }
      );

      rerender({ isDragging: true });
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'mousemove',
        expect.any(Function)
      );
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'mouseup',
        expect.any(Function)
      );
    });
  });

  describe('Resize Handler', () => {
    it('should initialize drag state on resize start', () => {
      const mockElement = document.createElement('div');
      mockElement.getBoundingClientRect = vi.fn(() => ({
        width: 250,
        height: 100,
        top: 0,
        left: 0,
        bottom: 100,
        right: 250,
        x: 0,
        y: 0,
        toJSON: vi.fn(),
      }));

      const mockSidebarRef = { current: mockElement };
      const mockStartWidthRef = { current: 0 };
      const mockStartXRef = { current: 0 };

      const { result } = renderHook(() =>
        useSidebar({
          isDraggingSidebar: false,
          setIsDraggingSidebar: mockSetIsDraggingSidebar,
          sidebarStartWidthRef: mockStartWidthRef,
          sidebarStartXRef: mockStartXRef,
          setSidebarManualWidth: mockSetSidebarManualWidth,
          sidebarRef: mockSidebarRef,
          taskTree: mockTaskTree,
          replaceSelectedTaskTree: mockReplaceSelectedTaskTree,
        })
      );

      const mockEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        clientX: 150,
      } as unknown as React.MouseEvent;

      act(() => {
        result.current.handleSidebarResizeStart(mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(mockStartWidthRef.current).toBe(250);
      expect(mockStartXRef.current).toBe(150);
      expect(mockSetIsDraggingSidebar).toHaveBeenCalledWith(true);
    });

    it('should handle missing sidebarRef gracefully', () => {
      const mockSidebarRef = { current: null };

      const { result } = renderHook(() =>
        useSidebar({
          isDraggingSidebar: false,
          setIsDraggingSidebar: mockSetIsDraggingSidebar,
          sidebarStartWidthRef,
          sidebarStartXRef,
          setSidebarManualWidth: mockSetSidebarManualWidth,
          sidebarRef: mockSidebarRef,
          taskTree: mockTaskTree,
          replaceSelectedTaskTree: mockReplaceSelectedTaskTree,
        })
      );

      const mockEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        clientX: 150,
      } as unknown as React.MouseEvent;

      expect(() => {
        act(() => {
          result.current.handleSidebarResizeStart(mockEvent);
        });
      }).not.toThrow();

      // Should not set dragging state
      expect(mockSetIsDraggingSidebar).not.toHaveBeenCalled();
    });
  });

  describe('Business Logic Handlers', () => {
    describe('onChangeSubRequired', () => {
      it('should update sub required flag', () => {
        const { result } = renderHook(() =>
          useSidebar({
            isDraggingSidebar: false,
            setIsDraggingSidebar: mockSetIsDraggingSidebar,
            sidebarStartWidthRef,
            sidebarStartXRef,
            setSidebarManualWidth: mockSetSidebarManualWidth,
            sidebarRef,
            taskTree: mockTaskTree,
            replaceSelectedTaskTree: mockReplaceSelectedTaskTree,
          })
        );

        act(() => {
          result.current.onChangeSubRequired(0, 1, true);
        });

        expect(mockReplaceSelectedTaskTree).toHaveBeenCalled();
        const calledWith = mockReplaceSelectedTaskTree.mock.calls[0][0];
        expect(calledWith.nodes[0].subNodes[1].required).toBe(true);
      });

      it('should not mutate original taskTree', () => {
        const originalTree = JSON.parse(JSON.stringify(mockTaskTree));
        const { result } = renderHook(() =>
          useSidebar({
            isDraggingSidebar: false,
            setIsDraggingSidebar: mockSetIsDraggingSidebar,
            sidebarStartWidthRef,
            sidebarStartXRef,
            setSidebarManualWidth: mockSetSidebarManualWidth,
            sidebarRef,
            taskTree: mockTaskTree,
            replaceSelectedTaskTree: mockReplaceSelectedTaskTree,
          })
        );

        act(() => {
          result.current.onChangeSubRequired(0, 0, false);
        });

        // Original tree should be unchanged
        expect(mockTaskTree.nodes[0].subNodes[0].required).toBe(
          originalTree.nodes[0].subNodes[0].required
        );
      });

      it('should handle null taskTree gracefully', () => {
        const { result } = renderHook(() =>
          useSidebar({
            isDraggingSidebar: false,
            setIsDraggingSidebar: mockSetIsDraggingSidebar,
            sidebarStartWidthRef,
            sidebarStartXRef,
            setSidebarManualWidth: mockSetSidebarManualWidth,
            sidebarRef,
            taskTree: null,
            replaceSelectedTaskTree: mockReplaceSelectedTaskTree,
          })
        );

        expect(() => {
          act(() => {
            result.current.onChangeSubRequired(0, 0, true);
          });
        }).not.toThrow();

        expect(mockReplaceSelectedTaskTree).not.toHaveBeenCalled();
      });

      it('should handle invalid indices gracefully', () => {
        const { result } = renderHook(() =>
          useSidebar({
            isDraggingSidebar: false,
            setIsDraggingSidebar: mockSetIsDraggingSidebar,
            sidebarStartWidthRef,
            sidebarStartXRef,
            setSidebarManualWidth: mockSetSidebarManualWidth,
            sidebarRef,
            taskTree: mockTaskTree,
            replaceSelectedTaskTree: mockReplaceSelectedTaskTree,
          })
        );

        expect(() => {
          act(() => {
            result.current.onChangeSubRequired(999, 0, true);
          });
        }).not.toThrow();

        expect(() => {
          act(() => {
            result.current.onChangeSubRequired(0, 999, true);
          });
        }).not.toThrow();

        expect(mockReplaceSelectedTaskTree).not.toHaveBeenCalled();
      });
    });

    describe('onReorderSub', () => {
      it('should reorder sub-nodes correctly', () => {
        const { result } = renderHook(() =>
          useSidebar({
            isDraggingSidebar: false,
            setIsDraggingSidebar: mockSetIsDraggingSidebar,
            sidebarStartWidthRef,
            sidebarStartXRef,
            setSidebarManualWidth: mockSetSidebarManualWidth,
            sidebarRef,
            taskTree: mockTaskTree,
            replaceSelectedTaskTree: mockReplaceSelectedTaskTree,
          })
        );

        act(() => {
          result.current.onReorderSub(0, 0, 1);
        });

        expect(mockReplaceSelectedTaskTree).toHaveBeenCalled();
        const calledWith = mockReplaceSelectedTaskTree.mock.calls[0][0];
        expect(calledWith.nodes[0].subNodes[0].id).toBe('sub-2');
        expect(calledWith.nodes[0].subNodes[1].id).toBe('sub-1');
      });

      it('should handle invalid indices gracefully', () => {
        const { result } = renderHook(() =>
          useSidebar({
            isDraggingSidebar: false,
            setIsDraggingSidebar: mockSetIsDraggingSidebar,
            sidebarStartWidthRef,
            sidebarStartXRef,
            setSidebarManualWidth: mockSetSidebarManualWidth,
            sidebarRef,
            taskTree: mockTaskTree,
            replaceSelectedTaskTree: mockReplaceSelectedTaskTree,
          })
        );

        expect(() => {
          act(() => {
            result.current.onReorderSub(0, 999, 0);
          });
        }).not.toThrow();

        expect(mockReplaceSelectedTaskTree).not.toHaveBeenCalled();
      });
    });

    describe('onAddMain', () => {
      it('should add new main node', () => {
        const { result } = renderHook(() =>
          useSidebar({
            isDraggingSidebar: false,
            setIsDraggingSidebar: mockSetIsDraggingSidebar,
            sidebarStartWidthRef,
            sidebarStartXRef,
            setSidebarManualWidth: mockSetSidebarManualWidth,
            sidebarRef,
            taskTree: mockTaskTree,
            replaceSelectedTaskTree: mockReplaceSelectedTaskTree,
          })
        );

        act(() => {
          result.current.onAddMain('New Main');
        });

        expect(mockReplaceSelectedTaskTree).toHaveBeenCalled();
        const calledWith = mockReplaceSelectedTaskTree.mock.calls[0][0];
        expect(calledWith.nodes.length).toBe(3);
        expect(calledWith.nodes[2].label).toBe('New Main');
        expect(calledWith.nodes[2].subNodes).toEqual([]);
      });
    });

    describe('onRenameMain', () => {
      it('should rename main node', () => {
        const { result } = renderHook(() =>
          useSidebar({
            isDraggingSidebar: false,
            setIsDraggingSidebar: mockSetIsDraggingSidebar,
            sidebarStartWidthRef,
            sidebarStartXRef,
            setSidebarManualWidth: mockSetSidebarManualWidth,
            sidebarRef,
            taskTree: mockTaskTree,
            replaceSelectedTaskTree: mockReplaceSelectedTaskTree,
          })
        );

        act(() => {
          result.current.onRenameMain(0, 'Renamed Main');
        });

        expect(mockReplaceSelectedTaskTree).toHaveBeenCalled();
        const calledWith = mockReplaceSelectedTaskTree.mock.calls[0][0];
        expect(calledWith.nodes[0].label).toBe('Renamed Main');
      });

      it('should handle invalid index gracefully', () => {
        const { result } = renderHook(() =>
          useSidebar({
            isDraggingSidebar: false,
            setIsDraggingSidebar: mockSetIsDraggingSidebar,
            sidebarStartWidthRef,
            sidebarStartXRef,
            setSidebarManualWidth: mockSetSidebarManualWidth,
            sidebarRef,
            taskTree: mockTaskTree,
            replaceSelectedTaskTree: mockReplaceSelectedTaskTree,
          })
        );

        expect(() => {
          act(() => {
            result.current.onRenameMain(999, 'New Name');
          });
        }).not.toThrow();

        expect(mockReplaceSelectedTaskTree).not.toHaveBeenCalled();
      });
    });

    describe('onDeleteMain', () => {
      it('should delete main node', () => {
        const { result } = renderHook(() =>
          useSidebar({
            isDraggingSidebar: false,
            setIsDraggingSidebar: mockSetIsDraggingSidebar,
            sidebarStartWidthRef,
            sidebarStartXRef,
            setSidebarManualWidth: mockSetSidebarManualWidth,
            sidebarRef,
            taskTree: mockTaskTree,
            replaceSelectedTaskTree: mockReplaceSelectedTaskTree,
          })
        );

        act(() => {
          result.current.onDeleteMain(0);
        });

        expect(mockReplaceSelectedTaskTree).toHaveBeenCalled();
        const calledWith = mockReplaceSelectedTaskTree.mock.calls[0][0];
        expect(calledWith.nodes.length).toBe(1);
        expect(calledWith.nodes[0].id).toBe('main-2');
      });

      it('should handle invalid index gracefully', () => {
        const { result } = renderHook(() =>
          useSidebar({
            isDraggingSidebar: false,
            setIsDraggingSidebar: mockSetIsDraggingSidebar,
            sidebarStartWidthRef,
            sidebarStartXRef,
            setSidebarManualWidth: mockSetSidebarManualWidth,
            sidebarRef,
            taskTree: mockTaskTree,
            replaceSelectedTaskTree: mockReplaceSelectedTaskTree,
          })
        );

        expect(() => {
          act(() => {
            result.current.onDeleteMain(999);
          });
        }).not.toThrow();

        expect(mockReplaceSelectedTaskTree).not.toHaveBeenCalled();
      });
    });

    describe('onAddSub', () => {
      it('should add new sub-node', () => {
        const { result } = renderHook(() =>
          useSidebar({
            isDraggingSidebar: false,
            setIsDraggingSidebar: mockSetIsDraggingSidebar,
            sidebarStartWidthRef,
            sidebarStartXRef,
            setSidebarManualWidth: mockSetSidebarManualWidth,
            sidebarRef,
            taskTree: mockTaskTree,
            replaceSelectedTaskTree: mockReplaceSelectedTaskTree,
          })
        );

        act(() => {
          result.current.onAddSub(0, 'New Sub');
        });

        expect(mockReplaceSelectedTaskTree).toHaveBeenCalled();
        const calledWith = mockReplaceSelectedTaskTree.mock.calls[0][0];
        expect(calledWith.nodes[0].subNodes.length).toBe(3);
        expect(calledWith.nodes[0].subNodes[2].label).toBe('New Sub');
        expect(calledWith.nodes[0].subNodes[2].required).toBe(true);
      });
    });

    describe('onRenameSub', () => {
      it('should rename sub-node', () => {
        const { result } = renderHook(() =>
          useSidebar({
            isDraggingSidebar: false,
            setIsDraggingSidebar: mockSetIsDraggingSidebar,
            sidebarStartWidthRef,
            sidebarStartXRef,
            setSidebarManualWidth: mockSetSidebarManualWidth,
            sidebarRef,
            taskTree: mockTaskTree,
            replaceSelectedTaskTree: mockReplaceSelectedTaskTree,
          })
        );

        act(() => {
          result.current.onRenameSub(0, 0, 'Renamed Sub');
        });

        expect(mockReplaceSelectedTaskTree).toHaveBeenCalled();
        const calledWith = mockReplaceSelectedTaskTree.mock.calls[0][0];
        expect(calledWith.nodes[0].subNodes[0].label).toBe('Renamed Sub');
      });
    });

    describe('onDeleteSub', () => {
      it('should delete sub-node', () => {
        const { result } = renderHook(() =>
          useSidebar({
            isDraggingSidebar: false,
            setIsDraggingSidebar: mockSetIsDraggingSidebar,
            sidebarStartWidthRef,
            sidebarStartXRef,
            setSidebarManualWidth: mockSetSidebarManualWidth,
            sidebarRef,
            taskTree: mockTaskTree,
            replaceSelectedTaskTree: mockReplaceSelectedTaskTree,
          })
        );

        act(() => {
          result.current.onDeleteSub(0, 0);
        });

        expect(mockReplaceSelectedTaskTree).toHaveBeenCalled();
        const calledWith = mockReplaceSelectedTaskTree.mock.calls[0][0];
        expect(calledWith.nodes[0].subNodes.length).toBe(1);
        expect(calledWith.nodes[0].subNodes[0].id).toBe('sub-2');
      });
    });
  });
});
