// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { TaskWizardMode } from '@taskEditor/EditorHost/types';

export interface UseToolbarSyncParams {
  hideHeader?: boolean;
  onToolbarUpdate?: (toolbar: any[], color: string) => void;
  toolbarButtons: any[];
  taskWizardMode?: TaskWizardMode;
}

/**
 * Placeholder hook for dock-tab toolbar sync.
 *
 * When the ResponseEditor runs inside a dock tab, `hideHeader` is true and the orange
 * bar is rendered by the tab chrome. `ResponseEditorLayout` calls `onToolbarUpdate`
 * with `[...toolbarButtons, ...wizardToggleButtons]` so Wizard / Manual stay visible.
 *
 * A previous implementation synced only `toolbarButtons` here and cleared the bar in
 * full wizard mode, which removed both the main actions and the Wizard/Manual toggles.
 */
export function useToolbarSync(_params: UseToolbarSyncParams) {
  // No-op: toolbar for hideHeader is owned by ResponseEditorLayout.
}
