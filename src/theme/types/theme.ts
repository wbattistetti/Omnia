// ============================================================================
// TIPI DEL SISTEMA TEMA
// ============================================================================

export interface Position {
  x: number;
  y: number;
}

export interface ThemeProperties {
  background: string;
  color: string;
  borderColor: string;
  fontSize: string;
  fontWeight: string;
}

export interface ThemeElement {
  id: string;
  type: 'header' | 'node' | 'canvas' | 'button' | 'text' | 'component';
  name: string;
  properties: ThemeProperties;
  selector: string;
  editableProperties: (keyof ThemeProperties)[];
}

export interface ThemeState {
  isEditMode: boolean;
  isColorPickerOpen: boolean;
  activeElement: ThemeElement | null;
  activeProperty: keyof ThemeProperties | null;
  pickerPosition: Position;
  currentColor: string;
  originalColor: string;
  customCursor: boolean;
  undoStack: ThemeChange[];
  redoStack: ThemeChange[];
}

export interface ThemeChange {
  elementId: string;
  property: keyof ThemeProperties;
  oldValue: string;
  newValue: string;
  timestamp: number;
}

export type ThemeAction =
  | { type: 'TOGGLE_EDIT_MODE' }
  | { type: 'OPEN_COLOR_PICKER'; payload: { element: ThemeElement; property: keyof ThemeProperties; position: Position; originalColor: string } }
  | { type: 'CLOSE_COLOR_PICKER' }
  | { type: 'UPDATE_CURRENT_COLOR'; payload: string }
  | { type: 'APPLY_COLOR_CHANGE'; payload: { elementId: string; property: keyof ThemeProperties; color: string } }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SET_CUSTOM_CURSOR'; payload: boolean };

export const initialThemeState: ThemeState = {
  isEditMode: false,
  isColorPickerOpen: false,
  activeElement: null,
  activeProperty: null,
  pickerPosition: { x: 100, y: 100 },
  currentColor: '#000000',
  originalColor: '#000000',
  customCursor: false,
  undoStack: [],
  redoStack: [],
}; 