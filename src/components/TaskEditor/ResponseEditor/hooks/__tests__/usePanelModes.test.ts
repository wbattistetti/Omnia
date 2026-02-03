// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePanelModes } from '../usePanelModes';
import type { RightPanelMode } from '../../RightPanel';

/**
 * Tests for usePanelModes
 *
 * This hook manages panel mode handlers with localStorage persistence.
 * We test observable behaviors: state updates, localStorage persistence, error handling, and saveRightMode logic.
 *
 * WHAT WE TEST:
 * - saveLeftPanelMode: updates state and localStorage
 * - saveTestPanelMode: updates state and localStorage
 * - saveTasksPanelMode: updates state and localStorage
 * - saveRightMode: conditional logic (chat -> test, none -> left, other -> left)
 * - localStorage persistence (success and error cases)
 * - Callback stability (useCallback dependencies)
 * - Edge cases (localStorage unavailable, invalid values)
 *
 * WHY IT'S IMPORTANT:
 * - Panel modes control UI visibility and layout
 * - localStorage persistence maintains user preferences across sessions
 * - saveRightMode provides backward compatibility
 * - Incorrect mode handling can break the editor layout
 * - Error handling prevents crashes when localStorage is unavailable
 */

describe('usePanelModes', () => {
  let setLeftPanelMode: ReturnType<typeof vi.fn>;
  let setTestPanelMode: ReturnType<typeof vi.fn>;
  let setTasksPanelMode: ReturnType<typeof vi.fn>;
  let localStorageMock: Storage;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock setters
    setLeftPanelMode = vi.fn();
    setTestPanelMode = vi.fn();
    setTasksPanelMode = vi.fn();

    // Mock localStorage
    localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    };

    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('saveLeftPanelMode', () => {
    it('should update state and localStorage when called', () => {
      const { result } = renderHook(() =>
        usePanelModes({
          setLeftPanelMode,
          setTestPanelMode,
          setTasksPanelMode,
        })
      );

      const mode: RightPanelMode = 'actions';
      result.current.saveLeftPanelMode(mode);

      expect(setLeftPanelMode).toHaveBeenCalledWith(mode);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'responseEditor.leftPanelMode',
        mode
      );
    });

    it('should handle localStorage errors gracefully', () => {
      const { result } = renderHook(() =>
        usePanelModes({
          setLeftPanelMode,
          setTestPanelMode,
          setTasksPanelMode,
        })
      );

      // Simulate localStorage error
      (localStorageMock.setItem as any).mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      const mode: RightPanelMode = 'validator';

      // Should not throw
      expect(() => {
        result.current.saveLeftPanelMode(mode);
      }).not.toThrow();

      // State should still be updated
      expect(setLeftPanelMode).toHaveBeenCalledWith(mode);
    });

    it('should work with all valid RightPanelMode values', () => {
      const { result } = renderHook(() =>
        usePanelModes({
          setLeftPanelMode,
          setTestPanelMode,
          setTasksPanelMode,
        })
      );

      const modes: RightPanelMode[] = ['actions', 'validator', 'testset', 'chat', 'styles', 'none'];

      modes.forEach((mode) => {
        vi.clearAllMocks();
        result.current.saveLeftPanelMode(mode);
        expect(setLeftPanelMode).toHaveBeenCalledWith(mode);
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          'responseEditor.leftPanelMode',
          mode
        );
      });
    });
  });

  describe('saveTestPanelMode', () => {
    it('should update state and localStorage when called', () => {
      const { result } = renderHook(() =>
        usePanelModes({
          setLeftPanelMode,
          setTestPanelMode,
          setTasksPanelMode,
        })
      );

      const mode: RightPanelMode = 'chat';
      result.current.saveTestPanelMode(mode);

      expect(setTestPanelMode).toHaveBeenCalledWith(mode);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'responseEditor.testPanelMode',
        mode
      );
    });

    it('should handle localStorage errors gracefully', () => {
      const { result } = renderHook(() =>
        usePanelModes({
          setLeftPanelMode,
          setTestPanelMode,
          setTasksPanelMode,
        })
      );

      (localStorageMock.setItem as any).mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      const mode: RightPanelMode = 'testset';

      expect(() => {
        result.current.saveTestPanelMode(mode);
      }).not.toThrow();

      expect(setTestPanelMode).toHaveBeenCalledWith(mode);
    });
  });

  describe('saveTasksPanelMode', () => {
    it('should update state and localStorage when called', () => {
      const { result } = renderHook(() =>
        usePanelModes({
          setLeftPanelMode,
          setTestPanelMode,
          setTasksPanelMode,
        })
      );

      const mode: RightPanelMode = 'actions';
      result.current.saveTasksPanelMode(mode);

      expect(setTasksPanelMode).toHaveBeenCalledWith(mode);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'responseEditor.tasksPanelMode',
        mode
      );
    });

    it('should handle localStorage errors gracefully', () => {
      const { result } = renderHook(() =>
        usePanelModes({
          setLeftPanelMode,
          setTestPanelMode,
          setTasksPanelMode,
        })
      );

      (localStorageMock.setItem as any).mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      const mode: RightPanelMode = 'validator';

      expect(() => {
        result.current.saveTasksPanelMode(mode);
      }).not.toThrow();

      expect(setTasksPanelMode).toHaveBeenCalledWith(mode);
    });
  });

  describe('saveRightMode', () => {
    it('should call saveTestPanelMode when mode is "chat"', () => {
      const { result } = renderHook(() =>
        usePanelModes({
          setLeftPanelMode,
          setTestPanelMode,
          setTasksPanelMode,
        })
      );

      const mode: RightPanelMode = 'chat';
      result.current.saveRightMode(mode);

      expect(setTestPanelMode).toHaveBeenCalledWith(mode);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'responseEditor.testPanelMode',
        mode
      );
      expect(setLeftPanelMode).not.toHaveBeenCalled();
    });

    it('should call saveLeftPanelMode when mode is "none"', () => {
      const { result } = renderHook(() =>
        usePanelModes({
          setLeftPanelMode,
          setTestPanelMode,
          setTasksPanelMode,
        })
      );

      const mode: RightPanelMode = 'none';
      result.current.saveRightMode(mode);

      expect(setLeftPanelMode).toHaveBeenCalledWith(mode);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'responseEditor.leftPanelMode',
        mode
      );
      expect(setTestPanelMode).not.toHaveBeenCalled();
    });

    it('should call saveLeftPanelMode for other modes (actions, validator, testset, styles)', () => {
      const { result } = renderHook(() =>
        usePanelModes({
          setLeftPanelMode,
          setTestPanelMode,
          setTasksPanelMode,
        })
      );

      const modes: RightPanelMode[] = ['actions', 'validator', 'testset', 'styles'];

      modes.forEach((mode) => {
        vi.clearAllMocks();
        result.current.saveRightMode(mode);

        expect(setLeftPanelMode).toHaveBeenCalledWith(mode);
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          'responseEditor.leftPanelMode',
          mode
        );
        expect(setTestPanelMode).not.toHaveBeenCalled();
      });
    });

    it('should handle localStorage errors gracefully', () => {
      const { result } = renderHook(() =>
        usePanelModes({
          setLeftPanelMode,
          setTestPanelMode,
          setTasksPanelMode,
        })
      );

      (localStorageMock.setItem as any).mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      // Test with 'chat'
      expect(() => {
        result.current.saveRightMode('chat');
      }).not.toThrow();
      expect(setTestPanelMode).toHaveBeenCalledWith('chat');

      vi.clearAllMocks();

      // Test with 'none'
      expect(() => {
        result.current.saveRightMode('none');
      }).not.toThrow();
      expect(setLeftPanelMode).toHaveBeenCalledWith('none');
    });
  });

  describe('callback stability', () => {
    it('should return stable callbacks when setters do not change', () => {
      const { result, rerender } = renderHook(() =>
        usePanelModes({
          setLeftPanelMode,
          setTestPanelMode,
          setTasksPanelMode,
        })
      );

      const firstCallbacks = {
        saveLeftPanelMode: result.current.saveLeftPanelMode,
        saveTestPanelMode: result.current.saveTestPanelMode,
        saveTasksPanelMode: result.current.saveTasksPanelMode,
        saveRightMode: result.current.saveRightMode,
      };

      rerender();

      expect(result.current.saveLeftPanelMode).toBe(firstCallbacks.saveLeftPanelMode);
      expect(result.current.saveTestPanelMode).toBe(firstCallbacks.saveTestPanelMode);
      expect(result.current.saveTasksPanelMode).toBe(firstCallbacks.saveTasksPanelMode);
      expect(result.current.saveRightMode).toBe(firstCallbacks.saveRightMode);
    });

    it('should return new callbacks when setters change', () => {
      const { result, rerender } = renderHook(
        ({ setLeftPanelMode, setTestPanelMode, setTasksPanelMode }) =>
          usePanelModes({
            setLeftPanelMode,
            setTestPanelMode,
            setTasksPanelMode,
          }),
        {
          initialProps: {
            setLeftPanelMode,
            setTestPanelMode,
            setTasksPanelMode,
          },
        }
      );

      const firstCallbacks = {
        saveLeftPanelMode: result.current.saveLeftPanelMode,
        saveTestPanelMode: result.current.saveTestPanelMode,
        saveTasksPanelMode: result.current.saveTasksPanelMode,
        saveRightMode: result.current.saveRightMode,
      };

      const newSetLeftPanelMode = vi.fn();
      rerender({
        setLeftPanelMode: newSetLeftPanelMode,
        setTestPanelMode,
        setTasksPanelMode,
      });

      expect(result.current.saveLeftPanelMode).not.toBe(firstCallbacks.saveLeftPanelMode);
      expect(result.current.saveTestPanelMode).toBe(firstCallbacks.saveTestPanelMode);
      expect(result.current.saveTasksPanelMode).toBe(firstCallbacks.saveTasksPanelMode);
      expect(result.current.saveRightMode).not.toBe(firstCallbacks.saveRightMode);
    });
  });

  describe('edge cases', () => {
    it('should work when localStorage is undefined', () => {
      // Remove localStorage
      Object.defineProperty(window, 'localStorage', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() =>
        usePanelModes({
          setLeftPanelMode,
          setTestPanelMode,
          setTasksPanelMode,
        })
      );

      // Should not throw
      expect(() => {
        result.current.saveLeftPanelMode('actions');
      }).not.toThrow();

      expect(setLeftPanelMode).toHaveBeenCalledWith('actions');
    });

    it('should work when localStorage.setItem throws different error types', () => {
      const { result } = renderHook(() =>
        usePanelModes({
          setLeftPanelMode,
          setTestPanelMode,
          setTasksPanelMode,
        })
      );

      const errors = [
        new Error('Storage quota exceeded'),
        new TypeError('Cannot read property'),
        'String error',
      ];

      errors.forEach((error) => {
        (localStorageMock.setItem as any).mockImplementation(() => {
          throw error;
        });

        expect(() => {
          result.current.saveLeftPanelMode('actions');
        }).not.toThrow();

        expect(setLeftPanelMode).toHaveBeenCalledWith('actions');
        vi.clearAllMocks();
      });
    });
  });
});
