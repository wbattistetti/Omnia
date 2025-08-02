import { ThemeElement } from '../types';

// ============================================================================
// TIPI DELLO STATO
// ============================================================================

export interface ThemeState {
  isEditMode: boolean;
  isMiniPickerOpen: boolean;
  editingElement: ThemeElement | null;
  editingProperty: keyof ThemeElement['properties'] | null;
  previewValue: string;
  originalValue: string;
  customCursor: boolean;
  temporaryChanges: Map<string, string>;
}

// ============================================================================
// AZIONI
// ============================================================================

export type ThemeAction =
  | { type: 'TOGGLE_EDIT_MODE' }
  | { type: 'OPEN_MINI_PICKER'; payload: { element: ThemeElement; property: keyof ThemeElement['properties']; position: { x: number; y: number }; originalValue: string } }
  | { type: 'CLOSE_MINI_PICKER' }
  | { type: 'UPDATE_PREVIEW_VALUE'; payload: string }
  | { type: 'APPLY_PROPERTY_CHANGE'; payload: { elementId: string; property: keyof ThemeElement['properties']; value: string } }
  | { type: 'RESTORE_ORIGINAL_VALUE' }
  | { type: 'SET_CUSTOM_CURSOR'; payload: boolean }
  | { type: 'CLEAR_TEMPORARY_CHANGES' };

// ============================================================================
// STATO INIZIALE
// ============================================================================

export const initialState: ThemeState = {
  isEditMode: false,
  isMiniPickerOpen: false,
  editingElement: null,
  editingProperty: null,
  previewValue: '',
  originalValue: '',
  customCursor: false,
  temporaryChanges: new Map(),
};

// ============================================================================
// REDUCER
// ============================================================================

export function themeReducer(state: ThemeState, action: ThemeAction): ThemeState {
  switch (action.type) {
    case 'TOGGLE_EDIT_MODE':
      return {
        ...state,
        isEditMode: !state.isEditMode,
        customCursor: !state.isEditMode,
        // Chiudi il picker quando disattivi il tema
        ...(state.isEditMode && {
          isMiniPickerOpen: false,
          editingElement: null,
          editingProperty: null,
          previewValue: '',
          originalValue: '',
        }),
      };

    case 'OPEN_MINI_PICKER':
      return {
        ...state,
        isMiniPickerOpen: true,
        editingElement: action.payload.element,
        editingProperty: action.payload.property,
        originalValue: action.payload.originalValue,
        previewValue: action.payload.originalValue,
      };

    case 'CLOSE_MINI_PICKER':
      return {
        ...state,
        isMiniPickerOpen: false,
        editingElement: null,
        editingProperty: null,
        previewValue: '',
        originalValue: '',
      };

    case 'UPDATE_PREVIEW_VALUE':
      return {
        ...state,
        previewValue: action.payload,
      };

    case 'APPLY_PROPERTY_CHANGE':
      const newTemporaryChanges = new Map(state.temporaryChanges);
      newTemporaryChanges.set(`${action.payload.elementId}-${action.payload.property}`, action.payload.value);
      
      return {
        ...state,
        temporaryChanges: newTemporaryChanges,
        isMiniPickerOpen: false,
        editingElement: null,
        editingProperty: null,
        previewValue: '',
        originalValue: '',
      };

    case 'RESTORE_ORIGINAL_VALUE':
      return {
        ...state,
        previewValue: state.originalValue,
        isMiniPickerOpen: false,
        editingElement: null,
        editingProperty: null,
        originalValue: '',
      };

    case 'SET_CUSTOM_CURSOR':
      return {
        ...state,
        customCursor: action.payload,
      };

    case 'CLEAR_TEMPORARY_CHANGES':
      return {
        ...state,
        temporaryChanges: new Map(),
      };

    default:
      return state;
  }
} 