// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useResponseEditorDerived } from '@responseEditor/hooks/useResponseEditorDerived';
import type { Task, TaskTree } from '@types/taskTypes';
import type { RightPanelMode } from '@responseEditor/RightPanel';

/**
 * Tests for useResponseEditorDerived
 *
 * This hook provides derived values for ResponseEditor: needsIntentMessages, taskType, headerTitle, icon, iconColor, rightMode.
 * We test observable behaviors: value derivation, priority logic, and edge cases.
 *
 * WHAT WE TEST:
 * - needsIntentMessages calculation (true when kind === 'intent' && !hasMessages)
 * - taskType extraction from task.type (throws error if missing)
 * - headerTitle priority (_sourceTask.label > task.label > _userLabel > fallback)
 * - icon/iconColor from getTaskVisualsByType
 * - rightMode calculation (testPanelMode === 'chat' ? 'chat' : leftPanelMode)
 * - Edge cases (null/undefined task, null/undefined taskTree, empty mainList, missing task.type)
 *
 * WHY IT'S IMPORTANT:
 * - needsIntentMessages controls IntentMessagesBuilder display
 * - taskType is critical for task visualization and behavior
 * - headerTitle affects user experience and navigation
 * - icon/iconColor provide visual feedback
 * - rightMode controls panel visibility
 * - Incorrect derived values can break the entire editor
 *
 * MOCKS:
 * - getTaskVisualsByType (taskVisuals) - mocked to return predictable values
 * - hasIntentMessages (hasMessages) - mocked to control message presence
 */

// Mock getTaskVisualsByType
vi.mock('../../../../Flowchart/utils/taskVisuals', () => ({
  getTaskVisualsByType: vi.fn((taskType: number, hasTaskTree: boolean) => ({
    Icon: () => null,
    color: hasTaskTree ? '#color-with-tree' : '#color-without-tree',
  })),
}));

// Mock hasIntentMessages
vi.mock('../../utils/hasMessages', () => ({
  hasIntentMessages: vi.fn(() => false),
}));

import { getTaskVisualsByType } from '../../../../Flowchart/utils/taskVisuals';
import { hasIntentMessages } from '../../utils/hasMessages';

describe('useResponseEditorDerived', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (hasIntentMessages as any).mockReturnValue(false);
  });

  describe('needsIntentMessages', () => {
    it('should return true when firstMain.kind === "intent" and hasMessages is false', () => {
      (hasIntentMessages as any).mockReturnValue(false);

      const { result } = renderHook(() =>
        useResponseEditorDerived({
          task: { id: 'task-1', type: 1 } as Task,
          taskTree: null,
          mainList: [{ id: 'main-1', kind: 'intent' }],
          leftPanelMode: 'actions',
          testPanelMode: 'none',
        })
      );

      expect(hasIntentMessages).toHaveBeenCalledWith(null, { id: 'task-1', type: 1 });
      expect(result.current.needsIntentMessages).toBe(true);
    });

    it('should return false when firstMain.kind !== "intent"', () => {
      (hasIntentMessages as any).mockReturnValue(false);

      const { result } = renderHook(() =>
        useResponseEditorDerived({
          task: { id: 'task-1', type: 1 } as Task,
          taskTree: null,
          mainList: [{ id: 'main-1', kind: 'date' }],
          leftPanelMode: 'actions',
          testPanelMode: 'none',
        })
      );

      expect(result.current.needsIntentMessages).toBe(false);
    });

    it('should return false when hasMessages is true', () => {
      (hasIntentMessages as any).mockReturnValue(true);

      const { result } = renderHook(() =>
        useResponseEditorDerived({
          task: { id: 'task-1', type: 1 } as Task,
          taskTree: null,
          mainList: [{ id: 'main-1', kind: 'intent' }],
          leftPanelMode: 'actions',
          testPanelMode: 'none',
        })
      );

      expect(result.current.needsIntentMessages).toBe(false);
    });

    it('should return false when mainList is empty', () => {
      const { result } = renderHook(() =>
        useResponseEditorDerived({
          task: { id: 'task-1', type: 1 } as Task,
          taskTree: null,
          mainList: [],
          leftPanelMode: 'actions',
          testPanelMode: 'none',
        })
      );

      expect(result.current.needsIntentMessages).toBe(false);
    });

    it('should return false when firstMain has no kind property', () => {
      const { result } = renderHook(() =>
        useResponseEditorDerived({
          task: { id: 'task-1', type: 1 } as Task,
          taskTree: null,
          mainList: [{ id: 'main-1' }],
          leftPanelMode: 'actions',
          testPanelMode: 'none',
        })
      );

      expect(result.current.needsIntentMessages).toBe(false);
    });
  });

  describe('taskType', () => {
    it('should return task.type when present', () => {
      const { result } = renderHook(() =>
        useResponseEditorDerived({
          task: { id: 'task-1', type: 3 } as Task,
          taskTree: null,
          mainList: [],
          leftPanelMode: 'actions',
          testPanelMode: 'none',
        })
      );

      expect(result.current.taskType).toBe(3);
    });

    it('should throw error when task.type is missing', () => {
      expect(() => {
        renderHook(() =>
          useResponseEditorDerived({
            task: { id: 'task-1' } as any,
            taskTree: null,
            mainList: [],
            leftPanelMode: 'actions',
            testPanelMode: 'none',
          })
        );
      }).toThrow('[ResponseEditor] Task is missing required field \'type\'');
    });

    it('should throw error when task is null', () => {
      expect(() => {
        renderHook(() =>
          useResponseEditorDerived({
            task: null,
            taskTree: null,
            mainList: [],
            leftPanelMode: 'actions',
            testPanelMode: 'none',
          })
        );
      }).toThrow('[ResponseEditor] Task is missing required field \'type\'');
    });

    it('should throw error when task is undefined', () => {
      expect(() => {
        renderHook(() =>
          useResponseEditorDerived({
            task: undefined,
            taskTree: null,
            mainList: [],
            leftPanelMode: 'actions',
            testPanelMode: 'none',
          })
        );
      }).toThrow('[ResponseEditor] Task is missing required field \'type\'');
    });
  });

  describe('headerTitle', () => {
    it('should use _sourceTask.label when available', () => {
      const taskTree = {
        _sourceTask: { label: 'Source Task Label' },
      } as any;

      const { result } = renderHook(() =>
        useResponseEditorDerived({
          task: { id: 'task-1', type: 1, label: 'Task Label' } as Task,
          taskTree,
          mainList: [],
          leftPanelMode: 'actions',
          testPanelMode: 'none',
        })
      );

      expect(result.current.headerTitle).toBe('Source Task Label');
    });

    it('should use _sourceAct.label as fallback (backward compatibility)', () => {
      const taskTree = {
        _sourceAct: { label: 'Source Act Label' },
      } as any;

      const { result } = renderHook(() =>
        useResponseEditorDerived({
          task: { id: 'task-1', type: 1, label: 'Task Label' } as Task,
          taskTree,
          mainList: [],
          leftPanelMode: 'actions',
          testPanelMode: 'none',
        })
      );

      expect(result.current.headerTitle).toBe('Source Act Label');
    });

    it('should use task.label when _sourceTask is not available', () => {
      const { result } = renderHook(() =>
        useResponseEditorDerived({
          task: { id: 'task-1', type: 1, label: 'Task Label' } as Task,
          taskTree: null,
          mainList: [],
          leftPanelMode: 'actions',
          testPanelMode: 'none',
        })
      );

      expect(result.current.headerTitle).toBe('Task Label');
    });

    it('should use _userLabel when task.label is not available', () => {
      const taskTree = {
        _userLabel: 'User Label',
      } as any;

      const { result } = renderHook(() =>
        useResponseEditorDerived({
          task: { id: 'task-1', type: 1 } as Task,
          taskTree,
          mainList: [],
          leftPanelMode: 'actions',
          testPanelMode: 'none',
        })
      );

      expect(result.current.headerTitle).toBe('User Label');
    });

    it('should use fallback "Response Editor" when no labels are available', () => {
      const { result } = renderHook(() =>
        useResponseEditorDerived({
          task: { id: 'task-1', type: 1 } as Task,
          taskTree: null,
          mainList: [],
          leftPanelMode: 'actions',
          testPanelMode: 'none',
        })
      );

      expect(result.current.headerTitle).toBe('Response Editor');
    });

    it('should prefer _sourceTask.label over task.label', () => {
      const taskTree = {
        _sourceTask: { label: 'Source Label' },
      } as any;

      const { result } = renderHook(() =>
        useResponseEditorDerived({
          task: { id: 'task-1', type: 1, label: 'Task Label' } as Task,
          taskTree,
          mainList: [],
          leftPanelMode: 'actions',
          testPanelMode: 'none',
        })
      );

      expect(result.current.headerTitle).toBe('Source Label');
    });
  });

  describe('icon and iconColor', () => {
    it('should get icon and iconColor from getTaskVisualsByType', () => {
      const { result } = renderHook(() =>
        useResponseEditorDerived({
          task: { id: 'task-1', type: 2 } as Task,
          taskTree: { nodes: [] } as TaskTree,
          mainList: [],
          leftPanelMode: 'actions',
          testPanelMode: 'none',
        })
      );

      expect(getTaskVisualsByType).toHaveBeenCalledWith(2, true);
      expect(result.current.icon).toBeDefined();
      expect(result.current.iconColor).toBe('#color-with-tree');
    });

    it('should pass hasTaskTree=false when taskTree is null', () => {
      const { result } = renderHook(() =>
        useResponseEditorDerived({
          task: { id: 'task-1', type: 1 } as Task,
          taskTree: null,
          mainList: [],
          leftPanelMode: 'actions',
          testPanelMode: 'none',
        })
      );

      expect(getTaskVisualsByType).toHaveBeenCalledWith(1, false);
      expect(result.current.iconColor).toBe('#color-without-tree');
    });

    it('should pass hasTaskTree=false when taskTree is undefined', () => {
      const { result } = renderHook(() =>
        useResponseEditorDerived({
          task: { id: 'task-1', type: 1 } as Task,
          taskTree: undefined,
          mainList: [],
          leftPanelMode: 'actions',
          testPanelMode: 'none',
        })
      );

      expect(getTaskVisualsByType).toHaveBeenCalledWith(1, false);
      expect(result.current.iconColor).toBe('#color-without-tree');
    });

    it('should update icon/iconColor when taskType changes', () => {
      const { result, rerender } = renderHook(
        ({ task }) =>
          useResponseEditorDerived({
            task,
            taskTree: { nodes: [] } as TaskTree,
            mainList: [],
            leftPanelMode: 'actions',
            testPanelMode: 'none',
          }),
        {
          initialProps: {
            task: { id: 'task-1', type: 1 } as Task,
          },
        }
      );

      expect(getTaskVisualsByType).toHaveBeenCalledWith(1, true);

      rerender({
        task: { id: 'task-1', type: 2 } as Task,
      });

      expect(getTaskVisualsByType).toHaveBeenCalledWith(2, true);
    });
  });

  describe('rightMode', () => {
    it('should return "chat" when testPanelMode is "chat"', () => {
      const { result } = renderHook(() =>
        useResponseEditorDerived({
          task: { id: 'task-1', type: 1 } as Task,
          taskTree: null,
          mainList: [],
          leftPanelMode: 'actions',
          testPanelMode: 'chat',
        })
      );

      expect(result.current.rightMode).toBe('chat');
    });

    it('should return leftPanelMode when testPanelMode is not "chat"', () => {
      const { result } = renderHook(() =>
        useResponseEditorDerived({
          task: { id: 'task-1', type: 1 } as Task,
          taskTree: null,
          mainList: [],
          leftPanelMode: 'test',
          testPanelMode: 'none',
        })
      );

      expect(result.current.rightMode).toBe('test');
    });

    it('should return leftPanelMode when testPanelMode is "none"', () => {
      const { result } = renderHook(() =>
        useResponseEditorDerived({
          task: { id: 'task-1', type: 1 } as Task,
          taskTree: null,
          mainList: [],
          leftPanelMode: 'actions',
          testPanelMode: 'none',
        })
      );

      expect(result.current.rightMode).toBe('actions');
    });

    it('should update when testPanelMode changes from "none" to "chat"', () => {
      const { result, rerender } = renderHook(
        ({ testPanelMode }) =>
          useResponseEditorDerived({
            task: { id: 'task-1', type: 1 } as Task,
            taskTree: null,
            mainList: [],
            leftPanelMode: 'actions',
            testPanelMode,
          }),
        {
          initialProps: { testPanelMode: 'none' as RightPanelMode },
        }
      );

      expect(result.current.rightMode).toBe('actions');

      rerender({ testPanelMode: 'chat' as RightPanelMode });

      expect(result.current.rightMode).toBe('chat');
    });

    it('should update when leftPanelMode changes', () => {
      const { result, rerender } = renderHook(
        ({ leftPanelMode }) =>
          useResponseEditorDerived({
            task: { id: 'task-1', type: 1 } as Task,
            taskTree: null,
            mainList: [],
            leftPanelMode,
            testPanelMode: 'none',
          }),
        {
          initialProps: { leftPanelMode: 'actions' as RightPanelMode },
        }
      );

      expect(result.current.rightMode).toBe('actions');

      rerender({ leftPanelMode: 'test' as RightPanelMode });

      expect(result.current.rightMode).toBe('test');
    });
  });

  describe('edge cases', () => {
    it('should handle taskTree with _sourceTask but no label', () => {
      const taskTree = {
        _sourceTask: {},
      } as any;

      const { result } = renderHook(() =>
        useResponseEditorDerived({
          task: { id: 'task-1', type: 1, label: 'Task Label' } as Task,
          taskTree,
          mainList: [],
          leftPanelMode: 'actions',
          testPanelMode: 'none',
        })
      );

      expect(result.current.headerTitle).toBe('Task Label');
    });

    it('should handle taskTree with _sourceAct but no label', () => {
      const taskTree = {
        _sourceAct: {},
      } as any;

      const { result } = renderHook(() =>
        useResponseEditorDerived({
          task: { id: 'task-1', type: 1, label: 'Task Label' } as Task,
          taskTree,
          mainList: [],
          leftPanelMode: 'actions',
          testPanelMode: 'none',
        })
      );

      expect(result.current.headerTitle).toBe('Task Label');
    });

    it('should handle taskTree with empty _userLabel', () => {
      const taskTree = {
        _userLabel: '',
      } as any;

      const { result } = renderHook(() =>
        useResponseEditorDerived({
          task: { id: 'task-1', type: 1 } as Task,
          taskTree,
          mainList: [],
          leftPanelMode: 'actions',
          testPanelMode: 'none',
        })
      );

      // Empty string is falsy, should use fallback
      expect(result.current.headerTitle).toBe('Response Editor');
    });

    it('should handle mainList with multiple items (uses first)', () => {
      (hasIntentMessages as any).mockReturnValue(false);

      const { result } = renderHook(() =>
        useResponseEditorDerived({
          task: { id: 'task-1', type: 1 } as Task,
          taskTree: null,
          mainList: [
            { id: 'main-1', kind: 'intent' },
            { id: 'main-2', kind: 'date' },
          ],
          leftPanelMode: 'actions',
          testPanelMode: 'none',
        })
      );

      expect(result.current.needsIntentMessages).toBe(true);
    });
  });

  describe('memoization', () => {
    it('should update needsIntentMessages when mainList changes', () => {
      (hasIntentMessages as any).mockReturnValue(false);

      const { result, rerender } = renderHook(
        ({ mainList }) =>
          useResponseEditorDerived({
            task: { id: 'task-1', type: 1 } as Task,
            taskTree: null,
            mainList,
            leftPanelMode: 'actions',
            testPanelMode: 'none',
          }),
        {
          initialProps: {
            mainList: [{ id: 'main-1', kind: 'date' }],
          },
        }
      );

      expect(result.current.needsIntentMessages).toBe(false);

      rerender({
        mainList: [{ id: 'main-1', kind: 'intent' }],
      });

      expect(result.current.needsIntentMessages).toBe(true);
    });

    it('should update headerTitle when task.label changes', () => {
      const { result, rerender } = renderHook(
        ({ task }) =>
          useResponseEditorDerived({
            task,
            taskTree: null,
            mainList: [],
            leftPanelMode: 'actions',
            testPanelMode: 'none',
          }),
        {
          initialProps: {
            task: { id: 'task-1', type: 1, label: 'Label 1' } as Task,
          },
        }
      );

      expect(result.current.headerTitle).toBe('Label 1');

      rerender({
        task: { id: 'task-1', type: 1, label: 'Label 2' } as Task,
      });

      expect(result.current.headerTitle).toBe('Label 2');
    });
  });
});
