import { renderHook, act } from '@testing-library/react';
import { useNodeManager } from '../useNodeManager';

describe('useNodeManager', () => {
  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useNodeManager());
    
    expect(result.current.nodeState.title).toBe('New Node');
    expect(result.current.nodeState.isEditing).toBe(false);
    expect(result.current.nodeState.isTemporary).toBe(false);
    expect(result.current.nodeState.hidden).toBe(false);
    expect(result.current.nodeState.hideUncheckedRows).toBe(false);
  });

  it('should initialize with provided values', () => {
    const { result } = renderHook(() => useNodeManager('Custom Title', true, true, true, true));
    
    expect(result.current.nodeState.title).toBe('Custom Title');
    expect(result.current.nodeState.isEditing).toBe(true);
    expect(result.current.nodeState.isTemporary).toBe(true);
    expect(result.current.nodeState.hidden).toBe(true);
    expect(result.current.nodeState.hideUncheckedRows).toBe(true);
  });

  it('should set title correctly', () => {
    const { result } = renderHook(() => useNodeManager());
    
    act(() => {
      result.current.nodeActions.setTitle('New Title');
    });
    
    expect(result.current.nodeState.title).toBe('New Title');
  });

  it('should set editing state correctly', () => {
    const { result } = renderHook(() => useNodeManager());
    
    act(() => {
      result.current.nodeActions.setEditing(true);
    });
    
    expect(result.current.nodeState.isEditing).toBe(true);
  });

  it('should create empty node correctly', () => {
    const { result } = renderHook(() => useNodeManager());
    
    let emptyNode;
    act(() => {
      emptyNode = result.current.nodeActions.createEmptyNode();
    });
    
    expect(emptyNode).toEqual({
      title: 'Title missing...',
      rows: [{ id: '1', text: '', included: true, mode: 'Message' }],
      focusRowId: '1'
    });
  });

  it('should handle canvas click for empty node', () => {
    const { result } = renderHook(() => useNodeManager());
    const mockDeleteEmptyNode = jest.fn();
    
    act(() => {
      result.current.nodeEvents.onCanvasClick([], '1', mockDeleteEmptyNode);
    });
    
    expect(mockDeleteEmptyNode).toHaveBeenCalled();
  });

  it('should handle canvas click for node with single empty row', () => {
    const { result } = renderHook(() => useNodeManager());
    const mockDeleteEmptyNode = jest.fn();
    const emptyRows = [{ id: '1', text: '', included: true, mode: 'Message' as const }];
    
    act(() => {
      result.current.nodeEvents.onCanvasClick(emptyRows, '1', mockDeleteEmptyNode);
    });
    
    expect(mockDeleteEmptyNode).toHaveBeenCalled();
  });

  it('should not delete node with filled row on canvas click', () => {
    const { result } = renderHook(() => useNodeManager());
    const mockDeleteEmptyNode = jest.fn();
    const filledRows = [{ id: '1', text: 'Some text', included: true, mode: 'Message' as const }];
    
    act(() => {
      result.current.nodeEvents.onCanvasClick(filledRows, '1', mockDeleteEmptyNode);
    });
    
    expect(mockDeleteEmptyNode).not.toHaveBeenCalled();
  });
});
