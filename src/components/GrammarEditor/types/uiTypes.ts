// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * UI state types for Grammar Editor
 */

export interface PanelState {
  isOpen: boolean;
  width: number;
}

export interface SelectionState {
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  selectedSlotId: string | null;
  selectedSetId: string | null;
}

export interface EditorState {
  isEditing: boolean;
  editingNodeId: string | null;
  editingEdgeId: string | null;
}

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}
