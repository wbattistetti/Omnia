// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useEffect } from 'react';

/**
 * Hook that cleans up localStorage on startup to ensure autosize prevails.
 */
export function useSidebarCleanup() {
  useEffect(() => {
    try {
      localStorage.removeItem('responseEditor.sidebarWidth');
    } catch { }
  }, []);
}
