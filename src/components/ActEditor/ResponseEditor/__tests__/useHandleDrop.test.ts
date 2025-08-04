import { describe, it, expect, vi } from 'vitest';
import { handleDropWithInsert } from '../useHandleDrop';
import { TreeNodeProps } from '../types';

describe('useHandleDrop', () => {
  const mockDispatch = vi.fn();
  const mockNodes: TreeNodeProps[] = [
    { id: 'node1', text: 'Node 1', type: 'action', level: 0 },
    { id: 'escalation1', text: 'Escalation 1', type: 'escalation', level: 0 },
  ];

  const mockItem = {
    action: {
      id: 'testAction',
      label: 'Test Action',
    },
    icon: 'test-icon',
    color: '#ff0000',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleDropWithInsert', () => {
    it('should add node as root when targetId is null', () => {
      const result = handleDropWithInsert({
        editorNodes: mockNodes,
        targetId: null,
        position: 'before',
        item: mockItem,
        selectedStep: 'start',
        dispatch: mockDispatch,
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'ADD_NODE',
        node: expect.objectContaining({
          type: 'action',
          level: 0,
          parentId: undefined,
        }),
      });
      expect(result).toBeTruthy();
    });

    it('should add node as child of escalation when position is child', () => {
      const result = handleDropWithInsert({
        editorNodes: mockNodes,
        targetId: 'escalation1',
        position: 'child',
        item: mockItem,
        selectedStep: 'start',
        dispatch: mockDispatch,
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'ADD_NODE',
        node: expect.objectContaining({
          type: 'action',
          level: 1,
          parentId: 'escalation1',
        }),
      });
      expect(result).toBeTruthy();
    });

    it('should insert node before/after escalation using insertNodeAt', () => {
      const result = handleDropWithInsert({
        editorNodes: mockNodes,
        targetId: 'escalation1',
        position: 'before',
        item: mockItem,
        selectedStep: 'start',
        dispatch: mockDispatch,
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_NODES',
        nodes: expect.any(Array),
      });
      expect(result).toBeTruthy();
    });

    it('should insert node before/after action using insertNodeAt', () => {
      const result = handleDropWithInsert({
        editorNodes: mockNodes,
        targetId: 'node1',
        position: 'after',
        item: mockItem,
        selectedStep: 'start',
        dispatch: mockDispatch,
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_NODES',
        nodes: expect.any(Array),
      });
      expect(result).toBeTruthy();
    });

    it('should fallback to root when target node not found', () => {
      const result = handleDropWithInsert({
        editorNodes: mockNodes,
        targetId: 'nonexistent',
        position: 'before',
        item: mockItem,
        selectedStep: 'start',
        dispatch: mockDispatch,
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'ADD_NODE',
        node: expect.objectContaining({
          type: 'action',
          level: 0,
          parentId: undefined,
        }),
      });
      expect(result).toBeTruthy();
    });

    it('should return null when item has no action', () => {
      const result = handleDropWithInsert({
        editorNodes: mockNodes,
        targetId: 'node1',
        position: 'before',
        item: { noAction: true },
        selectedStep: 'start',
        dispatch: mockDispatch,
      });

      expect(mockDispatch).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should handle action with object label', () => {
      const itemWithObjectLabel = {
        action: {
          id: 'testAction',
          label: { it: 'Azione Test', en: 'Test Action' },
        },
        icon: 'test-icon',
        color: '#ff0000',
      };

      const result = handleDropWithInsert({
        editorNodes: mockNodes,
        targetId: null,
        position: 'before',
        item: itemWithObjectLabel,
        selectedStep: 'start',
        dispatch: mockDispatch,
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'ADD_NODE',
        node: expect.objectContaining({
          text: 'Azione Test',
          label: 'Azione Test',
        }),
      });
      expect(result).toBeTruthy();
    });
  });
}); 