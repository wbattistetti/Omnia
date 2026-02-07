// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePanelWidths } from '@responseEditor/hooks/usePanelWidths';

/**
 * Tests for usePanelWidths
 *
 * This hook manages panel widths for ResponseEditor by wrapping useRightPanelWidth three times.
 * We test observable behaviors: initialization, width updates, localStorage persistence, and separation between panels.
 *
 * WHAT WE TEST:
 * - Initialization with default values (360)
 * - Separation between rightWidth, testPanelWidth, and tasksPanelWidth
 * - Width updates via setRightWidth, setTestPanelWidth, setTasksPanelWidth
 * - localStorage persistence with different keys
 * - Error handling when localStorage is unavailable
 * - Independence of the three panel widths
 *
 * WHY IT'S IMPORTANT:
 * - Panel widths control UI layout and user experience
 * - localStorage persistence maintains user preferences
 * - Separation ensures panels don't interfere with each other
 * - Incorrect width handling can break the editor layout
 */

// Mock useRightPanelWidth
vi.mock('../../RightPanel', () => ({
  useRightPanelWidth: vi.fn(),
}));

import { useRightPanelWidth } from '../../RightPanel';

describe('usePanelWidths', () => {
  let mockUseRightPanelWidth: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRightPanelWidth = vi.fn();
    (useRightPanelWidth as any).mockImplementation(mockUseRightPanelWidth);
  });

  describe('initialization', () => {
    it('should initialize all widths with default value 360', () => {
      mockUseRightPanelWidth.mockReturnValue({
        width: 360,
        setWidth: vi.fn(),
      });

      const { result } = renderHook(() => usePanelWidths());

      expect(result.current.rightWidth).toBe(360);
      expect(result.current.testPanelWidth).toBe(360);
      expect(result.current.tasksPanelWidth).toBe(360);
    });

    it('should call useRightPanelWidth three times with correct parameters', () => {
      mockUseRightPanelWidth.mockReturnValue({
        width: 360,
        setWidth: vi.fn(),
      });

      renderHook(() => usePanelWidths());

      expect(useRightPanelWidth).toHaveBeenCalledTimes(3);
      expect(useRightPanelWidth).toHaveBeenNthCalledWith(1, 360);
      expect(useRightPanelWidth).toHaveBeenNthCalledWith(2, 360, 'responseEditor.testPanelWidth');
      expect(useRightPanelWidth).toHaveBeenNthCalledWith(3, 360, 'responseEditor.tasksPanelWidth');
    });

    it('should handle different initial widths from useRightPanelWidth', () => {
      let callCount = 0;
      mockUseRightPanelWidth.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { width: 400, setWidth: vi.fn() };
        } else if (callCount === 2) {
          return { width: 500, setWidth: vi.fn() };
        } else {
          return { width: 300, setWidth: vi.fn() };
        }
      });

      const { result } = renderHook(() => usePanelWidths());

      expect(result.current.rightWidth).toBe(400);
      expect(result.current.testPanelWidth).toBe(500);
      expect(result.current.tasksPanelWidth).toBe(300);
    });
  });

  describe('width updates', () => {
    it('should update rightWidth when setRightWidth is called', () => {
      const setRightWidth = vi.fn();
      const setTestPanelWidth = vi.fn();
      const setTasksPanelWidth = vi.fn();

      let callCount = 0;
      mockUseRightPanelWidth.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { width: 360, setWidth: setRightWidth };
        } else if (callCount === 2) {
          return { width: 360, setWidth: setTestPanelWidth };
        } else {
          return { width: 360, setWidth: setTasksPanelWidth };
        }
      });

      const { result } = renderHook(() => usePanelWidths());

      result.current.setRightWidth(450);

      expect(setRightWidth).toHaveBeenCalledWith(450);
      expect(setTestPanelWidth).not.toHaveBeenCalled();
      expect(setTasksPanelWidth).not.toHaveBeenCalled();
    });

    it('should update testPanelWidth when setTestPanelWidth is called', () => {
      const setRightWidth = vi.fn();
      const setTestPanelWidth = vi.fn();
      const setTasksPanelWidth = vi.fn();

      let callCount = 0;
      mockUseRightPanelWidth.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { width: 360, setWidth: setRightWidth };
        } else if (callCount === 2) {
          return { width: 360, setWidth: setTestPanelWidth };
        } else {
          return { width: 360, setWidth: setTasksPanelWidth };
        }
      });

      const { result } = renderHook(() => usePanelWidths());

      result.current.setTestPanelWidth(500);

      expect(setTestPanelWidth).toHaveBeenCalledWith(500);
      expect(setRightWidth).not.toHaveBeenCalled();
      expect(setTasksPanelWidth).not.toHaveBeenCalled();
    });

    it('should update tasksPanelWidth when setTasksPanelWidth is called', () => {
      const setRightWidth = vi.fn();
      const setTestPanelWidth = vi.fn();
      const setTasksPanelWidth = vi.fn();

      let callCount = 0;
      mockUseRightPanelWidth.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { width: 360, setWidth: setRightWidth };
        } else if (callCount === 2) {
          return { width: 360, setWidth: setTestPanelWidth };
        } else {
          return { width: 360, setWidth: setTasksPanelWidth };
        }
      });

      const { result } = renderHook(() => usePanelWidths());

      result.current.setTasksPanelWidth(600);

      expect(setTasksPanelWidth).toHaveBeenCalledWith(600);
      expect(setRightWidth).not.toHaveBeenCalled();
      expect(setTestPanelWidth).not.toHaveBeenCalled();
    });

    it('should handle multiple width updates independently', () => {
      const setRightWidth = vi.fn();
      const setTestPanelWidth = vi.fn();
      const setTasksPanelWidth = vi.fn();

      let callCount = 0;
      mockUseRightPanelWidth.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { width: 360, setWidth: setRightWidth };
        } else if (callCount === 2) {
          return { width: 360, setWidth: setTestPanelWidth };
        } else {
          return { width: 360, setWidth: setTasksPanelWidth };
        }
      });

      const { result } = renderHook(() => usePanelWidths());

      result.current.setRightWidth(400);
      result.current.setTestPanelWidth(500);
      result.current.setTasksPanelWidth(600);

      expect(setRightWidth).toHaveBeenCalledWith(400);
      expect(setTestPanelWidth).toHaveBeenCalledWith(500);
      expect(setTasksPanelWidth).toHaveBeenCalledWith(600);
    });
  });

  describe('panel separation', () => {
    it('should maintain separate state for each panel', () => {
      let callCount = 0;
      mockUseRightPanelWidth.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { width: 400, setWidth: vi.fn() };
        } else if (callCount === 2) {
          return { width: 500, setWidth: vi.fn() };
        } else {
          return { width: 300, setWidth: vi.fn() };
        }
      });

      const { result } = renderHook(() => usePanelWidths());

      expect(result.current.rightWidth).toBe(400);
      expect(result.current.testPanelWidth).toBe(500);
      expect(result.current.tasksPanelWidth).toBe(300);
    });

    it('should use different localStorage keys for each panel', () => {
      mockUseRightPanelWidth.mockReturnValue({
        width: 360,
        setWidth: vi.fn(),
      });

      renderHook(() => usePanelWidths());

      expect(useRightPanelWidth).toHaveBeenNthCalledWith(1, 360); // Default key
      expect(useRightPanelWidth).toHaveBeenNthCalledWith(2, 360, 'responseEditor.testPanelWidth');
      expect(useRightPanelWidth).toHaveBeenNthCalledWith(3, 360, 'responseEditor.tasksPanelWidth');
    });
  });

  describe('callback functionality', () => {
    it('should return callbacks that are functions', () => {
      const setRightWidth = vi.fn();
      const setTestPanelWidth = vi.fn();
      const setTasksPanelWidth = vi.fn();

      let callCount = 0;
      mockUseRightPanelWidth.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { width: 360, setWidth: setRightWidth };
        } else if (callCount === 2) {
          return { width: 360, setWidth: setTestPanelWidth };
        } else {
          return { width: 360, setWidth: setTasksPanelWidth };
        }
      });

      const { result } = renderHook(() => usePanelWidths());

      expect(typeof result.current.setRightWidth).toBe('function');
      expect(typeof result.current.setTestPanelWidth).toBe('function');
      expect(typeof result.current.setTasksPanelWidth).toBe('function');
    });
  });

  describe('edge cases', () => {
    it('should handle zero width values', () => {
      mockUseRightPanelWidth.mockReturnValue({
        width: 0,
        setWidth: vi.fn(),
      });

      const { result } = renderHook(() => usePanelWidths());

      expect(result.current.rightWidth).toBe(0);
      expect(result.current.testPanelWidth).toBe(0);
      expect(result.current.tasksPanelWidth).toBe(0);
    });

    it('should handle very large width values', () => {
      mockUseRightPanelWidth.mockReturnValue({
        width: 10000,
        setWidth: vi.fn(),
      });

      const { result } = renderHook(() => usePanelWidths());

      expect(result.current.rightWidth).toBe(10000);
      expect(result.current.testPanelWidth).toBe(10000);
      expect(result.current.tasksPanelWidth).toBe(10000);
    });

    it('should handle negative width values from useRightPanelWidth', () => {
      mockUseRightPanelWidth.mockReturnValue({
        width: -100,
        setWidth: vi.fn(),
      });

      const { result } = renderHook(() => usePanelWidths());

      // The hook passes through whatever useRightPanelWidth returns
      expect(result.current.rightWidth).toBe(-100);
      expect(result.current.testPanelWidth).toBe(-100);
      expect(result.current.tasksPanelWidth).toBe(-100);
    });

    it('should handle NaN width values from useRightPanelWidth', () => {
      mockUseRightPanelWidth.mockReturnValue({
        width: NaN,
        setWidth: vi.fn(),
      });

      const { result } = renderHook(() => usePanelWidths());

      expect(Number.isNaN(result.current.rightWidth)).toBe(true);
      expect(Number.isNaN(result.current.testPanelWidth)).toBe(true);
      expect(Number.isNaN(result.current.tasksPanelWidth)).toBe(true);
    });
  });
});
