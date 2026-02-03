// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useEffect, useRef } from 'react';

export interface UseEditorCloseRegistrationParams {
  handleEditorClose: () => Promise<boolean>;
  registerOnClose?: (fn: () => Promise<boolean>) => void;
}

/**
 * Hook that registers handleEditorClose in a ref to allow tab.onClose to call it.
 */
export function useEditorCloseRegistration(params: UseEditorCloseRegistrationParams) {
  const { handleEditorClose, registerOnClose } = params;

  // Ref per evitare re-registrazioni quando handleEditorClose cambia
  const handleEditorCloseRef = useRef(handleEditorClose);
  useEffect(() => {
    handleEditorCloseRef.current = handleEditorClose;
  }, [handleEditorClose]);

  // Registra handleEditorClose nel ref per permettere a tab.onClose di chiamarlo
  useEffect(() => {
    if (registerOnClose) {
      registerOnClose(() => handleEditorCloseRef.current());
      console.log('[ResponseEditor] ✅ Registered handleEditorClose');
    } else {
      console.warn('[ResponseEditor] ⚠️ registerOnClose not provided');
    }
  }, [registerOnClose]);
}
