// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useResponseEditorState } from '../useResponseEditorState';
import type { RightPanelMode } from '../../RightPanel';

/**
 * Tests for useResponseEditorState
 *
 * This hook centralizes all state management for ResponseEditor using useState.
 * We test observable behaviors: initial values, state updates, and state independence.
 *
 * WHAT WE TEST:
 * - All states are initialized with correct default values
 * - Setters update state correctly
 * - States are independent (updating one doesn't affect others)
 * - Functional updates work correctly
 * - Edge cases (null values, empty arrays, etc.)
 *
 * WHY IT'S IMPORTANT:
 * - State management is critical for component behavior
 * - Incorrect initial values can break component functionality
 * - State independence ensures no side effects between unrelated states
 * - Setters must work correctly for component updates
 */

describe('useResponseEditorState', () => {
  describe('initial values', () => {
    it('should initialize all states with correct default values', () => {
      const { result } = renderHook(() => useResponseEditorState());

      expect(result.current.serviceUnavailable).toBeNull();
      expect(result.current.showContractDialog).toBe(false);
      expect(result.current.pendingContractChange).toBeNull();
      expect(result.current.escalationTasks).toEqual([]);
      expect(result.current.pendingEditorOpen).toBeNull();
      expect(result.current.showSynonyms).toBe(false);
      expect(result.current.showMessageReview).toBe(false);
      expect(result.current.selectedIntentIdForTraining).toBeNull();
      expect(result.current.showContractWizard).toBe(false);
      expect(result.current.selectedNode).toBeNull();
      expect(result.current.selectedNodePath).toBeNull();
      expect(result.current.taskTreeVersion).toBe(0);
      expect(result.current.leftPanelMode).toBe('actions');
      expect(result.current.testPanelMode).toBe('none');
      expect(result.current.tasksPanelMode).toBe('none');
      expect(result.current.sidebarManualWidth).toBeNull();
      expect(result.current.isDraggingSidebar).toBe(false);
      expect(result.current.draggingPanel).toBeNull();
    });
  });

  describe('service unavailable state', () => {
    it('should update serviceUnavailable when setServiceUnavailable is called', () => {
      const { result } = renderHook(() => useResponseEditorState());

      const serviceError = {
        service: 'test-service',
        message: 'Test error',
        endpoint: '/test/endpoint',
        onRetry: () => {},
      };

      act(() => {
        result.current.setServiceUnavailable(serviceError);
      });

      expect(result.current.serviceUnavailable).toEqual(serviceError);
    });

    it('should allow setting serviceUnavailable to null', () => {
      const { result } = renderHook(() => useResponseEditorState());

      act(() => {
        result.current.setServiceUnavailable({
          service: 'test',
          message: 'error',
        });
      });

      act(() => {
        result.current.setServiceUnavailable(null);
      });

      expect(result.current.serviceUnavailable).toBeNull();
    });
  });

  describe('contract change dialog state', () => {
    it('should update showContractDialog when setShowContractDialog is called', () => {
      const { result } = renderHook(() => useResponseEditorState());

      act(() => {
        result.current.setShowContractDialog(true);
      });

      expect(result.current.showContractDialog).toBe(true);
    });

    it('should update pendingContractChange when setPendingContractChange is called', () => {
      const { result } = renderHook(() => useResponseEditorState());

      const contractChange = {
        templateId: 'tpl-1',
        templateLabel: 'Template 1',
        modifiedContract: { field: 'value' },
      };

      act(() => {
        result.current.setPendingContractChange(contractChange);
      });

      expect(result.current.pendingContractChange).toEqual(contractChange);
    });
  });

  describe('escalation tasks state', () => {
    it('should update escalationTasks when setEscalationTasks is called', () => {
      const { result } = renderHook(() => useResponseEditorState());

      const tasks = [{ id: 'task-1' }, { id: 'task-2' }];

      act(() => {
        result.current.setEscalationTasks(tasks);
      });

      expect(result.current.escalationTasks).toEqual(tasks);
    });

    it('should allow functional updates for escalationTasks', () => {
      const { result } = renderHook(() => useResponseEditorState());

      act(() => {
        result.current.setEscalationTasks([{ id: 'task-1' }]);
      });

      act(() => {
        result.current.setEscalationTasks((prev) => [...prev, { id: 'task-2' }]);
      });

      expect(result.current.escalationTasks).toEqual([{ id: 'task-1' }, { id: 'task-2' }]);
    });
  });

  describe('pending editor state', () => {
    it('should update pendingEditorOpen when setPendingEditorOpen is called', () => {
      const { result } = renderHook(() => useResponseEditorState());

      const pendingEditor = {
        editorType: 'regex' as const,
        nodeId: 'node-1',
      };

      act(() => {
        result.current.setPendingEditorOpen(pendingEditor);
      });

      expect(result.current.pendingEditorOpen).toEqual(pendingEditor);
    });

    it('should allow setting pendingEditorOpen to null', () => {
      const { result } = renderHook(() => useResponseEditorState());

      act(() => {
        result.current.setPendingEditorOpen({
          editorType: 'regex',
          nodeId: 'node-1',
        });
      });

      act(() => {
        result.current.setPendingEditorOpen(null);
      });

      expect(result.current.pendingEditorOpen).toBeNull();
    });
  });

  describe('UI panels visibility state', () => {
    it('should update showSynonyms when setShowSynonyms is called', () => {
      const { result } = renderHook(() => useResponseEditorState());

      act(() => {
        result.current.setShowSynonyms(true);
      });

      expect(result.current.showSynonyms).toBe(true);
    });

    it('should update showMessageReview when setShowMessageReview is called', () => {
      const { result } = renderHook(() => useResponseEditorState());

      act(() => {
        result.current.setShowMessageReview(true);
      });

      expect(result.current.showMessageReview).toBe(true);
    });

    it('should update selectedIntentIdForTraining when setSelectedIntentIdForTraining is called', () => {
      const { result } = renderHook(() => useResponseEditorState());

      act(() => {
        result.current.setSelectedIntentIdForTraining('intent-1');
      });

      expect(result.current.selectedIntentIdForTraining).toBe('intent-1');
    });

    it('should update showContractWizard when setShowContractWizard is called', () => {
      const { result } = renderHook(() => useResponseEditorState());

      act(() => {
        result.current.setShowContractWizard(true);
      });

      expect(result.current.showContractWizard).toBe(true);
    });
  });

  describe('selected node state', () => {
    it('should update selectedNode when setSelectedNode is called', () => {
      const { result } = renderHook(() => useResponseEditorState());

      const node = { id: 'node-1', label: 'Node 1' };

      act(() => {
        result.current.setSelectedNode(node);
      });

      expect(result.current.selectedNode).toEqual(node);
    });

    it('should update selectedNodePath when setSelectedNodePath is called', () => {
      const { result } = renderHook(() => useResponseEditorState());

      const nodePath = { mainIndex: 0, subIndex: 1 };

      act(() => {
        result.current.setSelectedNodePath(nodePath);
      });

      expect(result.current.selectedNodePath).toEqual(nodePath);
    });

    it('should allow selectedNodePath without subIndex', () => {
      const { result } = renderHook(() => useResponseEditorState());

      const nodePath = { mainIndex: 0 };

      act(() => {
        result.current.setSelectedNodePath(nodePath);
      });

      expect(result.current.selectedNodePath).toEqual(nodePath);
    });
  });

  describe('taskTree version state', () => {
    it('should update taskTreeVersion when setTaskTreeVersion is called', () => {
      const { result } = renderHook(() => useResponseEditorState());

      act(() => {
        result.current.setTaskTreeVersion(1);
      });

      expect(result.current.taskTreeVersion).toBe(1);
    });

    it('should allow functional updates for taskTreeVersion', () => {
      const { result } = renderHook(() => useResponseEditorState());

      act(() => {
        result.current.setTaskTreeVersion((prev) => prev + 1);
      });

      expect(result.current.taskTreeVersion).toBe(1);
    });
  });

  describe('panel modes state', () => {
    it('should update leftPanelMode when setLeftPanelMode is called', () => {
      const { result } = renderHook(() => useResponseEditorState());

      act(() => {
        result.current.setLeftPanelMode('validator');
      });

      expect(result.current.leftPanelMode).toBe('validator');
    });

    it('should update testPanelMode when setTestPanelMode is called', () => {
      const { result } = renderHook(() => useResponseEditorState());

      act(() => {
        result.current.setTestPanelMode('chat');
      });

      expect(result.current.testPanelMode).toBe('chat');
    });

    it('should update tasksPanelMode when setTasksPanelMode is called', () => {
      const { result } = renderHook(() => useResponseEditorState());

      act(() => {
        result.current.setTasksPanelMode('actions');
      });

      expect(result.current.tasksPanelMode).toBe('actions');
    });

    it('should handle all valid RightPanelMode values', () => {
      const { result } = renderHook(() => useResponseEditorState());

      const modes: RightPanelMode[] = ['actions', 'validator', 'testset', 'chat', 'styles', 'none'];

      modes.forEach((mode) => {
        act(() => {
          result.current.setLeftPanelMode(mode);
        });

        expect(result.current.leftPanelMode).toBe(mode);
      });
    });
  });

  describe('sidebar drag state', () => {
    it('should update sidebarManualWidth when setSidebarManualWidth is called', () => {
      const { result } = renderHook(() => useResponseEditorState());

      act(() => {
        result.current.setSidebarManualWidth(300);
      });

      expect(result.current.sidebarManualWidth).toBe(300);
    });

    it('should allow setting sidebarManualWidth to null', () => {
      const { result } = renderHook(() => useResponseEditorState());

      act(() => {
        result.current.setSidebarManualWidth(300);
      });

      act(() => {
        result.current.setSidebarManualWidth(null);
      });

      expect(result.current.sidebarManualWidth).toBeNull();
    });

    it('should update isDraggingSidebar when setIsDraggingSidebar is called', () => {
      const { result } = renderHook(() => useResponseEditorState());

      act(() => {
        result.current.setIsDraggingSidebar(true);
      });

      expect(result.current.isDraggingSidebar).toBe(true);
    });
  });

  describe('splitter drag state', () => {
    it('should update draggingPanel when setDraggingPanel is called', () => {
      const { result } = renderHook(() => useResponseEditorState());

      act(() => {
        result.current.setDraggingPanel('left');
      });

      expect(result.current.draggingPanel).toBe('left');
    });

    it('should handle all valid draggingPanel values', () => {
      const { result } = renderHook(() => useResponseEditorState());

      const panels: Array<'left' | 'test' | 'tasks' | 'shared' | null> = ['left', 'test', 'tasks', 'shared', null];

      panels.forEach((panel) => {
        act(() => {
          result.current.setDraggingPanel(panel);
        });

        expect(result.current.draggingPanel).toBe(panel);
      });
    });
  });

  describe('state independence', () => {
    it('should maintain independent states when updating one', () => {
      const { result } = renderHook(() => useResponseEditorState());

      act(() => {
        result.current.setShowSynonyms(true);
        result.current.setShowMessageReview(true);
        result.current.setShowContractWizard(true);
      });

      act(() => {
        result.current.setShowSynonyms(false);
      });

      expect(result.current.showSynonyms).toBe(false);
      expect(result.current.showMessageReview).toBe(true);
      expect(result.current.showContractWizard).toBe(true);
    });

    it('should not affect other states when updating panel modes', () => {
      const { result } = renderHook(() => useResponseEditorState());

      act(() => {
        result.current.setLeftPanelMode('validator');
      });

      expect(result.current.leftPanelMode).toBe('validator');
      expect(result.current.testPanelMode).toBe('none');
      expect(result.current.tasksPanelMode).toBe('none');
    });
  });

  describe('setter stability', () => {
    it('should return stable setters across re-renders', () => {
      const { result, rerender } = renderHook(() => useResponseEditorState());

      const firstSetters = {
        setServiceUnavailable: result.current.setServiceUnavailable,
        setShowContractDialog: result.current.setShowContractDialog,
        setPendingContractChange: result.current.setPendingContractChange,
        setEscalationTasks: result.current.setEscalationTasks,
        setPendingEditorOpen: result.current.setPendingEditorOpen,
        setShowSynonyms: result.current.setShowSynonyms,
        setShowMessageReview: result.current.setShowMessageReview,
        setSelectedIntentIdForTraining: result.current.setSelectedIntentIdForTraining,
        setShowContractWizard: result.current.setShowContractWizard,
        setSelectedNode: result.current.setSelectedNode,
        setSelectedNodePath: result.current.setSelectedNodePath,
        setTaskTreeVersion: result.current.setTaskTreeVersion,
        setLeftPanelMode: result.current.setLeftPanelMode,
        setTestPanelMode: result.current.setTestPanelMode,
        setTasksPanelMode: result.current.setTasksPanelMode,
        setSidebarManualWidth: result.current.setSidebarManualWidth,
        setIsDraggingSidebar: result.current.setIsDraggingSidebar,
        setDraggingPanel: result.current.setDraggingPanel,
      };

      rerender();

      expect(result.current.setServiceUnavailable).toBe(firstSetters.setServiceUnavailable);
      expect(result.current.setShowContractDialog).toBe(firstSetters.setShowContractDialog);
      expect(result.current.setPendingContractChange).toBe(firstSetters.setPendingContractChange);
      expect(result.current.setEscalationTasks).toBe(firstSetters.setEscalationTasks);
      expect(result.current.setPendingEditorOpen).toBe(firstSetters.setPendingEditorOpen);
      expect(result.current.setShowSynonyms).toBe(firstSetters.setShowSynonyms);
      expect(result.current.setShowMessageReview).toBe(firstSetters.setShowMessageReview);
      expect(result.current.setSelectedIntentIdForTraining).toBe(firstSetters.setSelectedIntentIdForTraining);
      expect(result.current.setShowContractWizard).toBe(firstSetters.setShowContractWizard);
      expect(result.current.setSelectedNode).toBe(firstSetters.setSelectedNode);
      expect(result.current.setSelectedNodePath).toBe(firstSetters.setSelectedNodePath);
      expect(result.current.setTaskTreeVersion).toBe(firstSetters.setTaskTreeVersion);
      expect(result.current.setLeftPanelMode).toBe(firstSetters.setLeftPanelMode);
      expect(result.current.setTestPanelMode).toBe(firstSetters.setTestPanelMode);
      expect(result.current.setTasksPanelMode).toBe(firstSetters.setTasksPanelMode);
      expect(result.current.setSidebarManualWidth).toBe(firstSetters.setSidebarManualWidth);
      expect(result.current.setIsDraggingSidebar).toBe(firstSetters.setIsDraggingSidebar);
      expect(result.current.setDraggingPanel).toBe(firstSetters.setDraggingPanel);
    });
  });
});
