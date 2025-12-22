import { renderHook, act } from '@testing-library/react';
import { useIntellisenseManager } from '../useIntellisenseManager';
import { IntellisenseItem } from '../../components/Intellisense/IntellisenseTypes';

const mockItems: IntellisenseItem[] = [
  { id: '1', name: 'Test Item 1', categoryType: 'taskTemplates', type: 'agentAct' },
  { id: '2', name: 'Test Item 2', categoryType: 'backendActions', type: 'backendCall' }
];

describe('useIntellisenseManager', () => {
  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useIntellisenseManager());

    expect(result.current.intellisenseState.isOpen).toBe(false);
    expect(result.current.intellisenseState.query).toBe('');
    expect(result.current.intellisenseState.position).toEqual({ x: 0, y: 0 });
    expect(result.current.intellisenseState.selectedIndex).toBe(0);
    expect(result.current.intellisenseState.items).toEqual([]);
  });

  it('should open intellisense correctly', () => {
    const { result } = renderHook(() => useIntellisenseManager());

    act(() => {
      result.current.intellisenseActions.openIntellisense('test query', { x: 100, y: 200 });
    });

    expect(result.current.intellisenseState.isOpen).toBe(true);
    expect(result.current.intellisenseState.query).toBe('test query');
    expect(result.current.intellisenseState.position).toEqual({ x: 100, y: 200 });
    expect(result.current.intellisenseState.selectedIndex).toBe(0);
  });

  it('should close intellisense correctly', () => {
    const { result } = renderHook(() => useIntellisenseManager());

    act(() => {
      result.current.intellisenseActions.openIntellisense('test', { x: 0, y: 0 });
      result.current.intellisenseActions.closeIntellisense();
    });

    expect(result.current.intellisenseState.isOpen).toBe(false);
    expect(result.current.intellisenseState.query).toBe('');
    expect(result.current.intellisenseState.selectedIndex).toBe(0);
    expect(result.current.intellisenseState.items).toEqual([]);
  });

  it('should set items correctly', () => {
    const { result } = renderHook(() => useIntellisenseManager());

    act(() => {
      result.current.intellisenseActions.setItems(mockItems);
    });

    expect(result.current.intellisenseState.items).toEqual(mockItems);
    expect(result.current.intellisenseState.selectedIndex).toBe(0);
  });

  it('should navigate up correctly', () => {
    const { result } = renderHook(() => useIntellisenseManager());

    act(() => {
      result.current.intellisenseActions.setItems(mockItems);
      result.current.intellisenseActions.setSelectedIndex(1);
      result.current.intellisenseActions.navigateUp();
    });

    expect(result.current.intellisenseState.selectedIndex).toBe(0);
  });

  it('should navigate down correctly', () => {
    const { result } = renderHook(() => useIntellisenseManager());

    act(() => {
      result.current.intellisenseActions.setItems(mockItems);
      result.current.intellisenseActions.navigateDown();
    });

    expect(result.current.intellisenseState.selectedIndex).toBe(1);
  });

  it('should handle keyboard navigation', () => {
    const { result } = renderHook(() => useIntellisenseManager());
    const mockOnSelect = jest.fn();

    act(() => {
      result.current.intellisenseActions.openIntellisense('test', { x: 0, y: 0 });
      result.current.intellisenseActions.setItems(mockItems);
    });

    // Test Arrow Down
    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      result.current.intellisenseEvents.onKeyDown(event as any, mockOnSelect);
    });

    expect(result.current.intellisenseState.selectedIndex).toBe(1);

    // Test Arrow Up
    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      result.current.intellisenseEvents.onKeyDown(event as any, mockOnSelect);
    });

    expect(result.current.intellisenseState.selectedIndex).toBe(0);

    // Test Enter
    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      result.current.intellisenseEvents.onKeyDown(event as any, mockOnSelect);
    });

    expect(mockOnSelect).toHaveBeenCalledWith(mockItems[0]);
    expect(result.current.intellisenseState.isOpen).toBe(false);

    // Test Escape
    act(() => {
      result.current.intellisenseActions.openIntellisense('test', { x: 0, y: 0 });
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      result.current.intellisenseEvents.onKeyDown(event as any, mockOnSelect);
    });

    expect(result.current.intellisenseState.isOpen).toBe(false);
  });

  it('should handle item click', () => {
    const { result } = renderHook(() => useIntellisenseManager());
    const mockOnSelect = jest.fn();

    act(() => {
      result.current.intellisenseActions.openIntellisense('test', { x: 0, y: 0 });
      result.current.intellisenseActions.setItems(mockItems);
      result.current.intellisenseEvents.onItemClick(mockItems[0], mockOnSelect);
    });

    expect(mockOnSelect).toHaveBeenCalledWith(mockItems[0]);
    expect(result.current.intellisenseState.isOpen).toBe(false);
  });
});
