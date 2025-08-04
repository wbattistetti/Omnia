import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '../../context/ThemeContext';
import { ColorPicker } from '../../components/ColorPicker';
import { ThemeToggle } from '../../components/ThemeToggle';
import { useThemeEditor } from '../../hooks/useThemeEditor';
import { Position } from '../../types/theme';

// ============================================================================
// MOCK REACT-COLORFUL
// ============================================================================

jest.mock('react-colorful', () => ({
  HexColorPicker: ({ color, onChange }: { color: string; onChange: (color: string) => void }) => (
    <div data-testid="hex-color-picker">
      <input 
        data-testid="color-picker-input"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter color"
      />
    </div>
  ),
  HexColorInput: ({ color, onChange }: { color: string; onChange: (color: string) => void }) => (
    <input 
      data-testid="hex-color-input"
      value={color}
      onChange={(e) => onChange(e.target.value)}
      placeholder="#000000"
    />
  )
}));

// ============================================================================
// TEST COMPONENT FOR INTEGRATION
// ============================================================================

const TestIntegrationComponent = () => {
  const { isEditMode, toggleEditMode, createClickHandler } = useThemeEditor();
  
  return (
    <div>
      <ThemeToggle />
      <div 
        data-testid="editable-element"
        data-theme-element="test-element"
        onClick={createClickHandler('test-element', 'background')}
        style={{ background: '#ffffff', padding: '20px' }}
      >
        Click me to edit
      </div>
      <ColorPicker
        isOpen={false}
        position={{ x: 100, y: 100 }}
        elementId="test-element"
        property="background"
        initialColor="#ffffff"
      />
    </div>
  );
};

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Theme System Integration', () => {
  const renderWithProvider = (component: React.ReactElement) => {
    return render(
      <ThemeProvider>
        {component}
      </ThemeProvider>
    );
  };

  beforeEach(() => {
    // Mock document.querySelector
    const mockElement = {
      style: {
        background: '#ffffff'
      }
    };
    jest.spyOn(document, 'querySelector').mockReturnValue(mockElement as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Complete Theme Workflow', () => {
    it('should handle complete theme editing workflow', async () => {
      renderWithProvider(<TestIntegrationComponent />);
      
      // 1. Initial state - edit mode should be off
      expect(screen.getByTestId('editable-element')).toBeInTheDocument();
      
      // 2. Enable edit mode via toggle
      const toggleButton = screen.getByRole('button', { name: /theme/i });
      fireEvent.click(toggleButton);
      
      // 3. Click on editable element to open color picker
      const editableElement = screen.getByTestId('editable-element');
      fireEvent.click(editableElement);
      
      // 4. Color picker should be visible
      await waitFor(() => {
        expect(screen.getByTestId('hex-color-picker')).toBeInTheDocument();
      });
      
      // 5. Change color in picker
      const colorInput = screen.getByTestId('color-picker-input');
      fireEvent.change(colorInput, { target: { value: '#ff0000' } });
      
      // 6. Apply color change
      const confirmButton = screen.getByRole('button', { name: /conferma/i });
      fireEvent.click(confirmButton);
      
      // 7. Color picker should close
      await waitFor(() => {
        expect(screen.queryByTestId('hex-color-picker')).not.toBeInTheDocument();
      });
    });

    it('should handle cancel workflow', async () => {
      renderWithProvider(<TestIntegrationComponent />);
      
      // Enable edit mode
      const toggleButton = screen.getByRole('button', { name: /theme/i });
      fireEvent.click(toggleButton);
      
      // Click editable element
      const editableElement = screen.getByTestId('editable-element');
      fireEvent.click(editableElement);
      
      // Color picker should open
      await waitFor(() => {
        expect(screen.getByTestId('hex-color-picker')).toBeInTheDocument();
      });
      
      // Cancel instead of applying
      const cancelButton = screen.getByRole('button', { name: /annulla/i });
      fireEvent.click(cancelButton);
      
      // Color picker should close
      await waitFor(() => {
        expect(screen.queryByTestId('hex-color-picker')).not.toBeInTheDocument();
      });
    });
  });

  describe('Theme Toggle Integration', () => {
    it('should toggle edit mode correctly', () => {
      renderWithProvider(<TestIntegrationComponent />);
      
      const toggleButton = screen.getByRole('button', { name: /theme/i });
      
      // Initial state
      expect(toggleButton).toBeInTheDocument();
      
      // Click to enable
      fireEvent.click(toggleButton);
      
      // Click to disable
      fireEvent.click(toggleButton);
    });

    it('should close color picker when disabling edit mode', async () => {
      renderWithProvider(<TestIntegrationComponent />);
      
      const toggleButton = screen.getByRole('button', { name: /theme/i });
      const editableElement = screen.getByTestId('editable-element');
      
      // Enable edit mode
      fireEvent.click(toggleButton);
      
      // Open color picker
      fireEvent.click(editableElement);
      
      await waitFor(() => {
        expect(screen.getByTestId('hex-color-picker')).toBeInTheDocument();
      });
      
      // Disable edit mode
      fireEvent.click(toggleButton);
      
      // Color picker should close
      await waitFor(() => {
        expect(screen.queryByTestId('hex-color-picker')).not.toBeInTheDocument();
      });
    });
  });

  describe('Color Picker Integration', () => {
    it('should open color picker at correct position', async () => {
      renderWithProvider(<TestIntegrationComponent />);
      
      // Enable edit mode
      const toggleButton = screen.getByRole('button', { name: /theme/i });
      fireEvent.click(toggleButton);
      
      // Click editable element
      const editableElement = screen.getByTestId('editable-element');
      fireEvent.click(editableElement);
      
      await waitFor(() => {
        const pickerContainer = screen.getByTestId('hex-color-picker').closest('div');
        expect(pickerContainer).toHaveStyle({
          left: '100px',
          top: '100px'
        });
      });
    });

    it('should display correct element and property information', async () => {
      renderWithProvider(<TestIntegrationComponent />);
      
      // Enable edit mode
      const toggleButton = screen.getByRole('button', { name: /theme/i });
      fireEvent.click(toggleButton);
      
      // Click editable element
      const editableElement = screen.getByTestId('editable-element');
      fireEvent.click(editableElement);
      
      await waitFor(() => {
        expect(screen.getByText('test-element - background')).toBeInTheDocument();
      });
    });
  });

  describe('State Management Integration', () => {
    it('should maintain state consistency across components', async () => {
      renderWithProvider(<TestIntegrationComponent />);
      
      const toggleButton = screen.getByRole('button', { name: /theme/i });
      const editableElement = screen.getByTestId('editable-element');
      
      // Enable edit mode
      fireEvent.click(toggleButton);
      
      // Click editable element
      fireEvent.click(editableElement);
      
      await waitFor(() => {
        expect(screen.getByTestId('hex-color-picker')).toBeInTheDocument();
      });
      
      // Change color
      const colorInput = screen.getByTestId('color-picker-input');
      fireEvent.change(colorInput, { target: { value: '#00ff00' } });
      
      // Apply change
      const confirmButton = screen.getByRole('button', { name: /conferma/i });
      fireEvent.click(confirmButton);
      
      // State should be consistent
      await waitFor(() => {
        expect(screen.queryByTestId('hex-color-picker')).not.toBeInTheDocument();
      });
    });

    it('should handle multiple rapid interactions', async () => {
      renderWithProvider(<TestIntegrationComponent />);
      
      const toggleButton = screen.getByRole('button', { name: /theme/i });
      const editableElement = screen.getByTestId('editable-element');
      
      // Rapid toggle
      fireEvent.click(toggleButton);
      fireEvent.click(toggleButton);
      fireEvent.click(toggleButton);
      
      // Should be in edit mode
      fireEvent.click(editableElement);
      
      await waitFor(() => {
        expect(screen.getByTestId('hex-color-picker')).toBeInTheDocument();
      });
    });
  });

  describe('Error Recovery Integration', () => {
    it('should handle DOM element errors gracefully', async () => {
      jest.spyOn(document, 'querySelector').mockReturnValue(null);
      
      renderWithProvider(<TestIntegrationComponent />);
      
      const toggleButton = screen.getByRole('button', { name: /theme/i });
      const editableElement = screen.getByTestId('editable-element');
      
      // Enable edit mode
      fireEvent.click(toggleButton);
      
      // Click editable element (should not throw)
      expect(() => {
        fireEvent.click(editableElement);
      }).not.toThrow();
    });

    it('should handle action errors gracefully', async () => {
      renderWithProvider(<TestIntegrationComponent />);
      
      const toggleButton = screen.getByRole('button', { name: /theme/i });
      const editableElement = screen.getByTestId('editable-element');
      
      // Enable edit mode
      fireEvent.click(toggleButton);
      
      // Click editable element
      fireEvent.click(editableElement);
      
      await waitFor(() => {
        expect(screen.getByTestId('hex-color-picker')).toBeInTheDocument();
      });
      
      // Try to apply with error (should not throw)
      const confirmButton = screen.getByRole('button', { name: /conferma/i });
      expect(() => {
        fireEvent.click(confirmButton);
      }).not.toThrow();
    });
  });

  describe('Accessibility Integration', () => {
    it('should maintain accessibility throughout workflow', async () => {
      renderWithProvider(<TestIntegrationComponent />);
      
      const toggleButton = screen.getByRole('button', { name: /theme/i });
      const editableElement = screen.getByTestId('editable-element');
      
      // Enable edit mode
      fireEvent.click(toggleButton);
      
      // Click editable element
      fireEvent.click(editableElement);
      
      await waitFor(() => {
        // Check ARIA labels
        expect(screen.getByLabelText('Chiudi color picker')).toBeInTheDocument();
        expect(screen.getByLabelText('Colore esadecimale')).toBeInTheDocument();
        
        // Check button roles
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      });
    });
  });
}); 