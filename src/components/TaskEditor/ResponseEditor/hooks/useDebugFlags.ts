// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useEffect } from 'react';

/**
 * Hook that ensures debug flags are set once to avoid asking again.
 */
export function useDebugFlags() {
  useEffect(() => {
    try { localStorage.setItem('debug.responseEditor', '1'); } catch { }
    try { localStorage.setItem('debug.reopen', '1'); } catch { }
    try { localStorage.setItem('debug.nodeSelection', '1'); } catch { }
    try { localStorage.setItem('debug.nodeSync', '1'); } catch { }
    try { localStorage.setItem('debug.useDDTTranslations', '1'); } catch { }
    try { localStorage.setItem('debug.getTaskText', '1'); } catch { }
  }, []);
}
