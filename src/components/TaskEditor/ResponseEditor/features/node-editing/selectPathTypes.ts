/**
 * Shared types for programmatic node selection by path (sidebar / tree).
 */

export type SelectPathOptions = {
  /**
   * When false, do not focus the sidebar container after updating the path.
   * Use when opening inline rename so the input keeps focus (autoFocus / caret).
   * Default: true (keyboard UX when navigating with click).
   */
  focusSidebar?: boolean;
};

export type SelectPathHandler = (path: number[], options?: SelectPathOptions) => void;
