import { themeReducer } from '../../reducers/themeReducer';
import { initialThemeState, ThemeState, ThemeElement } from '../../types/theme';

// ============================================================================
// TEST THEME REDUCER
// ============================================================================

describe('Theme Reducer', () => {
  let initialState: ThemeState;

  beforeEach(() => {
    initialState = { ...initialThemeState };
  });

  describe('TOGGLE_EDIT_MODE', () => {
    it('should toggle edit mode from false to true', () => {
      const action = { type: 'TOGGLE_EDIT_MODE' as const };
      const newState = themeReducer(initialState, action);

      expect(newState.isEditMode).toBe(true);
      expect(newState.customCursor).toBe(true);
    });

    it('should toggle edit mode from true to false', () => {
      const stateWithEditMode = { ...initialState, isEditMode: true, customCursor: true };
      const action = { type: 'TOGGLE_EDIT_MODE' as const };
      const newState = themeReducer(stateWithEditMode, action);

      expect(newState.isEditMode).toBe(false);
      expect(newState.customCursor).toBe(false);
    });

    it('should close color picker when disabling edit mode', () => {
      const stateWithOpenPicker = {
        ...initialState,
        isEditMode: true,
        isColorPickerOpen: true,
        activeElement: { id: 'test', type: 'header', name: 'Test', properties: {}, selector: '.test', editableProperties: [] },
        activeProperty: 'background'
      };
      
      const action = { type: 'TOGGLE_EDIT_MODE' as const };
      const newState = themeReducer(stateWithOpenPicker, action);

      expect(newState.isEditMode).toBe(false);
      expect(newState.isColorPickerOpen).toBe(false);
      expect(newState.activeElement).toBe(null);
      expect(newState.activeProperty).toBe(null);
    });
  });

  describe('OPEN_COLOR_PICKER', () => {
    const mockElement: ThemeElement = {
      id: 'test-element',
      type: 'header',
      name: 'Test Header',
      properties: {
        background: '#ffffff',
        color: '#000000',
        borderColor: '#cccccc',
        fontSize: '14px',
        fontWeight: 'normal'
      },
      selector: '.test-header',
      editableProperties: ['background', 'color']
    };

    it('should open color picker with correct state', () => {
      const action = {
        type: 'OPEN_COLOR_PICKER' as const,
        payload: {
          element: mockElement,
          property: 'background' as const,
          position: { x: 100, y: 200 },
          originalColor: '#ffffff'
        }
      };

      const newState = themeReducer(initialState, action);

      expect(newState.isColorPickerOpen).toBe(true);
      expect(newState.activeElement).toBe(mockElement);
      expect(newState.activeProperty).toBe('background');
      expect(newState.pickerPosition).toEqual({ x: 100, y: 200 });
      expect(newState.currentColor).toBe('#ffffff');
      expect(newState.originalColor).toBe('#ffffff');
    });

    it('should handle different properties', () => {
      const action = {
        type: 'OPEN_COLOR_PICKER' as const,
        payload: {
          element: mockElement,
          property: 'color' as const,
          position: { x: 300, y: 400 },
          originalColor: '#000000'
        }
      };

      const newState = themeReducer(initialState, action);

      expect(newState.activeProperty).toBe('color');
      expect(newState.pickerPosition).toEqual({ x: 300, y: 400 });
      expect(newState.currentColor).toBe('#000000');
      expect(newState.originalColor).toBe('#000000');
    });
  });

  describe('CLOSE_COLOR_PICKER', () => {
    it('should close color picker and reset state', () => {
      const stateWithOpenPicker = {
        ...initialState,
        isColorPickerOpen: true,
        activeElement: { id: 'test', type: 'header', name: 'Test', properties: {}, selector: '.test', editableProperties: [] },
        activeProperty: 'background',
        pickerPosition: { x: 100, y: 200 },
        currentColor: '#ff0000',
        originalColor: '#ffffff'
      };

      const action = { type: 'CLOSE_COLOR_PICKER' as const };
      const newState = themeReducer(stateWithOpenPicker, action);

      expect(newState.isColorPickerOpen).toBe(false);
      expect(newState.activeElement).toBe(null);
      expect(newState.activeProperty).toBe(null);
    });
  });

  describe('UPDATE_CURRENT_COLOR', () => {
    it('should update current color', () => {
      const stateWithPicker = {
        ...initialState,
        isColorPickerOpen: true,
        currentColor: '#ffffff'
      };

      const action = {
        type: 'UPDATE_CURRENT_COLOR' as const,
        payload: '#ff0000'
      };

      const newState = themeReducer(stateWithPicker, action);

      expect(newState.currentColor).toBe('#ff0000');
    });

    it('should preserve other state properties', () => {
      const stateWithPicker = {
        ...initialState,
        isColorPickerOpen: true,
        activeElement: { id: 'test', type: 'header', name: 'Test', properties: {}, selector: '.test', editableProperties: [] },
        activeProperty: 'background',
        currentColor: '#ffffff',
        originalColor: '#ffffff'
      };

      const action = {
        type: 'UPDATE_CURRENT_COLOR' as const,
        payload: '#00ff00'
      };

      const newState = themeReducer(stateWithPicker, action);

      expect(newState.currentColor).toBe('#00ff00');
      expect(newState.isColorPickerOpen).toBe(true);
      expect(newState.activeElement).toBeDefined();
      expect(newState.activeProperty).toBe('background');
      expect(newState.originalColor).toBe('#ffffff');
    });
  });

  describe('APPLY_COLOR_CHANGE', () => {
    it('should apply color change and close picker', () => {
      const stateWithPicker = {
        ...initialState,
        isColorPickerOpen: true,
        activeElement: { id: 'test', type: 'header', name: 'Test', properties: {}, selector: '.test', editableProperties: [] },
        activeProperty: 'background',
        currentColor: '#ff0000',
        originalColor: '#ffffff',
        undoStack: []
      };

      const action = {
        type: 'APPLY_COLOR_CHANGE' as const,
        payload: {
          elementId: 'test',
          property: 'background' as const,
          color: '#ff0000'
        }
      };

      const newState = themeReducer(stateWithPicker, action);

      expect(newState.isColorPickerOpen).toBe(false);
      expect(newState.activeElement).toBe(null);
      expect(newState.activeProperty).toBe(null);
      expect(newState.undoStack).toHaveLength(1);
      expect(newState.redoStack).toHaveLength(0);
    });

    it('should create correct undo entry', () => {
      const stateWithPicker = {
        ...initialState,
        isColorPickerOpen: true,
        originalColor: '#ffffff',
        undoStack: []
      };

      const action = {
        type: 'APPLY_COLOR_CHANGE' as const,
        payload: {
          elementId: 'test-element',
          property: 'background' as const,
          color: '#ff0000'
        }
      };

      const newState = themeReducer(stateWithPicker, action);
      const undoEntry = newState.undoStack[0];

      expect(undoEntry.elementId).toBe('test-element');
      expect(undoEntry.property).toBe('background');
      expect(undoEntry.oldValue).toBe('#ffffff');
      expect(undoEntry.newValue).toBe('#ff0000');
      expect(typeof undoEntry.timestamp).toBe('number');
    });

    it('should clear redo stack when applying new change', () => {
      const stateWithRedo = {
        ...initialState,
        isColorPickerOpen: true,
        originalColor: '#ffffff',
        undoStack: [],
        redoStack: [
          {
            elementId: 'test',
            property: 'background',
            oldValue: '#ff0000',
            newValue: '#ffffff',
            timestamp: Date.now()
          }
        ]
      };

      const action = {
        type: 'APPLY_COLOR_CHANGE' as const,
        payload: {
          elementId: 'test',
          property: 'background' as const,
          color: '#00ff00'
        }
      };

      const newState = themeReducer(stateWithRedo, action);

      expect(newState.redoStack).toHaveLength(0);
    });
  });

  describe('UNDO', () => {
    it('should do nothing when undo stack is empty', () => {
      const action = { type: 'UNDO' as const };
      const newState = themeReducer(initialState, action);

      expect(newState).toEqual(initialState);
    });

    it('should undo last change and add to redo stack', () => {
      const undoEntry = {
        elementId: 'test',
        property: 'background' as const,
        oldValue: '#ffffff',
        newValue: '#ff0000',
        timestamp: Date.now()
      };

      const stateWithUndo = {
        ...initialState,
        undoStack: [undoEntry],
        redoStack: []
      };

      const action = { type: 'UNDO' as const };
      const newState = themeReducer(stateWithUndo, action);

      expect(newState.undoStack).toHaveLength(0);
      expect(newState.redoStack).toHaveLength(1);
      
      const redoEntry = newState.redoStack[0];
      expect(redoEntry.elementId).toBe('test');
      expect(redoEntry.property).toBe('background');
      expect(redoEntry.oldValue).toBe('#ff0000');
      expect(redoEntry.newValue).toBe('#ffffff');
    });
  });

  describe('REDO', () => {
    it('should do nothing when redo stack is empty', () => {
      const action = { type: 'REDO' as const };
      const newState = themeReducer(initialState, action);

      expect(newState).toEqual(initialState);
    });

    it('should redo last undone change and add to undo stack', () => {
      const redoEntry = {
        elementId: 'test',
        property: 'background' as const,
        oldValue: '#ff0000',
        newValue: '#ffffff',
        timestamp: Date.now()
      };

      const stateWithRedo = {
        ...initialState,
        undoStack: [],
        redoStack: [redoEntry]
      };

      const action = { type: 'REDO' as const };
      const newState = themeReducer(stateWithRedo, action);

      expect(newState.redoStack).toHaveLength(0);
      expect(newState.undoStack).toHaveLength(1);
      
      const undoEntry = newState.undoStack[0];
      expect(undoEntry.elementId).toBe('test');
      expect(undoEntry.property).toBe('background');
      expect(undoEntry.oldValue).toBe('#ffffff');
      expect(undoEntry.newValue).toBe('#ff0000');
    });
  });

  describe('SET_CUSTOM_CURSOR', () => {
    it('should set custom cursor', () => {
      const action = {
        type: 'SET_CUSTOM_CURSOR' as const,
        payload: true
      };

      const newState = themeReducer(initialState, action);

      expect(newState.customCursor).toBe(true);
    });

    it('should unset custom cursor', () => {
      const stateWithCursor = { ...initialState, customCursor: true };
      
      const action = {
        type: 'SET_CUSTOM_CURSOR' as const,
        payload: false
      };

      const newState = themeReducer(stateWithCursor, action);

      expect(newState.customCursor).toBe(false);
    });
  });

  describe('Unknown action', () => {
    it('should return current state for unknown action', () => {
      const action = { type: 'UNKNOWN_ACTION' as any };
      const newState = themeReducer(initialState, action);

      expect(newState).toEqual(initialState);
    });
  });

  describe('State immutability', () => {
    it('should not mutate original state', () => {
      const originalState = { ...initialState };
      const action = { type: 'TOGGLE_EDIT_MODE' as const };
      
      themeReducer(originalState, action);

      expect(originalState).toEqual(initialState);
    });

    it('should create new state object', () => {
      const action = { type: 'TOGGLE_EDIT_MODE' as const };
      const newState = themeReducer(initialState, action);

      expect(newState).not.toBe(initialState);
    });
  });
}); 