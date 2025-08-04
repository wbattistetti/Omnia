import { 
  Position, 
  ThemeProperties, 
  ThemeElement, 
  ThemeState, 
  ThemeChange, 
  ThemeAction,
  initialThemeState 
} from '../../types/theme';

// ============================================================================
// TEST TYPES AND INTERFACES
// ============================================================================

describe('Theme Types', () => {
  describe('Position', () => {
    it('should have correct structure', () => {
      const position: Position = { x: 100, y: 200 };
      
      expect(position).toHaveProperty('x');
      expect(position).toHaveProperty('y');
      expect(typeof position.x).toBe('number');
      expect(typeof position.y).toBe('number');
    });

    it('should accept valid coordinates', () => {
      const position: Position = { x: 0, y: 0 };
      expect(position.x).toBe(0);
      expect(position.y).toBe(0);
    });
  });

  describe('ThemeProperties', () => {
    it('should have all required properties', () => {
      const properties: ThemeProperties = {
        background: '#ffffff',
        color: '#000000',
        borderColor: '#cccccc',
        fontSize: '14px',
        fontWeight: 'normal'
      };

      expect(properties).toHaveProperty('background');
      expect(properties).toHaveProperty('color');
      expect(properties).toHaveProperty('borderColor');
      expect(properties).toHaveProperty('fontSize');
      expect(properties).toHaveProperty('fontWeight');
    });

    it('should accept valid CSS values', () => {
      const properties: ThemeProperties = {
        background: 'linear-gradient(45deg, #ff0000, #00ff00)',
        color: 'rgb(255, 0, 0)',
        borderColor: 'hsl(120, 100%, 50%)',
        fontSize: '1.2rem',
        fontWeight: 'bold'
      };

      expect(properties.background).toContain('linear-gradient');
      expect(properties.color).toContain('rgb');
      expect(properties.borderColor).toContain('hsl');
    });
  });

  describe('ThemeElement', () => {
    it('should have correct structure', () => {
      const element: ThemeElement = {
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

      expect(element).toHaveProperty('id');
      expect(element).toHaveProperty('type');
      expect(element).toHaveProperty('name');
      expect(element).toHaveProperty('properties');
      expect(element).toHaveProperty('selector');
      expect(element).toHaveProperty('editableProperties');
    });

    it('should accept valid element types', () => {
      const validTypes = ['header', 'node', 'canvas', 'button', 'text', 'component'] as const;
      
      validTypes.forEach(type => {
        const element: ThemeElement = {
          id: `test-${type}`,
          type,
          name: `Test ${type}`,
          properties: {
            background: '#ffffff',
            color: '#000000',
            borderColor: '#cccccc',
            fontSize: '14px',
            fontWeight: 'normal'
          },
          selector: `.test-${type}`,
          editableProperties: ['background']
        };

        expect(element.type).toBe(type);
      });
    });

    it('should have editableProperties as subset of ThemeProperties keys', () => {
      const element: ThemeElement = {
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
        editableProperties: ['background', 'color', 'fontSize']
      };

      const validProperties = ['background', 'color', 'borderColor', 'fontSize', 'fontWeight'] as const;
      
      element.editableProperties.forEach(prop => {
        expect(validProperties).toContain(prop);
      });
    });
  });

  describe('ThemeState', () => {
    it('should have correct structure', () => {
      const state: ThemeState = {
        isEditMode: false,
        isColorPickerOpen: false,
        activeElement: null,
        activeProperty: null,
        pickerPosition: { x: 100, y: 100 },
        currentColor: '#000000',
        originalColor: '#000000',
        customCursor: false,
        undoStack: [],
        redoStack: []
      };

      expect(state).toHaveProperty('isEditMode');
      expect(state).toHaveProperty('isColorPickerOpen');
      expect(state).toHaveProperty('activeElement');
      expect(state).toHaveProperty('activeProperty');
      expect(state).toHaveProperty('pickerPosition');
      expect(state).toHaveProperty('currentColor');
      expect(state).toHaveProperty('originalColor');
      expect(state).toHaveProperty('customCursor');
      expect(state).toHaveProperty('undoStack');
      expect(state).toHaveProperty('redoStack');
    });

    it('should have correct types for all properties', () => {
      const state: ThemeState = {
        isEditMode: true,
        isColorPickerOpen: true,
        activeElement: {
          id: 'test',
          type: 'header',
          name: 'Test',
          properties: {
            background: '#ffffff',
            color: '#000000',
            borderColor: '#cccccc',
            fontSize: '14px',
            fontWeight: 'normal'
          },
          selector: '.test',
          editableProperties: ['background']
        },
        activeProperty: 'background',
        pickerPosition: { x: 200, y: 300 },
        currentColor: '#ff0000',
        originalColor: '#000000',
        customCursor: true,
        undoStack: [],
        redoStack: []
      };

      expect(typeof state.isEditMode).toBe('boolean');
      expect(typeof state.isColorPickerOpen).toBe('boolean');
      expect(typeof state.activeProperty).toBe('string');
      expect(typeof state.currentColor).toBe('string');
      expect(typeof state.originalColor).toBe('string');
      expect(typeof state.customCursor).toBe('boolean');
      expect(Array.isArray(state.undoStack)).toBe(true);
      expect(Array.isArray(state.redoStack)).toBe(true);
    });
  });

  describe('ThemeChange', () => {
    it('should have correct structure', () => {
      const change: ThemeChange = {
        elementId: 'test-element',
        property: 'background',
        oldValue: '#ffffff',
        newValue: '#000000',
        timestamp: Date.now()
      };

      expect(change).toHaveProperty('elementId');
      expect(change).toHaveProperty('property');
      expect(change).toHaveProperty('oldValue');
      expect(change).toHaveProperty('newValue');
      expect(change).toHaveProperty('timestamp');
    });

    it('should have correct types', () => {
      const change: ThemeChange = {
        elementId: 'test-element',
        property: 'color',
        oldValue: '#ffffff',
        newValue: '#ff0000',
        timestamp: 1234567890
      };

      expect(typeof change.elementId).toBe('string');
      expect(typeof change.property).toBe('string');
      expect(typeof change.oldValue).toBe('string');
      expect(typeof change.newValue).toBe('string');
      expect(typeof change.timestamp).toBe('number');
    });
  });

  describe('initialThemeState', () => {
    it('should have correct default values', () => {
      expect(initialThemeState.isEditMode).toBe(false);
      expect(initialThemeState.isColorPickerOpen).toBe(false);
      expect(initialThemeState.activeElement).toBe(null);
      expect(initialThemeState.activeProperty).toBe(null);
      expect(initialThemeState.pickerPosition).toEqual({ x: 100, y: 100 });
      expect(initialThemeState.currentColor).toBe('#000000');
      expect(initialThemeState.originalColor).toBe('#000000');
      expect(initialThemeState.customCursor).toBe(false);
      expect(initialThemeState.undoStack).toEqual([]);
      expect(initialThemeState.redoStack).toEqual([]);
    });

    it('should be a valid ThemeState', () => {
      const state: ThemeState = initialThemeState;
      expect(state).toBeDefined();
      expect(typeof state.isEditMode).toBe('boolean');
    });
  });
}); 