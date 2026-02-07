// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNodeSelection } from '../../features/node-editing/hooks/useNodeSelection';

/**
 * Tests for useNodeSelection
 *
 * This hook manages node selection state in ResponseEditor.
 * We test observable behaviors: state changes, focus management, and edge cases.
 *
 * WHAT WE TEST:
 * - Selection of main nodes
 * - Selection of sub nodes (with and without main index)
 * - Selection of aggregator/root
 * - Reset selection
 * - Sidebar focus after selection
 * - Edge cases (invalid indices, undefined values)
 *
 * WHY IT'S IMPORTANT:
 * - Node selection is critical for the editor's core functionality
 * - Incorrect selection state can break the entire editor UX
 * - Focus management ensures proper keyboard navigation
 *
 * MOCKS:
 * - None needed (pure hook with React state)
 * - We mock setTimeout for focus testing
 */

describe('useNodeSelection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with default main index 0', () => {
      const { result } = renderHook(() => useNodeSelection());

      expect(result.current.selectedMainIndex).toBe(0);
      expect(result.current.selectedSubIndex).toBeUndefined();
      expect(result.current.selectedRoot).toBe(false);
      expect(result.current.sidebarRef.current).toBeNull();
    });

    it('should initialize with custom main index', () => {
      const { result } = renderHook(() => useNodeSelection(2));

      expect(result.current.selectedMainIndex).toBe(2);
      expect(result.current.selectedSubIndex).toBeUndefined();
      expect(result.current.selectedRoot).toBe(false);
    });
  });

  describe('handleSelectMain', () => {
    it('should select main node and reset sub/root', () => {
      const { result } = renderHook(() => useNodeSelection(0));

      act(() => {
        result.current.handleSelectMain(3);
      });

      expect(result.current.selectedMainIndex).toBe(3);
      expect(result.current.selectedSubIndex).toBeUndefined();
      expect(result.current.selectedRoot).toBe(false);
    });

    it('should reset sub index when selecting main', () => {
      const { result } = renderHook(() => useNodeSelection(0));

      // First select a sub node
      act(() => {
        result.current.handleSelectSub(1);
      });

      expect(result.current.selectedSubIndex).toBe(1);

      // Then select a main node
      act(() => {
        result.current.handleSelectMain(2);
      });

      expect(result.current.selectedMainIndex).toBe(2);
      expect(result.current.selectedSubIndex).toBeUndefined();
    });

    it('should reset root when selecting main', () => {
      const { result } = renderHook(() => useNodeSelection(0));

      // First select aggregator
      act(() => {
        result.current.handleSelectAggregator();
      });

      expect(result.current.selectedRoot).toBe(true);

      // Then select a main node
      act(() => {
        result.current.handleSelectMain(1);
      });

      expect(result.current.selectedRoot).toBe(false);
    });

    it('should focus sidebar after selecting main', () => {
      const { result } = renderHook(() => useNodeSelection(0));

      // Create a mock element for sidebarRef
      const mockElement = document.createElement('div');
      const focusSpy = vi.spyOn(mockElement, 'focus');

      act(() => {
        result.current.sidebarRef.current = mockElement;
        result.current.handleSelectMain(2);
      });

      // Fast-forward timers to trigger setTimeout
      act(() => {
        vi.advanceTimersByTime(0);
      });

      expect(focusSpy).toHaveBeenCalled();
    });

    it('should handle negative indices', () => {
      const { result } = renderHook(() => useNodeSelection(0));

      act(() => {
        result.current.handleSelectMain(-1);
      });

      // Hook doesn't validate indices, it just sets them
      expect(result.current.selectedMainIndex).toBe(-1);
    });

    it('should handle large indices', () => {
      const { result } = renderHook(() => useNodeSelection(0));

      act(() => {
        result.current.handleSelectMain(999);
      });

      expect(result.current.selectedMainIndex).toBe(999);
    });
  });

  describe('handleSelectSub', () => {
    it('should select sub node without changing main when mainIdx not provided', () => {
      const { result } = renderHook(() => useNodeSelection(2));

      act(() => {
        result.current.handleSelectSub(1);
      });

      expect(result.current.selectedMainIndex).toBe(2); // Unchanged
      expect(result.current.selectedSubIndex).toBe(1);
      expect(result.current.selectedRoot).toBe(false);
    });

    it('should select sub node and change main when mainIdx provided and different', () => {
      const { result } = renderHook(() => useNodeSelection(0));

      act(() => {
        result.current.handleSelectSub(2, 3); // subIdx=2, mainIdx=3
      });

      expect(result.current.selectedMainIndex).toBe(3);
      expect(result.current.selectedSubIndex).toBe(2);
      expect(result.current.selectedRoot).toBe(false);
    });

    it('should not change main when mainIdx provided but same as current', () => {
      const { result } = renderHook(() => useNodeSelection(2));

      act(() => {
        result.current.handleSelectSub(1, 2); // mainIdx same as current
      });

      expect(result.current.selectedMainIndex).toBe(2);
      expect(result.current.selectedSubIndex).toBe(1);
    });

    it('should reset root when selecting sub', () => {
      const { result } = renderHook(() => useNodeSelection(0));

      // First select aggregator
      act(() => {
        result.current.handleSelectAggregator();
      });

      expect(result.current.selectedRoot).toBe(true);

      // Then select a sub node
      act(() => {
        result.current.handleSelectSub(1);
      });

      expect(result.current.selectedRoot).toBe(false);
    });

    it('should allow undefined sub index to clear sub selection', () => {
      const { result } = renderHook(() => useNodeSelection(0));

      // First select a sub node
      act(() => {
        result.current.handleSelectSub(1);
      });

      expect(result.current.selectedSubIndex).toBe(1);

      // Then clear sub selection
      act(() => {
        result.current.handleSelectSub(undefined);
      });

      expect(result.current.selectedSubIndex).toBeUndefined();
    });

    it('should focus sidebar after selecting sub', () => {
      const { result } = renderHook(() => useNodeSelection(0));

      const mockElement = document.createElement('div');
      const focusSpy = vi.spyOn(mockElement, 'focus');

      act(() => {
        result.current.sidebarRef.current = mockElement;
        result.current.handleSelectSub(1);
      });

      act(() => {
        vi.advanceTimersByTime(0);
      });

      expect(focusSpy).toHaveBeenCalled();
    });

    it('should handle atomic selection of main and sub', () => {
      const { result } = renderHook(() => useNodeSelection(0));

      act(() => {
        result.current.handleSelectSub(2, 3); // Atomic: both main and sub
      });

      expect(result.current.selectedMainIndex).toBe(3);
      expect(result.current.selectedSubIndex).toBe(2);
    });
  });

  describe('handleSelectAggregator', () => {
    it('should select aggregator and reset to initial state', () => {
      const { result } = renderHook(() => useNodeSelection(0));

      // First select a main and sub
      act(() => {
        result.current.handleSelectMain(2);
        result.current.handleSelectSub(1);
      });

      expect(result.current.selectedMainIndex).toBe(2);
      expect(result.current.selectedSubIndex).toBe(1);
      expect(result.current.selectedRoot).toBe(false);

      // Then select aggregator
      act(() => {
        result.current.handleSelectAggregator();
      });

      expect(result.current.selectedRoot).toBe(true);
      expect(result.current.selectedMainIndex).toBe(0);
      expect(result.current.selectedSubIndex).toBeUndefined();
    });

    it('should focus sidebar after selecting aggregator', () => {
      const { result } = renderHook(() => useNodeSelection(0));

      const mockElement = document.createElement('div');
      const focusSpy = vi.spyOn(mockElement, 'focus');

      act(() => {
        result.current.sidebarRef.current = mockElement;
        result.current.handleSelectAggregator();
      });

      act(() => {
        vi.advanceTimersByTime(0);
      });

      expect(focusSpy).toHaveBeenCalled();
    });

    it('should reset main index to 0 when selecting aggregator', () => {
      const { result } = renderHook(() => useNodeSelection(5));

      act(() => {
        result.current.handleSelectAggregator();
      });

      expect(result.current.selectedMainIndex).toBe(0);
    });
  });

  describe('resetSelection', () => {
    it('should reset all selection to initial state', () => {
      const { result } = renderHook(() => useNodeSelection(0));

      // Set some selection state
      act(() => {
        result.current.handleSelectMain(3);
        result.current.handleSelectSub(2);
      });

      expect(result.current.selectedMainIndex).toBe(3);
      expect(result.current.selectedSubIndex).toBe(2);

      // Reset
      act(() => {
        result.current.resetSelection();
      });

      expect(result.current.selectedMainIndex).toBe(0);
      expect(result.current.selectedSubIndex).toBeUndefined();
      expect(result.current.selectedRoot).toBe(false);
    });

    it('should reset to custom initial main index', () => {
      const { result } = renderHook(() => useNodeSelection(5));

      act(() => {
        result.current.handleSelectMain(10);
      });

      act(() => {
        result.current.resetSelection();
      });

      expect(result.current.selectedMainIndex).toBe(0); // Reset always goes to 0, not initial
    });

    it('should focus sidebar after reset', () => {
      const { result } = renderHook(() => useNodeSelection(0));

      const mockElement = document.createElement('div');
      const focusSpy = vi.spyOn(mockElement, 'focus');

      act(() => {
        result.current.sidebarRef.current = mockElement;
        result.current.resetSelection();
      });

      act(() => {
        vi.advanceTimersByTime(0);
      });

      expect(focusSpy).toHaveBeenCalled();
    });
  });

  describe('setters (backward compatibility)', () => {
    it('should allow direct setSelectedMainIndex', () => {
      const { result } = renderHook(() => useNodeSelection(0));

      act(() => {
        result.current.setSelectedMainIndex(5);
      });

      expect(result.current.selectedMainIndex).toBe(5);
    });

    it('should allow direct setSelectedSubIndex', () => {
      const { result } = renderHook(() => useNodeSelection(0));

      act(() => {
        result.current.setSelectedSubIndex(3);
      });

      expect(result.current.selectedSubIndex).toBe(3);
    });

    it('should allow direct setSelectedRoot', () => {
      const { result } = renderHook(() => useNodeSelection(0));

      act(() => {
        result.current.setSelectedRoot(true);
      });

      expect(result.current.selectedRoot).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle rapid successive selections', () => {
      const { result } = renderHook(() => useNodeSelection(0));

      act(() => {
        result.current.handleSelectMain(1);
        result.current.handleSelectMain(2);
        result.current.handleSelectMain(3);
      });

      expect(result.current.selectedMainIndex).toBe(3);
    });

    it('should handle focus when sidebarRef is null', () => {
      const { result } = renderHook(() => useNodeSelection(0));

      // Should not throw when sidebarRef.current is null
      expect(() => {
        act(() => {
          result.current.handleSelectMain(1);
          vi.advanceTimersByTime(0);
        });
      }).not.toThrow();
    });

    it('should maintain state consistency across multiple operations', () => {
      const { result } = renderHook(() => useNodeSelection(0));

      act(() => {
        result.current.handleSelectMain(2);
        result.current.handleSelectSub(1);
        result.current.handleSelectAggregator();
        result.current.handleSelectMain(1);
      });

      expect(result.current.selectedMainIndex).toBe(1);
      expect(result.current.selectedSubIndex).toBeUndefined();
      expect(result.current.selectedRoot).toBe(false);
    });
  });
});
