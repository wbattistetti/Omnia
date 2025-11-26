import { useRef, useCallback } from 'react';

export function useNodeCreationLock() {
  const isLocked = useRef(false);

  const withNodeLock = useCallback(async (fn: () => Promise<void> | void) => {
    if (isLocked.current) {
      return;
    }

    isLocked.current = true;

    try {
      await fn();
    } finally {
      // Delay unlock to avoid race conditions
      queueMicrotask(() => {
        isLocked.current = false;
      });
    }
  }, []);

  return withNodeLock;
}
