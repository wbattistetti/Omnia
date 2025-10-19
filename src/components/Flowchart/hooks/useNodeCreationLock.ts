import { useRef, useCallback } from 'react';

export function useNodeCreationLock() {
  const isLocked = useRef(false);

  const withNodeLock = useCallback(async (fn: () => Promise<void> | void) => {
    if (isLocked.current) {
      console.log("🚫 [LOCK] DUPLICATE BLOCKED - Node creation already in progress");
      return;
    }
    
    isLocked.current = true;
    console.log("🔒 [LOCK] ACQUIRED - Starting node creation");
    
    try {
      await fn();
    } finally {
      // Delay unlock to avoid race conditions
      queueMicrotask(() => {
        isLocked.current = false;
        console.log("🔓 [LOCK] RELEASED - Node creation completed");
      });
    }
  }, []);

  return withNodeLock;
}
