import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ColorPicker } from '../../components/ColorPicker';
import { ThemeProvider } from '../../context/ThemeContext';
import { Position } from '../../types/theme';

// ============================================================================
// MOCK REACT-COLORFUL
// ============================================================================

vi.mock('react-colorful', () => ({
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
// TEST COLOR PICKER
// ============================================================================

describe('ColorPicker', () => {
  const defaultProps = {
    isOpen: true,
    position: { x: 100, y: 200 } as Position,
    elementId: 'test-element',
    property: 'background',
    initialColor: '#ffffff'
  };

  const renderWithProvider = (props = defaultProps) => {
    return render(
      <ThemeProvider>
        <ColorPicker {...props} />
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
    vi.spyOn(document, 'querySelector').mockReturnValue(mockElement as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render when isOpen is true', () => {
      renderWithProvider();
      
      expect(screen.getByTestId('hex-color-picker')).toBeInTheDocument();
      expect(screen.getByTestId('hex-color-input')).toBeInTheDocument();
      expect(screen.getByText('Conferma')).toBeInTheDocument();
      expect(screen.getByText('Annulla')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      renderWithProvider({ ...defaultProps, isOpen: false });
      
      expect(screen.queryByTestId('hex-color-picker')).not.toBeInTheDocument();
      expect(screen.queryByTestId('hex-color-input')).not.toBeInTheDocument();
    });

    it('should display element and property information', () => {
      renderWithProvider();
      
      expect(screen.getByText('test-element - background')).toBeInTheDocument();
    });

    it('should render close button', () => {
      renderWithProvider();
      
      const closeButton = screen.getByRole('button', { name: /chiudi color picker/i });
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveTextContent('✕');
    });

    it('should render action buttons', () => {
      renderWithProvider();
      
      const confirmButton = screen.getByRole('button', { name: /conferma/i });
      const cancelButton = screen.getByRole('button', { name: /annulla/i });
      
      expect(confirmButton).toBeInTheDocument();
      expect(cancelButton).toBeInTheDocument();
      expect(confirmButton).toHaveTextContent('✓');
    });
  });

  describe('Color Display', () => {
    it('should show color preview', () => {
      renderWithProvider();
      
      const colorPreview = screen.getByTestId('hex-color-input');
      expect(colorPreview).toBeInTheDocument();
    });

    it('should initialize with initial color', () => {
      renderWithProvider({ ...defaultProps, initialColor: '#ff0000' });
      
      const colorInput = screen.getByTestId('hex-color-input');
      expect(colorInput).toHaveValue('#ff0000');
    });
  });

  describe('Color Picker Interaction', () => {
    it('should update color when picker changes', () => {
      renderWithProvider();
      
      const pickerInput = screen.getByTestId('color-picker-input');
      fireEvent.change(pickerInput, { target: { value: '#00ff00' } });
      
      expect(pickerInput).toHaveValue('#00ff00');
    });

    it('should update color when hex input changes', () => {
      renderWithProvider();
      
      const hexInput = screen.getByTestId('hex-color-input');
      fireEvent.change(hexInput, { target: { value: '#0000ff' } });
      
      expect(hexInput).toHaveValue('#0000ff');
    });
  });

  describe('Button Actions', () => {
    it('should call closeColorPicker when close button is clicked', () => {
      const mockCloseColorPicker = vi.fn();
      vi.spyOn(require('../../context/ThemeContext'), 'useThemeContext').mockReturnValue({
        state: {
          isColorPickerOpen: true,
          activeElement: { id: 'test', type: 'component', name: 'Test', properties: {}, selector: '', editableProperties: [] },
          activeProperty: 'background',
          pickerPosition: { x: 100, y: 200 },
          currentColor: '#ffffff',
          originalColor: '#ffffff'
        },
        actions: {
          closeColorPicker: mockCloseColorPicker,
          applyColorChange: vi.fn(),
          updateCurrentColor: vi.fn()
        }
      });

      renderWithProvider();
      
      const closeButton = screen.getByRole('button', { name: /chiudi color picker/i });
      fireEvent.click(closeButton);
      
      expect(mockCloseColorPicker).toHaveBeenCalled();
    });

    it('should call applyColorChange when confirm button is clicked', () => {
      const mockApplyColorChange = vi.fn();
      vi.spyOn(require('../../context/ThemeContext'), 'useThemeContext').mockReturnValue({
        state: {
          isColorPickerOpen: true,
          activeElement: { id: 'test', type: 'component', name: 'Test', properties: {}, selector: '', editableProperties: [] },
          activeProperty: 'background',
          pickerPosition: { x: 100, y: 200 },
          currentColor: '#ffffff',
          originalColor: '#ffffff'
        },
        actions: {
          closeColorPicker: vi.fn(),
          applyColorChange: mockApplyColorChange,
          updateCurrentColor: vi.fn()
        }
      });

      renderWithProvider();
      
      const confirmButton = screen.getByRole('button', { name: /conferma/i });
      fireEvent.click(confirmButton);
      
      expect(mockApplyColorChange).toHaveBeenCalledWith('test-element', 'background', '#ffffff');
    });

    it('should call closeColorPicker when cancel button is clicked', () => {
      const mockCloseColorPicker = vi.fn();
      vi.spyOn(require('../../context/ThemeContext'), 'useThemeContext').mockReturnValue({
        state: {
          isColorPickerOpen: true,
          activeElement: { id: 'test', type: 'component', name: 'Test', properties: {}, selector: '', editableProperties: [] },
          activeProperty: 'background',
          pickerPosition: { x: 100, y: 200 },
          currentColor: '#ffffff',
          originalColor: '#ffffff'
        },
        actions: {
          closeColorPicker: mockCloseColorPicker,
          applyColorChange: vi.fn(),
          updateCurrentColor: vi.fn()
        }
      });

      renderWithProvider();
      
      const cancelButton = screen.getByRole('button', { name: /annulla/i });
      fireEvent.click(cancelButton);
      
      expect(mockCloseColorPicker).toHaveBeenCalled();
    });
  });

  describe('Positioning', () => {
    it('should position picker at specified coordinates', () => {
      renderWithProvider();
      
      const pickerContainer = screen.getByTestId('hex-color-picker').closest('[style*="left"]');
      expect(pickerContainer).toHaveStyle({
        left: '100px',
        top: '200px'
      });
    });

    it('should handle different positions', () => {
      renderWithProvider({ ...defaultProps, position: { x: 300, y: 400 } });
      
      const pickerContainer = screen.getByTestId('hex-color-picker').closest('div');
      expect(pickerContainer).toHaveStyle({
        left: '300px',
        top: '400px'
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderWithProvider();
      
      expect(screen.getByLabelText('Chiudi color picker')).toBeInTheDocument();
      expect(screen.getByLabelText('Colore esadecimale')).toBeInTheDocument();
    });

    it('should have proper button roles', () => {
      renderWithProvider();
      
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(3); // Close, Confirm, Cancel
    });
  });

  describe('Data Attributes', () => {
    it('should have data-theme-ignore attributes', () => {
      renderWithProvider();
      
      const closeButton = screen.getByRole('button', { name: /chiudi color picker/i });
      const hexInput = screen.getByTestId('hex-color-input');
      const confirmButton = screen.getByRole('button', { name: /conferma/i });
      const cancelButton = screen.getByRole('button', { name: /annulla/i });
      
      expect(closeButton).toHaveAttribute('data-theme-ignore', 'true');
      expect(hexInput).toHaveAttribute('data-theme-ignore', 'true');
      expect(confirmButton).toHaveAttribute('data-theme-ignore', 'true');
      expect(cancelButton).toHaveAttribute('data-theme-ignore', 'true');
    });
  });

  describe('Error Handling', () => {
         it('should handle missing DOM element gracefully', () => {
       vi.spyOn(document, 'querySelector').mockReturnValue(null);
       
       expect(() => {
         renderWithProvider();
       }).not.toThrow();
     });

         it('should handle action errors gracefully', () => {
       const mockActions = {
         closeColorPicker: vi.fn().mockImplementation(() => {
           throw new Error('Test error');
         }),
         applyColorChange: vi.fn(),
         updateCurrentColor: vi.fn()
       };

       vi.spyOn(require('../../context/ThemeContext'), 'useThemeContext').mockReturnValue({
         state: {
           isColorPickerOpen: true,
           activeElement: { id: 'test', type: 'component', name: 'Test', properties: {}, selector: '', editableProperties: [] },
           activeProperty: 'background',
           pickerPosition: { x: 100, y: 200 },
           currentColor: '#ffffff',
           originalColor: '#ffffff'
         },
         actions: mockActions
       });

      renderWithProvider();
      
      const closeButton = screen.getByRole('button', { name: /chiudi color picker/i });
      
      expect(() => {
        fireEvent.click(closeButton);
      }).not.toThrow();
    });
  });

  describe('Integration with Theme Context', () => {
         it('should use context actions correctly', () => {
       const mockActions = {
         closeColorPicker: vi.fn(),
         applyColorChange: vi.fn(),
         updateCurrentColor: vi.fn()
       };

       vi.spyOn(require('../../context/ThemeContext'), 'useThemeContext').mockReturnValue({
         state: {
           isColorPickerOpen: true,
           activeElement: { id: 'test', type: 'component', name: 'Test', properties: {}, selector: '', editableProperties: [] },
           activeProperty: 'background',
           pickerPosition: { x: 100, y: 200 },
           currentColor: '#ffffff',
           originalColor: '#ffffff'
         },
         actions: mockActions
       });

      renderWithProvider();
      
      // Test color change
      const hexInput = screen.getByTestId('hex-color-input');
      fireEvent.change(hexInput, { target: { value: '#ff0000' } });
      
      expect(mockActions.updateCurrentColor).toHaveBeenCalledWith('#ff0000');
    });
  });
}); 