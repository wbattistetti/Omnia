import { useRef, useCallback } from 'react';

interface UsePlaceholderSelectionOptions {
  placeholderText: string;
  currentValue: string;
}

/**
 * Hook to manage placeholder selection in Monaco editor
 * Unifies the logic for selecting placeholder text when editor mounts or value changes
 */
export function usePlaceholderSelection({
  placeholderText,
  currentValue,
}: UsePlaceholderSelectionOptions) {
  const hasEverWrittenRef = useRef<boolean>(false);
  const editorRef = useRef<any>(null);

  // ✅ Function to select placeholder if needed
  const selectPlaceholderIfNeeded = useCallback(() => {
    try {
      if (!editorRef.current) {
        return;
      }

      const editor = editorRef.current;

      // ✅ Check if editor is still valid (not disposed)
      if (!editor.getModel || !editor.getModel()) {
        return;
      }

      const model = editor.getModel();
      if (!model || !model.getValue) {
        return;
      }

      const value = model.getValue();

      // Verify that content is actually the placeholder
      if (value === placeholderText && !hasEverWrittenRef.current) {
        try {
          const lineCount = model.getLineCount();
          const maxColumn = model.getLineMaxColumn(lineCount);

          // Select all text starting from column 1
          const selection = {
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: lineCount,
            endColumn: model.getLineMaxColumn(lineCount)
          };

          editor.setSelection(selection);
          editor.focus();
          editor.setPosition({ lineNumber: 1, column: 1 });
          editor.revealLine(1);
          editor.render(true);
        } catch (error) {
          // ✅ Silently ignore errors if editor is being disposed
          if (error && typeof error === 'object' && 'message' in error &&
              String(error.message).includes('Canceled')) {
            // Expected error when editor is disposed - ignore
            return;
          }
          // Re-throw unexpected errors
          throw error;
        }
      }
    } catch (error) {
      // ✅ Silently ignore errors if editor is being disposed
      if (error && typeof error === 'object' && 'message' in error &&
          String(error.message).includes('Canceled')) {
        // Expected error when editor is disposed - ignore
        return;
      }
      // Log unexpected errors for debugging
      console.warn('[usePlaceholderSelection] Error selecting placeholder:', error);
    }
  }, [placeholderText]);

  // ✅ Mark that user has written something
  const markAsWritten = useCallback(() => {
    hasEverWrittenRef.current = true;
  }, []);

  // ✅ Check if user has ever written
  const hasEverWritten = useCallback(() => {
    return hasEverWrittenRef.current;
  }, []);

  // ✅ Reset the flag (useful when regex is cleared)
  const resetWrittenFlag = useCallback(() => {
    hasEverWrittenRef.current = false;
  }, []);

  return {
    editorRef,
    hasEverWrittenRef,
    selectPlaceholderIfNeeded,
    markAsWritten,
    hasEverWritten,
    resetWrittenFlag,
  };
}
