import { renderHook, act } from '@testing-library/react';
import { useFocusManager } from '../useFocusManager';

describe('useFocusManager', () => {
  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useFocusManager());
    
    expect(result.current.focusState.activeRowId).toBeNull();
    expect(result.current.focusState.isNewNode).toBe(false);
    expect(result.current.focusState.focusRowId).toBeNull();
  });

  it('should initialize with focusRowId when provided', () => {
    const { result } = renderHook(() => useFocusManager('row-1'));
    
    expect(result.current.focusState.activeRowId).toBe('row-1');
    expect(result.current.focusState.focusRowId).toBe('row-1');
  });

  it('should set focus correctly', () => {
    const { result } = renderHook(() => useFocusManager());
    
    act(() => {
      result.current.focusActions.setFocus('row-2');
    });
    
    expect(result.current.focusState.activeRowId).toBe('row-2');
  });

  it('should clear focus correctly', () => {
    const { result } = renderHook(() => useFocusManager('row-1'));
    
    act(() => {
      result.current.focusActions.clearFocus();
    });
    
    expect(result.current.focusState.activeRowId).toBeNull();
  });

  it('should handle Enter key correctly', () => {
    const { result } = renderHook(() => useFocusManager());
    const mockCreateNewRow = jest.fn(() => 'new-row-id');
    
    act(() => {
      result.current.focusActions.handleEnterKey('current-row', mockCreateNewRow);
    });
    
    expect(mockCreateNewRow).toHaveBeenCalled();
    expect(result.current.focusState.activeRowId).toBe('new-row-id');
  });
});
