// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Debug logger gated by localStorage flag: set localStorage.setItem('debug.responseEditor','1') to enable
 */
export function createDebugLogger(): (...args: any[]) => void {
  return (...args: any[]) => {
    try {
      if (localStorage.getItem('debug.responseEditor') === '1') {
        console.log(...args);
      }
    } catch {
      // Silent fail
    }
  };
}

/**
 * Get project language from localStorage (set when project is created/loaded)
 */
export function getProjectLocale(): 'en' | 'it' | 'pt' {
  try {
    const saved = localStorage.getItem('project.lang');
    if (saved === 'en' || saved === 'it' || saved === 'pt') {
      return saved;
    }
  } catch (err) {
    // Silent fail
  }
  return 'it'; // Default to Italian
}
