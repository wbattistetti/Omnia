import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTreeDragDrop } from '../useTreeDragDrop';
import { TreeNodeProps } from '../../types';

// Mock react-dnd
vi.mock('react-dnd', () => ({
  useDrop: vi.fn(() => [{
    isOver: false
  }, vi.fn()])
}));

describe('useTreeDragDrop', () => {
  const mockNodes: TreeNodeProps[] = [
    { id: '1', text: 'Test Node 1', type: 'root' },
    { id: '2', text: 'Test Node 2', type: 'nomatch', level: 1, parentId: '1' }
  ];

  const mockProps = {
    nodes: mockNodes,
    onDrop: vi.fn(),
    containerRef: { current: null },
    setSelectedNodeId: vi.fn()
  };

  it('should return expected structure', () => {
    const { result } = renderHook(() => useTreeDragDrop(mockProps));

    expect(result.current).toHaveProperty('isOver');
    expect(result.current).toHaveProperty('dropPreviewIdx');
    expect(result.current).toHaveProperty('dropPreviewPosition');
    expect(result.current).toHaveProperty('setDropPreviewIdx');
    expect(result.current).toHaveProperty('setDropPreviewPosition');
  });

  it('should initialize with correct default values', () => {
    const { result } = renderHook(() => useTreeDragDrop(mockProps));

    expect(result.current.isOver).toBe(false);
    expect(result.current.dropPreviewIdx).toBeNull();
    expect(result.current.dropPreviewPosition).toBeNull();
    expect(typeof result.current.setDropPreviewIdx).toBe('function');
    expect(typeof result.current.setDropPreviewPosition).toBe('function');
  });

  it('should accept valid props', () => {
    expect(() => {
      renderHook(() => useTreeDragDrop(mockProps));
    }).not.toThrow();
  });

  it('should handle empty nodes array', () => {
    const propsWithEmptyNodes = {
      ...mockProps,
      nodes: []
    };

    expect(() => {
      renderHook(() => useTreeDragDrop(propsWithEmptyNodes));
    }).not.toThrow();
  });

  it('should handle null containerRef', () => {
    const propsWithNullRef = {
      ...mockProps,
      containerRef: { current: null }
    };

    expect(() => {
      renderHook(() => useTreeDragDrop(propsWithNullRef));
    }).not.toThrow();
  });
}); 