import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, useThemeContext } from '../../context/ThemeContext';
import { ThemeElement } from '../../types/theme';

// ============================================================================
// TEST COMPONENT FOR CONTEXT
// ============================================================================

const TestComponent = () => {
  const { state, actions } = useThemeContext();
  
  return (
    <div>
      <div data-testid="edit-mode">{state.isEditMode ? 'true' : 'false'}</div>
      <div data-testid="color-picker-open">{state.isColorPickerOpen ? 'true' : 'false'}</div>
      <div data-testid="current-color">{state.currentColor}</div>
      <button 
        data-testid="toggle-edit" 
        onClick={actions.toggleEditMode}
      >
        Toggle Edit
      </button>
      <button 
        data-testid="open-picker" 
        onClick={() => {
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
          actions.openColorPicker(mockElement, 'background', { x: 100, y: 200 });
        }}
      >
        Open Picker
      </button>
      <button 
        data-testid="close-picker" 
        onClick={actions.closeColorPicker}
      >
        Close Picker
      </button>
      <button 
        data-testid="update-color" 
        onClick={() => actions.updateCurrentColor('#ff0000')}
      >
        Update Color
      </button>
      <button 
        data-testid="apply-change" 
        onClick={() => actions.applyColorChange('test-element', 'background', '#ff0000')}
      >
        Apply Change
      </button>
      <button 
        data-testid="undo" 
        onClick={actions.undo}
      >
        Undo
      </button>
      <button 
        data-testid="redo" 
        onClick={actions.redo}
      >
        Redo
      </button>
    </div>
  );
};

// ============================================================================
// TEST THEME CONTEXT
// ============================================================================

describe('Theme Context', () => {
  const renderWithProvider = (component: React.ReactElement) => {
    return render(
      <ThemeProvider>
        {component}
      </ThemeProvider>
    );
  };

  describe('Initial State', () => {
    it('should provide initial state', () => {
      renderWithProvider(<TestComponent />);
      
      expect(screen.getByTestId('edit-mode')).toHaveTextContent('false');
      expect(screen.getByTestId('color-picker-open')).toHaveTextContent('false');
      expect(screen.getByTestId('current-color')).toHaveTextContent('#000000');
    });
  });

  describe('Toggle Edit Mode', () => {
    it('should toggle edit mode when button is clicked', () => {
      renderWithProvider(<TestComponent />);
      
      const toggleButton = screen.getByTestId('toggle-edit');
      
      // Initial state
      expect(screen.getByTestId('edit-mode')).toHaveTextContent('false');
      
      // Click to enable
      fireEvent.click(toggleButton);
      expect(screen.getByTestId('edit-mode')).toHaveTextContent('true');
      
      // Click to disable
      fireEvent.click(toggleButton);
      expect(screen.getByTestId('edit-mode')).toHaveTextContent('false');
    });
  });

  describe('Open Color Picker', () => {
    it('should open color picker with correct state', () => {
      renderWithProvider(<TestComponent />);
      
      const openButton = screen.getByTestId('open-picker');
      
      // Initial state
      expect(screen.getByTestId('color-picker-open')).toHaveTextContent('false');
      
      // Open picker
      fireEvent.click(openButton);
      
      expect(screen.getByTestId('color-picker-open')).toHaveTextContent('true');
      expect(screen.getByTestId('current-color')).toHaveTextContent('#ffffff');
    });
  });

  describe('Close Color Picker', () => {
    it('should close color picker', async () => {
      renderWithProvider(<TestComponent />);
      
      const openButton = screen.getByTestId('open-picker');
      const closeButton = screen.getByTestId('close-picker');
      
      // Open picker
      fireEvent.click(openButton);
      expect(screen.getByTestId('color-picker-open')).toHaveTextContent('true');
      
      // Close picker
      fireEvent.click(closeButton);
      expect(screen.getByTestId('color-picker-open')).toHaveTextContent('false');
    });
  });

  describe('Update Current Color', () => {
    it('should update current color', () => {
      renderWithProvider(<TestComponent />);
      
      const openButton = screen.getByTestId('open-picker');
      const updateButton = screen.getByTestId('update-color');
      
      // Open picker first
      fireEvent.click(openButton);
      expect(screen.getByTestId('current-color')).toHaveTextContent('#ffffff');
      
      // Update color
      fireEvent.click(updateButton);
      expect(screen.getByTestId('current-color')).toHaveTextContent('#ff0000');
    });
  });

  describe('Apply Color Change', () => {
    it('should apply color change and close picker', () => {
      renderWithProvider(<TestComponent />);
      
      const openButton = screen.getByTestId('open-picker');
      const applyButton = screen.getByTestId('apply-change');
      
      // Open picker
      fireEvent.click(openButton);
      expect(screen.getByTestId('color-picker-open')).toHaveTextContent('true');
      
      // Apply change
      fireEvent.click(applyButton);
      expect(screen.getByTestId('color-picker-open')).toHaveTextContent('false');
    });
  });

  describe('Undo/Redo', () => {
    it('should handle undo when no changes exist', () => {
      renderWithProvider(<TestComponent />);
      
      const undoButton = screen.getByTestId('undo');
      
      // Undo with empty stack should do nothing
      fireEvent.click(undoButton);
      
      // State should remain unchanged
      expect(screen.getByTestId('edit-mode')).toHaveTextContent('false');
    });

    it('should handle redo when no undone changes exist', () => {
      renderWithProvider(<TestComponent />);
      
      const redoButton = screen.getByTestId('redo');
      
      // Redo with empty stack should do nothing
      fireEvent.click(redoButton);
      
      // State should remain unchanged
      expect(screen.getByTestId('edit-mode')).toHaveTextContent('false');
    });
  });

  describe('Context Provider', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = vi.fn();
      
      expect(() => {
        render(<TestComponent />);
      }).toThrow('useThemeContext must be used within ThemeProvider');
      
      console.error = originalError;
    });

    it('should provide context when wrapped in provider', () => {
      expect(() => {
        renderWithProvider(<TestComponent />);
      }).not.toThrow();
    });
  });

  describe('Actions Integration', () => {
    it('should handle complete workflow', async () => {
      renderWithProvider(<TestComponent />);
      
      // 1. Enable edit mode
      fireEvent.click(screen.getByTestId('toggle-edit'));
      expect(screen.getByTestId('edit-mode')).toHaveTextContent('true');
      
      // 2. Open color picker
      fireEvent.click(screen.getByTestId('open-picker'));
      expect(screen.getByTestId('color-picker-open')).toHaveTextContent('true');
      expect(screen.getByTestId('current-color')).toHaveTextContent('#ffffff');
      
      // 3. Update color
      fireEvent.click(screen.getByTestId('update-color'));
      expect(screen.getByTestId('current-color')).toHaveTextContent('#ff0000');
      
      // 4. Apply change
      fireEvent.click(screen.getByTestId('apply-change'));
      expect(screen.getByTestId('color-picker-open')).toHaveTextContent('false');
      
      // 5. Disable edit mode
      fireEvent.click(screen.getByTestId('toggle-edit'));
      expect(screen.getByTestId('edit-mode')).toHaveTextContent('false');
    });
  });
}); 