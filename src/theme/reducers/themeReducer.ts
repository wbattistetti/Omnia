import { ThemeState, ThemeAction, ThemeChange } from '../types/theme';

export function themeReducer(state: ThemeState, action: ThemeAction): ThemeState {
  switch (action.type) {
    case 'TOGGLE_EDIT_MODE':
      return {
        ...state,
        isEditMode: !state.isEditMode,
        customCursor: !state.isEditMode,
        // Chiudi il picker quando disattivi il tema
        ...(state.isEditMode && {
          isColorPickerOpen: false,
          activeElement: null,
          activeProperty: null,
        }),
      };

    case 'OPEN_COLOR_PICKER':
      return {
        ...state,
        isColorPickerOpen: true,
        activeElement: action.payload.element,
        activeProperty: action.payload.property,
        pickerPosition: action.payload.position,
        currentColor: action.payload.originalColor,
        originalColor: action.payload.originalColor,
      };

    case 'CLOSE_COLOR_PICKER':
      return {
        ...state,
        isColorPickerOpen: false,
        activeElement: null,
        activeProperty: null,
      };

    case 'UPDATE_CURRENT_COLOR':
      return {
        ...state,
        currentColor: action.payload,
      };

    case 'APPLY_COLOR_CHANGE': {
      const { elementId, property, color } = action.payload;
      
      // Crea il cambio per l'undo stack
      const change: ThemeChange = {
        elementId,
        property,
        oldValue: state.originalColor,
        newValue: color,
        timestamp: Date.now(),
      };

      return {
        ...state,
        isColorPickerOpen: false,
        activeElement: null,
        activeProperty: null,
        undoStack: [...state.undoStack, change],
        redoStack: [], // Pulisci redo quando fai una nuova modifica
      };
    }

    case 'UNDO': {
      if (state.undoStack.length === 0) return state;

      const lastChange = state.undoStack[state.undoStack.length - 1];
      const newUndoStack = state.undoStack.slice(0, -1);

      // Crea il cambio inverso per il redo stack
      const redoChange: ThemeChange = {
        elementId: lastChange.elementId,
        property: lastChange.property,
        oldValue: lastChange.newValue,
        newValue: lastChange.oldValue,
        timestamp: Date.now(),
      };

      return {
        ...state,
        undoStack: newUndoStack,
        redoStack: [...state.redoStack, redoChange],
      };
    }

    case 'REDO': {
      if (state.redoStack.length === 0) return state;

      const lastRedoChange = state.redoStack[state.redoStack.length - 1];
      const newRedoStack = state.redoStack.slice(0, -1);

      // Crea il cambio inverso per l'undo stack
      const undoChange: ThemeChange = {
        elementId: lastRedoChange.elementId,
        property: lastRedoChange.property,
        oldValue: lastRedoChange.newValue,
        newValue: lastRedoChange.oldValue,
        timestamp: Date.now(),
      };

      return {
        ...state,
        undoStack: [...state.undoStack, undoChange],
        redoStack: newRedoStack,
      };
    }

    case 'SET_CUSTOM_CURSOR':
      return {
        ...state,
        customCursor: action.payload,
      };

    default:
      return state;
  }
} 