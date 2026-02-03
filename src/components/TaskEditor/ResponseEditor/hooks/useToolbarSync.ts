// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useEffect } from 'react';

export interface UseToolbarSyncParams {
  hideHeader?: boolean;
  onToolbarUpdate?: (toolbar: any[], color: string) => void;
  toolbarButtons: any[];
}

/**
 * Hook that exposes toolbar via callback when in docking mode.
 */
export function useToolbarSync(params: UseToolbarSyncParams) {
  const { hideHeader, onToolbarUpdate, toolbarButtons } = params;

  const headerColor = '#9a4f00';
  useEffect(() => {
    if (hideHeader && onToolbarUpdate) {
      onToolbarUpdate(toolbarButtons, headerColor);
    }
  }, [hideHeader, onToolbarUpdate, toolbarButtons]);
}
