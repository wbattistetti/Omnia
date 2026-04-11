import { renderHook, act } from '@testing-library/react';
import { useThemeEditor } from '../../hooks/useThemeEditor';
import { ThemeProvider } from '../../context/ThemeContext';

// ============================================================================
// TEST USE THEME EDITOR HOOK
// ============================================================================

describe('useThemeEditor', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider>{children}</ThemeProvider>
  );

  beforeEach(() => {
    // Mock document.querySelector
    const mockElement = {
      style: {
        background: '#ffffff',
        color: '#000000'
      }
    };
    jest.spyOn(document, 'querySelector').mockReturnValue(mockElement as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should return initial state', () => {
      const { result } = renderHook(() => useThemeEditor(), { wrapper });

      expect(result.current.isEditMode).toBe(false);
      expect(typeof result.current.toggleEditMode).toBe('function');
      expect(typeof result.current.createClickHandler).toBe('function');
      expect(typeof result.current.createAutoDetectionHandler).toBe('function');
    });
  });

  describe('Toggle Edit Mode', () => {
    it('should toggle edit mode', () => {
      const { result } = renderHook(() => useThemeEditor(), { wrapper });

      // Initial state
      expect(result.current.isEditMode).toBe(false);

      // Toggle on
      act(() => {
        result.current.toggleEditMode();
      });

      expect(result.current.isEditMode).toBe(true);

      // Toggle off
      act(() => {
        result.current.toggleEditMode();
      });

      expect(result.current.isEditMode).toBe(false);
    });
  });

  describe('Create Click Handler', () => {
    it('should create click handler function', () => {
      const { result } = renderHook(() => useThemeEditor(), { wrapper });

      const clickHandler = result.current.createClickHandler('test-element', 'background');
      expect(typeof clickHandler).toBe('function');
    });

    it('should handle click events', () => {
      const { result } = renderHook(() => useThemeEditor(), { wrapper });

      const clickHandler = result.current.createClickHandler('test-element', 'background');
      
      // Enable edit mode first
      act(() => {
        result.current.toggleEditMode();
      });

      // Simulate click event
      const mockEvent = {
        clientX: 100,
        clientY: 200,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn()
      };

      act(() => {
        clickHandler(mockEvent as any);
      });

      // Should not throw
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('should not handle clicks when edit mode is disabled', () => {
      const { result } = renderHook(() => useThemeEditor(), { wrapper });

      const clickHandler = result.current.createClickHandler('test-element', 'background');
      
      const mockEvent = {
        clientX: 100,
        clientY: 200,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn()
      };

      act(() => {
        clickHandler(mockEvent as any);
      });

      // Should not call preventDefault when edit mode is off
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('Create Auto Detection Handler', () => {
    it('should create auto detection handler function', () => {
      const { result } = renderHook(() => useThemeEditor(), { wrapper });

      const autoDetectionHandler = result.current.createAutoDetectionHandler();
      expect(typeof autoDetectionHandler).toBe('function');
    });

    it('should handle auto detection events', () => {
      const { result } = renderHook(() => useThemeEditor(), { wrapper });

      const autoDetectionHandler = result.current.createAutoDetectionHandler();
      
      // Enable edit mode first
      act(() => {
        result.current.toggleEditMode();
      });

      // Simulate auto detection event
      const mockEvent = {
        target: {
          getAttribute: jest.fn().mockReturnValue('test-element'),
          closest: jest.fn().mockReturnValue({
            getAttribute: jest.fn().mockReturnValue('test-element')
          })
        },
        preventDefault: jest.fn(),
        stopPropagation: jest.fn()
      };

      act(() => {
        autoDetectionHandler(mockEvent as any);
      });

      // Should not throw
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('should handle missing theme element gracefully', () => {
      const { result } = renderHook(() => useThemeEditor(), { wrapper });

      const autoDetectionHandler = result.current.createAutoDetectionHandler();
      
      // Enable edit mode first
      act(() => {
        result.current.toggleEditMode();
      });

      // Simulate event without theme element
      const mockEvent = {
        target: {
          getAttribute: jest.fn().mockReturnValue(null),
          closest: jest.fn().mockReturnValue(null)
        },
        preventDefault: jest.fn(),
        stopPropagation: jest.fn()
      };

      expect(() => {
        act(() => {
          autoDetectionHandler(mockEvent as any);
        });
      }).not.toThrow();
    });
  });

  describe('Element Detection', () => {
    it('should detect theme elements correctly', () => {
      const { result } = renderHook(() => useThemeEditor(), { wrapper });

      // Enable edit mode
      act(() => {
        result.current.toggleEditMode();
      });

      const mockEvent = {
        target: {
          getAttribute: jest.fn().mockReturnValue('sidebar-header'),
          closest: jest.fn().mockReturnValue({
            getAttribute: jest.fn().mockReturnValue('sidebar-header')
          })
        },
        clientX: 100,
        clientY: 200,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn()
      };

      const clickHandler = result.current.createClickHandler('sidebar-header', 'background');
      
      act(() => {
        clickHandler(mockEvent as any);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('should handle different element types', () => {
      const { result } = renderHook(() => useThemeEditor(), { wrapper });

      // Enable edit mode
      act(() => {
        result.current.toggleEditMode();
      });

      const elements = ['sidebar-header', 'accordion-header', 'flowchart-node', 'button-primary'];
      
      elements.forEach(elementId => {
        const mockEvent = {
          target: {
            getAttribute: jest.fn().mockReturnValue(elementId),
            closest: jest.fn().mockReturnValue({
              getAttribute: jest.fn().mockReturnValue(elementId)
            })
          },
          clientX: 100,
          clientY: 200,
          preventDefault: jest.fn(),
          stopPropagation: jest.fn()
        };

        const clickHandler = result.current.createClickHandler(elementId, 'background');
        
        expect(() => {
          act(() => {
            clickHandler(mockEvent as any);
          });
        }).not.toThrow();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing DOM elements gracefully', () => {
      jest.spyOn(document, 'querySelector').mockReturnValue(null);
      
      const { result } = renderHook(() => useThemeEditor(), { wrapper });

      // Enable edit mode
      act(() => {
        result.current.toggleEditMode();
      });

      const clickHandler = result.current.createClickHandler('test-element', 'background');
      
      const mockEvent = {
        clientX: 100,
        clientY: 200,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn()
      };

      expect(() => {
        act(() => {
          clickHandler(mockEvent as any);
        });
      }).not.toThrow();
    });

    it('should handle action errors gracefully', () => {
      const { result } = renderHook(() => useThemeEditor(), { wrapper });

      // Enable edit mode
      act(() => {
        result.current.toggleEditMode();
      });

      const clickHandler = result.current.createClickHandler('test-element', 'background');
      
      const mockEvent = {
        clientX: 100,
        clientY: 200,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn()
      };

      // Mock console.error to avoid noise in tests
      const originalError = console.error;
      console.error = jest.fn();

      expect(() => {
        act(() => {
          clickHandler(mockEvent as any);
        });
      }).not.toThrow();

      console.error = originalError;
    });
  });

  describe('Integration with Theme Context', () => {
    it('should use theme context actions', () => {
      const { result } = renderHook(() => useThemeEditor(), { wrapper });

      // Enable edit mode
      act(() => {
        result.current.toggleEditMode();
      });

      expect(result.current.isEditMode).toBe(true);

      // Disable edit mode
      act(() => {
        result.current.toggleEditMode();
      });

      expect(result.current.isEditMode).toBe(false);
    });

    it('should maintain state consistency', () => {
      const { result } = renderHook(() => useThemeEditor(), { wrapper });

      // Multiple toggles should work correctly
      act(() => {
        result.current.toggleEditMode(); // true
        result.current.toggleEditMode(); // false
        result.current.toggleEditMode(); // true
      });

      expect(result.current.isEditMode).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should not create new functions on every render', () => {
      const { result, rerender } = renderHook(() => useThemeEditor(), { wrapper });

      const initialToggleFunction = result.current.toggleEditMode;
      const initialClickHandler = result.current.createClickHandler('test', 'background');

      rerender();

      expect(result.current.toggleEditMode).toBe(initialToggleFunction);
      expect(result.current.createClickHandler('test', 'background')).toBe(initialClickHandler);
    });
  });
}); 