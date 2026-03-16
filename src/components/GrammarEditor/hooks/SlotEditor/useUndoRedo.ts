// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useState, useCallback, useRef } from 'react';
import type { Operation, UndoRedoState } from '../../types/slotEditorTypes';

const MAX_STACK_SIZE = 50;

/**
 * Hook for managing undo/redo stack
 * Single Responsibility: Undo/Redo state management
 */
export function useUndoRedo() {
  const [state, setState] = useState<UndoRedoState>({
    undoStack: [],
    redoStack: [],
    maxStackSize: MAX_STACK_SIZE,
  });

  /**
   * Records an operation for undo/redo
   */
  const recordOperation = useCallback((operation: Operation) => {
    setState((prev) => {
      const newUndoStack = [...prev.undoStack, operation].slice(-prev.maxStackSize);
      // Clear redo stack when new operation is recorded
      return {
        ...prev,
        undoStack: newUndoStack,
        redoStack: [],
      };
    });
  }, []);

  /**
   * Undo last operation
   */
  const undo = useCallback((): Operation | null => {
    let lastOperation: Operation | null = null;

    setState((prev) => {
      if (prev.undoStack.length === 0) return prev;

      const newUndoStack = [...prev.undoStack];
      lastOperation = newUndoStack.pop()!;

      return {
        ...prev,
        undoStack: newUndoStack,
        redoStack: [...prev.redoStack, lastOperation],
      };
    });

    return lastOperation;
  }, []);

  /**
   * Redo last undone operation
   */
  const redo = useCallback((): Operation | null => {
    let lastOperation: Operation | null = null;

    setState((prev) => {
      if (prev.redoStack.length === 0) return prev;

      const newRedoStack = [...prev.redoStack];
      lastOperation = newRedoStack.pop()!;

      return {
        ...prev,
        undoStack: [...prev.undoStack, lastOperation],
        redoStack: newRedoStack,
      };
    });

    return lastOperation;
  }, []);

  /**
   * Clears undo/redo stacks
   */
  const clear = useCallback(() => {
    setState({
      undoStack: [],
      redoStack: [],
      maxStackSize: MAX_STACK_SIZE,
    });
  }, []);

  /**
   * Checks if undo is available
   */
  const canUndo = state.undoStack.length > 0;

  /**
   * Checks if redo is available
   */
  const canRedo = state.redoStack.length > 0;

  return {
    recordOperation,
    undo,
    redo,
    clear,
    canUndo,
    canRedo,
    undoCount: state.undoStack.length,
    redoCount: state.redoStack.length,
  };
}
