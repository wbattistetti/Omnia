// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useResponseEditorRefs } from '../useResponseEditorRefs';
import type { TaskTree } from '../../../../../types/taskTypes';

/**
 * Tests for useResponseEditorRefs
 *
 * This hook provides all refs for ResponseEditor: taskTreeRef, prevInstanceRef, contractChangeRef, rootRef,
 * preAssembledTaskTreeCache, wizardOwnsDataRef, and drag-related refs.
 * We test observable behaviors: ref creation, initial values, and ref stability.
 *
 * WHAT WE TEST:
 * - All refs are created and returned
 * - Initial values are correct for each ref
 * - taskTreeRef.current is initialized with taskTree
 * - Refs are stable across re-renders
 * - Edge cases (null/undefined taskTree, null/undefined task)
 *
 * WHY IT'S IMPORTANT:
 * - Refs are critical for accessing mutable values without causing re-renders
 * - taskTreeRef is used throughout the component for direct TaskTree manipulation
 * - contractChangeRef tracks unsaved contract changes
 * - Drag refs are used for sidebar and panel resizing
 * - Incorrect ref initialization can break component functionality
 */

describe('useResponseEditorRefs', () => {
  let mockTaskTree: TaskTree;
  let mockTask: any;

  beforeEach(() => {
    mockTaskTree = {
      label: 'Test TaskTree',
      nodes: [{ id: 'node-1', templateId: 'tpl-1', label: 'Node 1' }],
      steps: {},
    } as TaskTree;

    mockTask = {
      id: 'task-1',
      label: 'Test Task',
    };
  });

  describe('ref creation', () => {
    it('should return all required refs', () => {
      const { result } = renderHook(() =>
        useResponseEditorRefs({
          taskTree: mockTaskTree,
          task: mockTask,
        })
      );

      expect(result.current.taskTreeRef).toBeDefined();
      expect(result.current.prevInstanceRef).toBeDefined();
      expect(result.current.contractChangeRef).toBeDefined();
      expect(result.current.rootRef).toBeDefined();
      expect(result.current.preAssembledTaskTreeCache).toBeDefined();
      expect(result.current.wizardOwnsDataRef).toBeDefined();
      expect(result.current.sidebarStartWidthRef).toBeDefined();
      expect(result.current.sidebarStartXRef).toBeDefined();
      expect(result.current.tasksStartWidthRef).toBeDefined();
      expect(result.current.tasksStartXRef).toBeDefined();
    });

    it('should initialize taskTreeRef.current with taskTree', () => {
      const { result } = renderHook(() =>
        useResponseEditorRefs({
          taskTree: mockTaskTree,
          task: mockTask,
        })
      );

      expect(result.current.taskTreeRef.current).toBe(mockTaskTree);
    });

    it('should initialize prevInstanceRef.current as undefined', () => {
      const { result } = renderHook(() =>
        useResponseEditorRefs({
          taskTree: mockTaskTree,
          task: mockTask,
        })
      );

      expect(result.current.prevInstanceRef.current).toBeUndefined();
    });

    it('should initialize contractChangeRef with default values', () => {
      const { result } = renderHook(() =>
        useResponseEditorRefs({
          taskTree: mockTaskTree,
          task: mockTask,
        })
      );

      expect(result.current.contractChangeRef.current).toEqual({
        hasUnsavedChanges: false,
        modifiedContract: null,
        originalContract: null,
        nodeTemplateId: undefined,
        nodeLabel: undefined,
      });
    });

    it('should initialize rootRef.current as null', () => {
      const { result } = renderHook(() =>
        useResponseEditorRefs({
          taskTree: mockTaskTree,
          task: mockTask,
        })
      );

      expect(result.current.rootRef.current).toBeNull();
    });

    it('should initialize preAssembledTaskTreeCache as empty Map', () => {
      const { result } = renderHook(() =>
        useResponseEditorRefs({
          taskTree: mockTaskTree,
          task: mockTask,
        })
      );

      expect(result.current.preAssembledTaskTreeCache.current).toBeInstanceOf(Map);
      expect(result.current.preAssembledTaskTreeCache.current.size).toBe(0);
    });

    it('should initialize wizardOwnsDataRef.current as false', () => {
      const { result } = renderHook(() =>
        useResponseEditorRefs({
          taskTree: mockTaskTree,
          task: mockTask,
        })
      );

      expect(result.current.wizardOwnsDataRef.current).toBe(false);
    });

    it('should initialize drag refs with 0', () => {
      const { result } = renderHook(() =>
        useResponseEditorRefs({
          taskTree: mockTaskTree,
          task: mockTask,
        })
      );

      expect(result.current.sidebarStartWidthRef.current).toBe(0);
      expect(result.current.sidebarStartXRef.current).toBe(0);
      expect(result.current.tasksStartWidthRef.current).toBe(0);
      expect(result.current.tasksStartXRef.current).toBe(0);
    });
  });

  describe('ref stability', () => {
    it('should return stable refs across re-renders', () => {
      const { result, rerender } = renderHook(() =>
        useResponseEditorRefs({
          taskTree: mockTaskTree,
          task: mockTask,
        })
      );

      const firstRefs = {
        taskTreeRef: result.current.taskTreeRef,
        prevInstanceRef: result.current.prevInstanceRef,
        contractChangeRef: result.current.contractChangeRef,
        rootRef: result.current.rootRef,
        preAssembledTaskTreeCache: result.current.preAssembledTaskTreeCache,
        wizardOwnsDataRef: result.current.wizardOwnsDataRef,
        sidebarStartWidthRef: result.current.sidebarStartWidthRef,
        sidebarStartXRef: result.current.sidebarStartXRef,
        tasksStartWidthRef: result.current.tasksStartWidthRef,
        tasksStartXRef: result.current.tasksStartXRef,
      };

      rerender();

      expect(result.current.taskTreeRef).toBe(firstRefs.taskTreeRef);
      expect(result.current.prevInstanceRef).toBe(firstRefs.prevInstanceRef);
      expect(result.current.contractChangeRef).toBe(firstRefs.contractChangeRef);
      expect(result.current.rootRef).toBe(firstRefs.rootRef);
      expect(result.current.preAssembledTaskTreeCache).toBe(firstRefs.preAssembledTaskTreeCache);
      expect(result.current.wizardOwnsDataRef).toBe(firstRefs.wizardOwnsDataRef);
      expect(result.current.sidebarStartWidthRef).toBe(firstRefs.sidebarStartWidthRef);
      expect(result.current.sidebarStartXRef).toBe(firstRefs.sidebarStartXRef);
      expect(result.current.tasksStartWidthRef).toBe(firstRefs.tasksStartWidthRef);
      expect(result.current.tasksStartXRef).toBe(firstRefs.tasksStartXRef);
    });

    it('should allow mutation of ref.current values', () => {
      const { result } = renderHook(() =>
        useResponseEditorRefs({
          taskTree: mockTaskTree,
          task: mockTask,
        })
      );

      // Mutate ref values
      const newTaskTree = { ...mockTaskTree, label: 'Updated' };
      result.current.taskTreeRef.current = newTaskTree;
      result.current.prevInstanceRef.current = 'instance-1';
      result.current.contractChangeRef.current.hasUnsavedChanges = true;
      result.current.wizardOwnsDataRef.current = true;
      result.current.sidebarStartWidthRef.current = 100;
      result.current.sidebarStartXRef.current = 200;
      result.current.tasksStartWidthRef.current = 300;
      result.current.tasksStartXRef.current = 400;

      // Verify mutations persist
      expect(result.current.taskTreeRef.current).toBe(newTaskTree);
      expect(result.current.prevInstanceRef.current).toBe('instance-1');
      expect(result.current.contractChangeRef.current.hasUnsavedChanges).toBe(true);
      expect(result.current.wizardOwnsDataRef.current).toBe(true);
      expect(result.current.sidebarStartWidthRef.current).toBe(100);
      expect(result.current.sidebarStartXRef.current).toBe(200);
      expect(result.current.tasksStartWidthRef.current).toBe(300);
      expect(result.current.tasksStartXRef.current).toBe(400);
    });

    it('should allow adding items to preAssembledTaskTreeCache', () => {
      const { result } = renderHook(() =>
        useResponseEditorRefs({
          taskTree: mockTaskTree,
          task: mockTask,
        })
      );

      const cacheEntry = {
        taskTree: mockTaskTree,
        _templateTranslations: {
          'key-1': { en: 'English', it: 'Italiano', pt: 'Português' },
        },
      };

      result.current.preAssembledTaskTreeCache.current.set('template-1', cacheEntry);

      expect(result.current.preAssembledTaskTreeCache.current.size).toBe(1);
      expect(result.current.preAssembledTaskTreeCache.current.get('template-1')).toBe(cacheEntry);
    });
  });

  describe('edge cases', () => {
    it('should handle null taskTree', () => {
      const { result } = renderHook(() =>
        useResponseEditorRefs({
          taskTree: null,
          task: mockTask,
        })
      );

      expect(result.current.taskTreeRef.current).toBeNull();
      expect(result.current.prevInstanceRef.current).toBeUndefined();
    });

    it('should handle undefined taskTree', () => {
      const { result } = renderHook(() =>
        useResponseEditorRefs({
          taskTree: undefined,
          task: mockTask,
        })
      );

      expect(result.current.taskTreeRef.current).toBeUndefined();
      expect(result.current.prevInstanceRef.current).toBeUndefined();
    });

    it('should handle null task', () => {
      const { result } = renderHook(() =>
        useResponseEditorRefs({
          taskTree: mockTaskTree,
          task: null,
        })
      );

      expect(result.current.taskTreeRef.current).toBe(mockTaskTree);
      // task parameter is not used in the hook, so null is fine
    });

    it('should handle undefined task', () => {
      const { result } = renderHook(() =>
        useResponseEditorRefs({
          taskTree: mockTaskTree,
          task: undefined,
        })
      );

      expect(result.current.taskTreeRef.current).toBe(mockTaskTree);
      // task parameter is not used in the hook, so undefined is fine
    });

    it('should handle empty TaskTree', () => {
      const emptyTaskTree = {
        label: '',
        nodes: [],
        steps: {},
      } as TaskTree;

      const { result } = renderHook(() =>
        useResponseEditorRefs({
          taskTree: emptyTaskTree,
          task: mockTask,
        })
      );

      expect(result.current.taskTreeRef.current).toBe(emptyTaskTree);
    });

    it('should handle TaskTree with only label', () => {
      const minimalTaskTree = {
        label: 'Minimal',
      } as TaskTree;

      const { result } = renderHook(() =>
        useResponseEditorRefs({
          taskTree: minimalTaskTree,
          task: mockTask,
        })
      );

      expect(result.current.taskTreeRef.current).toBe(minimalTaskTree);
    });
  });

  describe('ref types', () => {
    it('should return MutableRefObject for mutable refs', () => {
      const { result } = renderHook(() =>
        useResponseEditorRefs({
          taskTree: mockTaskTree,
          task: mockTask,
        })
      );

      // MutableRefObject has .current property that can be mutated
      expect('current' in result.current.taskTreeRef).toBe(true);
      expect('current' in result.current.prevInstanceRef).toBe(true);
      expect('current' in result.current.contractChangeRef).toBe(true);
      expect('current' in result.current.preAssembledTaskTreeCache).toBe(true);
      expect('current' in result.current.wizardOwnsDataRef).toBe(true);
      expect('current' in result.current.sidebarStartWidthRef).toBe(true);
      expect('current' in result.current.sidebarStartXRef).toBe(true);
      expect('current' in result.current.tasksStartWidthRef).toBe(true);
      expect('current' in result.current.tasksStartXRef).toBe(true);
    });

    it('should return RefObject for rootRef', () => {
      const { result } = renderHook(() =>
        useResponseEditorRefs({
          taskTree: mockTaskTree,
          task: mockTask,
        })
      );

      // RefObject has .current property but is typically read-only
      expect('current' in result.current.rootRef).toBe(true);
    });
  });
});
