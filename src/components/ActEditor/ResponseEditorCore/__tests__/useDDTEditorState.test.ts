import { describe, it, expect } from 'vitest';
import { editorReducer, initialState, EditorState, EditorAction } from '../useDDTEditorState';

describe('useDDTEditorState', () => {
  describe('initialState', () => {
    it('should have correct initial values', () => {
      expect(initialState).toEqual({
        selectedStep: 'start',
        selectedNodeIndex: null,
        nodes: [],
        actionCatalog: [],
        showLabel: true
      });
    });
  });

  describe('editorReducer', () => {
    it('should handle SET_STEP action', () => {
      const action: EditorAction = { type: 'SET_STEP', step: 'success' };
      const newState = editorReducer(initialState, action);
      
      expect(newState.selectedStep).toBe('success');
      expect(newState).toEqual({
        ...initialState,
        selectedStep: 'success'
      });
    });

    it('should handle SET_SELECTED_NODE_INDEX action', () => {
      const action: EditorAction = { type: 'SET_SELECTED_NODE_INDEX', index: 1 };
      const newState = editorReducer(initialState, action);
      
      expect(newState.selectedNodeIndex).toBe(1);
    });

    it('should handle SET_NODES action', () => {
      const nodes = [{ id: '1', text: 'test' }];
      const action: EditorAction = { type: 'SET_NODES', nodes };
      const newState = editorReducer(initialState, action);
      
      expect(newState.nodes).toEqual(nodes);
    });

    it('should handle REMOVE_NODE action', () => {
      const stateWithNodes: EditorState = {
        ...initialState,
        nodes: [
          { id: '1', text: 'test1' },
          { id: '2', text: 'test2' }
        ]
      };
      
      const action: EditorAction = { type: 'REMOVE_NODE', id: '1' };
      const newState = editorReducer(stateWithNodes, action);
      
      expect(newState.nodes).toEqual([{ id: '2', text: 'test2' }]);
    });

    it('should handle SET_SHOW_LABEL action', () => {
      const action: EditorAction = { type: 'SET_SHOW_LABEL', value: false };
      const newState = editorReducer(initialState, action);
      
      expect(newState.showLabel).toBe(false);
    });

    it('should handle ADD_ESCALATION action', () => {
      const stateWithStep: EditorState = {
        ...initialState,
        selectedStep: 'noMatch'
      };
      
      const action: EditorAction = { type: 'ADD_ESCALATION' };
      const newState = editorReducer(stateWithStep, action);
      
      expect(newState.nodes).toHaveLength(1);
      expect(newState.nodes[0]).toMatchObject({
        text: 'recovery',
        type: 'escalation',
        level: 0,
        included: true,
        stepType: 'noMatch'
      });
      expect(newState.nodes[0].id).toMatch(/noMatch_escalation_/);
    });

    it('should not add escalation when no step is selected', () => {
      const stateWithoutStep: EditorState = {
        ...initialState,
        selectedStep: ''
      };
      
      const action: EditorAction = { type: 'ADD_ESCALATION' };
      const newState = editorReducer(stateWithoutStep, action);
      
      expect(newState).toEqual(stateWithoutStep);
    });

    it('should handle ADD_NODE action', () => {
      const newNode = { id: 'new', text: 'new node' };
      const action: EditorAction = { type: 'ADD_NODE', node: newNode };
      const newState = editorReducer(initialState, action);
      
      expect(newState.nodes).toEqual([newNode]);
    });

    it('should return same state for unknown action', () => {
      const action = { type: 'UNKNOWN_ACTION' as any };
      const newState = editorReducer(initialState, action);
      
      expect(newState).toEqual(initialState);
    });
  });
}); 