// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useEffect, useRef } from 'react';
import type { TaskWizardMode } from '@taskEditor/EditorHost/types';

export interface UseToolbarSyncParams {
  hideHeader?: boolean;
  onToolbarUpdate?: (toolbar: any[], color: string) => void;
  toolbarButtons: any[];
  taskWizardMode?: TaskWizardMode;
}

/**
 * Safe serialization function that extracts only serializable properties
 * from toolbar buttons, avoiding circular references in React components.
 */
function serializeToolbarButtons(buttons: any[]): string {
  try {
    const serializable = buttons.map(btn => ({
      label: btn.label,
      title: btn.title,
      active: btn.active,
      primary: btn.primary,
      disabled: btn.disabled
      // Exclude: icon (React.ReactNode - may contain circular refs)
      // Exclude: onClick (function - not serializable)
    }));
    return JSON.stringify(serializable);
  } catch (e) {
    // Fallback: use length and simple hash if serialization fails
    return `length:${buttons.length}`;
  }
}

/**
 * Hook that exposes toolbar via callback when in docking mode.
 * ✅ CRITICAL: Does NOT call onToolbarUpdate when taskWizardMode === 'full' (toolbar must be hidden)
 * ✅ FIX: Uses ref-based comparison to prevent infinite loops from array reference changes
 * ✅ FIX: Safe serialization that avoids circular references in React components
 */
export function useToolbarSync(params: UseToolbarSyncParams) {
  const { hideHeader, onToolbarUpdate, toolbarButtons, taskWizardMode } = params;

  const headerColor = '#9a4f00';
  const prevToolbarRef = useRef<string>('');
  const prevTaskWizardModeRef = useRef<TaskWizardMode | undefined>(undefined);
  const prevHideHeaderRef = useRef<boolean | undefined>(undefined);

  useEffect(() => {
    // Serialize toolbar buttons for comparison (safe - excludes React components)
    const toolbarKey = serializeToolbarButtons(toolbarButtons);
    const hasChanged =
      toolbarKey !== prevToolbarRef.current ||
      taskWizardMode !== prevTaskWizardModeRef.current ||
      hideHeader !== prevHideHeaderRef.current;

    if (!hasChanged) {
      return;
    }

    // Update refs
    prevToolbarRef.current = toolbarKey;
    prevTaskWizardModeRef.current = taskWizardMode;
    prevHideHeaderRef.current = hideHeader;

    // ✅ CRITICAL: Do NOT update toolbar when taskWizardMode === 'full' (toolbar must be hidden)
    if (hideHeader && onToolbarUpdate && taskWizardMode !== 'full') {
      onToolbarUpdate(toolbarButtons, headerColor);
    } else if (hideHeader && onToolbarUpdate && taskWizardMode === 'full') {
      // ✅ CRITICAL: Explicitly clear toolbar when in full wizard mode
      onToolbarUpdate([], headerColor);
    }
  }, [hideHeader, onToolbarUpdate, toolbarButtons, taskWizardMode]);
}
