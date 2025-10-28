import { renderHook, act } from '@testing-library/react';
import { useRowManager } from '../useRowManager';
import { NodeRowData } from '../../types/project';

const mockInitialRows: NodeRowData[] = [
  { id: '1', text: 'First row', included: true, mode: 'Message' },
  { id: '2', text: 'Second row', included: true, mode: 'Message' }
];

describe('useRowManager', () => {
  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useRowManager());

    expect(result.current.rowState.rows).toEqual([]);
    expect(result.current.rowState.editingRowId).toBeNull();
  });

  it('should initialize with provided rows', () => {
    const { result } = renderHook(() => useRowManager(mockInitialRows));

    expect(result.current.rowState.rows).toEqual(mockInitialRows);
  });

  it('should create a new row', () => {
    const { result } = renderHook(() => useRowManager());

    act(() => {
      const newRowId = result.current.rowActions.createRow('New row text');
      expect(newRowId).toBe('1');
    });

    expect(result.current.rowState.rows).toHaveLength(1);
    expect(result.current.rowState.rows[0].text).toBe('New row text');
  });

  it('should update a row', () => {
    const { result } = renderHook(() => useRowManager(mockInitialRows));

    act(() => {
      result.current.rowActions.updateRow('1', 'Updated text');
    });

    expect(result.current.rowState.rows[0].text).toBe('Updated text');
    expect(result.current.rowState.rows[1].text).toBe('Second row'); // unchanged
  });

  it('should delete a row', () => {
    const { result } = renderHook(() => useRowManager(mockInitialRows));

    act(() => {
      result.current.rowActions.deleteRow('1');
    });

    expect(result.current.rowState.rows).toHaveLength(1);
    expect(result.current.rowState.rows[0].id).toBe('2');
  });

  it('should move a row', () => {
    const { result } = renderHook(() => useRowManager(mockInitialRows));

    act(() => {
      result.current.rowActions.moveRow(0, 1);
    });

    expect(result.current.rowState.rows[0].id).toBe('2');
    expect(result.current.rowState.rows[1].id).toBe('1');
  });

  it('should set editing row', () => {
    const { result } = renderHook(() => useRowManager());

    act(() => {
      result.current.rowActions.setEditingRow('row-1');
    });

    expect(result.current.rowState.editingRowId).toBe('row-1');
  });

  it('should add row after fill when bottom row is filled', () => {
    const { result } = renderHook(() => useRowManager([
      { id: '1', text: '', included: true, mode: 'Message' }
    ]));

    act(() => {
      const newRowId = result.current.rowActions.addRowAfterFill('1', 'Filled text');
      expect(newRowId).toBe('2');
    });

    expect(result.current.rowState.rows).toHaveLength(2);
    expect(result.current.rowState.rows[0].text).toBe('Filled text');
    expect(result.current.rowState.rows[1].text).toBe('');
  });
});
