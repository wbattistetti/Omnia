import { useState, useCallback } from 'react';

export type Command = { 
  label: string; 
  do: () => void; 
  undo: () => void;
};

export function useUndoRedoManager() {
  const [undoStack, setUndoStack] = useState<Command[]>([]);
  const [redoStack, setRedoStack] = useState<Command[]>([]);

  const executeCommand = useCallback((cmd: Command) => {
    try { 
      cmd.do(); 
    } finally { 
      setUndoStack((s) => [...s, cmd]); 
      setRedoStack([]); 
    }
  }, []);

  const undo = useCallback(() => {
    let toUndo: Command | null = null;
    setUndoStack((s) => {
      if (s.length === 0) return s;
      toUndo = s[s.length - 1];
      return s.slice(0, -1);
    });
    if (toUndo) {
      try { 
        toUndo.undo(); 
      } catch (e) {
        console.error('Error during undo:', e);
      }
      setRedoStack((r) => [...r, toUndo as Command]);
    }
  }, []);

  const redo = useCallback(() => {
    let toDo: Command | null = null;
    setRedoStack((r) => {
      if (r.length === 0) return r;
      toDo = r[r.length - 1];
      return r.slice(0, -1);
    });
    if (toDo) {
      try { 
        toDo.do(); 
      } catch (e) {
        console.error('Error during redo:', e);
      }
      setUndoStack((s) => [...s, toDo as Command]);
    }
  }, []);

  // Utility per rimuovere un comando specifico dallo stack
  const removeCommand = useCallback((cmd: Command) => {
    setUndoStack((s) => s.filter(c => c !== cmd));
    setRedoStack((r) => r.filter(c => c !== cmd));
  }, []);

  return {
    undoStack,
    redoStack,
    executeCommand,
    undo,
    redo,
    removeCommand,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0
  };
}
