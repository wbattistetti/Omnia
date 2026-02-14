// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useContext } from 'react';
import { ResponseEditorContext } from '@responseEditor/context/ResponseEditorContext';

/**
 * Safe hook to get ResponseEditorContext.
 * Returns null if context is not available (instead of throwing).
 * This allows the hook to be used in components that may or may not be inside ResponseEditor.
 *
 * Note: useContext doesn't throw - it returns the default value (null) if context is not provided.
 */
export function useResponseEditorContextSafe() {
  const context = useContext(ResponseEditorContext);
  return context; // This will be null if not inside ResponseEditorContext.Provider
}
