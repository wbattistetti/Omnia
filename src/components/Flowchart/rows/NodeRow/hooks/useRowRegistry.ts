import { useRef, useCallback } from 'react';

interface RowComponentRef {
  fade: () => void;
  highlight: () => void;
  normal: () => void;
}

// Registry globale per i componenti NodeRow
const rowRegistry = new Map<string, RowComponentRef>();

export function useRowRegistry() {
  const registerRow = useCallback((id: string, ref: RowComponentRef) => {
    rowRegistry.set(id, ref);
  }, []);

  const unregisterRow = useCallback((id: string) => {
    rowRegistry.delete(id);
  }, []);

  const getRowComponent = useCallback((id: string): RowComponentRef | null => {
    return rowRegistry.get(id) || null;
  }, []);

  return {
    registerRow,
    unregisterRow,
    getRowComponent
  };
}
