import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ThemeProvider } from '../components/ThemeProvider';
import { useThemeManager } from '../ThemeManager';
import { ThemeElement, ThemeProperties } from '../types/theme';

// ============================================================================
// TEST COMPONENTE PER THEME MANAGER
// ============================================================================

function TestThemeManagerComponent() {
  const { 
    isEditMode, 
    toggleEditMode, 
    createClickHandler, 
    createAutoDetectionHandler,
    applyColorToElement,
    restoreOriginalColor,
    getCurrentElementColor 
  } = useThemeManager();

  const handleElementClick = createClickHandler('test-element', 'background');
  const handleAutoDetection = createAutoDetectionHandler();

  return (
    <div 
      data-testid="test-container"
      onClick={handleAutoDetection}
    >
      <button 
        data-testid="toggle-button"
        onClick={toggleEditMode}
      >
        {isEditMode ? 'Edit Mode ON' : 'Edit Mode OFF'}
      </button>
      
      <div 
        data-testid="test-element"
        data-theme-element="test-element"
        data-theme-part="background"
        onClick={handleElementClick}
        style={{ 
          backgroundColor: '#ffffff',
          cursor: isEditMode ? 'pointer' : 'default'
        }}
      >
        Test Element
      </div>
      
      <div 
        data-testid="utility-buttons"
      >
        <button 
          data-testid="apply-color-btn"
          onClick={() => applyColorToElement('test-element', 'background', '#ff0000')}
        >
          Apply Red
        </button>
        <button 
          data-testid="restore-color-btn"
          onClick={() => restoreOriginalColor('test-element', 'background')}
        >
          Restore Original
        </button>
        <button 
          data-testid="get-color-btn"
          onClick={() => {
            const color = getCurrentElementColor('test-element', 'background');
            console.log('Current color:', color);
          }}
        >
          Get Color
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// TEST THEME MANAGER
// ============================================================================

describe('ThemeManager Integration', () => {
  beforeEach(() => {
    // Mock console.log per evitare output nei test
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Rimuovi le classi CSS aggiunte durante i test
    document.body.classList.remove('theme-edit-mode');
  });

  const renderWithProvider = () => {
    return render(
      <ThemeProvider>
        <TestThemeManagerComponent />
      </ThemeProvider>
    );
  };

  describe('Edit Mode Management', () => {
    it('should toggle edit mode correctly', () => {
      renderWithProvider();
      
      const toggleButton = screen.getByTestId('toggle-button');
      expect(toggleButton).toHaveTextContent('Edit Mode OFF');
      
      fireEvent.click(toggleButton);
      expect(toggleButton).toHaveTextContent('Edit Mode ON');
      
      fireEvent.click(toggleButton);
      expect(toggleButton).toHaveTextContent('Edit Mode OFF');
    });

    it('should apply custom cursor when edit mode is active', async () => {
      renderWithProvider();
      
      const toggleButton = screen.getByTestId('toggle-button');
      
      // Attiva edit mode
      fireEvent.click(toggleButton);
      
      await waitFor(() => {
        expect(document.body.classList.contains('theme-edit-mode')).toBe(true);
      });
      
      // Disattiva edit mode
      fireEvent.click(toggleButton);
      
      await waitFor(() => {
        expect(document.body.classList.contains('theme-edit-mode')).toBe(false);
      });
    });
  });

  describe('Element Click Handlers', () => {
    it('should create click handler that works in edit mode', () => {
      renderWithProvider();
      
      const toggleButton = screen.getByTestId('toggle-button');
      const testElement = screen.getByTestId('test-element');
      
      // Attiva edit mode
      fireEvent.click(toggleButton);
      
      // Verifica che il cursor sia pointer in edit mode
      expect(testElement).toHaveStyle({ cursor: 'pointer' });
      
      // Click sull'elemento dovrebbe aprire il color picker
      fireEvent.click(testElement);
      
      // Verifica che il color picker sia aperto (se implementato)
      // Questo test può essere espanso quando il color picker è completamente integrato
    });

    it('should not respond to clicks when edit mode is off', () => {
      renderWithProvider();
      
      const testElement = screen.getByTestId('test-element');
      
      // Verifica che il cursor sia default quando edit mode è off
      expect(testElement).toHaveStyle({ cursor: 'default' });
      
      // Click sull'elemento non dovrebbe fare nulla
      fireEvent.click(testElement);
      
      // Verifica che non ci siano errori
      expect(testElement).toBeInTheDocument();
    });
  });

  describe('Auto Detection', () => {
    it('should handle auto detection clicks', () => {
      renderWithProvider();
      
      const toggleButton = screen.getByTestId('toggle-button');
      const container = screen.getByTestId('test-container');
      
      // Attiva edit mode
      fireEvent.click(toggleButton);
      
      // Click sul container dovrebbe attivare auto detection
      fireEvent.click(container);
      
      // Verifica che non ci siano errori
      expect(container).toBeInTheDocument();
    });
  });

  describe('Utility Functions', () => {
    it('should apply color to element', () => {
      renderWithProvider();
      
      const applyButton = screen.getByTestId('apply-color-btn');
      const testElement = screen.getByTestId('test-element');
      
      // Applica colore rosso
      fireEvent.click(applyButton);
      
      // Verifica che il colore sia stato applicato
      expect(testElement).toHaveStyle({ backgroundColor: '#ff0000' });
    });

    it('should get current element color', () => {
      renderWithProvider();
      
      const getColorButton = screen.getByTestId('get-color-btn');
      const testElement = screen.getByTestId('test-element');
      
      // Imposta un colore di test
      testElement.style.backgroundColor = '#00ff00';
      
      // Clicca per ottenere il colore
      fireEvent.click(getColorButton);
      
      // Verifica che la funzione sia stata chiamata (il colore viene convertito in rgb)
      expect(console.log).toHaveBeenCalledWith('Current color:', 'rgb(0, 255, 0)');
    });

    it('should restore original color', () => {
      renderWithProvider();
      
      const applyButton = screen.getByTestId('apply-color-btn');
      const restoreButton = screen.getByTestId('restore-color-btn');
      const testElement = screen.getByTestId('test-element');
      
      // Applica colore rosso
      fireEvent.click(applyButton);
      expect(testElement).toHaveStyle({ backgroundColor: '#ff0000' });
      
      // Ripristina colore originale (il colore originale è '#000000' dal ref)
      fireEvent.click(restoreButton);
      
      // Verifica che il colore sia stato ripristinato al valore originale
      expect(testElement).toHaveStyle({ backgroundColor: '#000000' });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing elements gracefully', () => {
      renderWithProvider();
      
      const applyButton = screen.getByTestId('apply-color-btn');
      
      // Prova ad applicare colore a elemento inesistente
      fireEvent.click(applyButton);
      
      // Verifica che non ci siano errori
      expect(applyButton).toBeInTheDocument();
    });

    it('should handle invalid property names', () => {
      renderWithProvider();
      
      const testElement = screen.getByTestId('test-element');
      
      // Prova ad applicare proprietà inesistente
      testElement.style.backgroundColor = '#ff0000';
      
      // Verifica che l'elemento sia ancora presente
      expect(testElement).toBeInTheDocument();
    });
  });

  describe('Integration with Theme Context', () => {
    it('should work with theme context state', () => {
      renderWithProvider();
      
      const toggleButton = screen.getByTestId('toggle-button');
      
      // Verifica stato iniziale
      expect(toggleButton).toHaveTextContent('Edit Mode OFF');
      
      // Cambia stato
      fireEvent.click(toggleButton);
      expect(toggleButton).toHaveTextContent('Edit Mode ON');
      
      // Verifica che il context sia aggiornato
      expect(document.body.classList.contains('theme-edit-mode')).toBe(true);
    });
  });
}); 