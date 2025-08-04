import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorReducer, editorReducer, EditorState, EditorAction } from '../useEditorReducer';
import { renderHook, act } from '@testing-library/react';

const initialState: EditorState = {
  selectedStep: null,
  actionCatalog: [],
  showLabel: false,
  activeDragAction: null,
  nodes: [],
};

const sampleNode = {
  id: 'n1',
  text: 'Test Node',
  type: 'action',
};

const sampleNode2 = {
  id: 'n2',
  text: 'Second Node',
  type: 'action',
};

describe('editorReducer', () => {
  it('should return initial state', () => {
    const state = editorReducer(initialState, { type: 'SET_STEP', step: '' });
    expect(state.selectedStep).toBe('');
    expect(state.nodes).toEqual([]);
  });

  it('should set step', () => {
    const state = editorReducer(initialState, { type: 'SET_STEP', step: 'start' });
    expect(state.selectedStep).toBe('start');
  });

  it('should set action catalog', () => {
    const catalog = [{ id: 'a1', label: 'Azione' }];
    const state = editorReducer(initialState, { type: 'SET_ACTION_CATALOG', catalog });
    expect(state.actionCatalog).toEqual(catalog);
  });

  it('should set showLabel', () => {
    const state = editorReducer(initialState, { type: 'SET_SHOW_LABEL', show: true });
    expect(state.showLabel).toBe(true);
  });

  it('should set activeDragAction', () => {
    const action = { id: 'drag1' };
    const state = editorReducer(initialState, { type: 'SET_ACTIVE_DRAG_ACTION', action });
    expect(state.activeDragAction).toEqual(action);
  });

  it('should set nodes', () => {
    const nodes = [sampleNode];
    const state = editorReducer(initialState, { type: 'SET_NODES', nodes });
    expect(state.nodes).toEqual(nodes);
  });

  it('should add node', () => {
    const state = editorReducer(initialState, { type: 'ADD_NODE', node: sampleNode });
    expect(state.nodes.length).toBe(1);
    expect(state.nodes[0].id).toBe('n1');
  });

  it('should remove node', () => {
    const withNode = { ...initialState, nodes: [sampleNode] };
    const state = editorReducer(withNode, { type: 'REMOVE_NODE', id: 'n1' });
    expect(state.nodes.length).toBe(0);
  });

  it('should add escalation node', () => {
    const withStep = { ...initialState, selectedStep: 'start' };
    const state = editorReducer(withStep, { type: 'ADD_ESCALATION' });
    expect(state.nodes.length).toBe(1);
    expect(state.nodes[0].type).toBe('escalation');
  });

  it('should toggle escalation include', () => {
    const escalation = { id: 'esc1', text: 'Escalation', type: 'escalation', included: false };
    const withEsc = { ...initialState, nodes: [escalation] };
    const state = editorReducer(withEsc, { type: 'TOGGLE_ESCALATION_INCLUDE', id: 'esc1', included: true });
    expect(state.nodes[0].included).toBe(true);
  });

  it('should set all state', () => {
    const newState = { ...initialState, selectedStep: 'success' };
    const state = editorReducer(initialState, { type: 'SET_ALL_STATE', state: newState });
    expect(state.selectedStep).toBe('success');
  });
});

describe('useEditorReducer (hook)', () => {
  it('should handle undo/redo', () => {
    const { result } = renderHook(() => useEditorReducer(initialState));
    act(() => {
      result.current.dispatch({ type: 'ADD_NODE', node: sampleNode });
    });
    expect(result.current.state.nodes.length).toBe(1);

    act(() => {
      result.current.undo();
    });
    expect(result.current.state.nodes.length).toBe(0);

    act(() => {
      result.current.redo();
    });
    expect(result.current.state.nodes.length).toBe(1);
  });

  it('should not undo if no history', () => {
    const { result } = renderHook(() => useEditorReducer(initialState));
    act(() => {
      result.current.undo();
    });
    expect(result.current.state.nodes.length).toBe(0);
  });

  it('should not redo if at latest', () => {
    const { result } = renderHook(() => useEditorReducer(initialState));
    act(() => {
      result.current.redo();
    });
    expect(result.current.state.nodes.length).toBe(0);
  });

  it('should track canUndo and canRedo correctly', () => {
    const { result } = renderHook(() => useEditorReducer(initialState));
    
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);

    act(() => {
      result.current.dispatch({ type: 'ADD_NODE', node: sampleNode });
    });
    
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    act(() => {
      result.current.undo();
    });
    
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });
});