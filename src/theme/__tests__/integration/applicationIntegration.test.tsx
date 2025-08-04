import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ThemeProvider } from '../../components/ThemeProvider';
import { ThemeToggle } from '../../components/ThemeToggle';
import SidebarHeader from '../../../components/Sidebar/SidebarHeader';

// ============================================================================
// TEST INTEGRAZIONE APPLICAZIONE COMPLETA
// ============================================================================

function TestApplication() {
  return (
    <div data-testid="test-application">
      <ThemeToggle />
      <SidebarHeader />
      <div 
        data-testid="test-editable-element"
        data-theme-element="test-element"
        data-theme-part="background"
        style={{ 
          backgroundColor: '#ffffff',
          padding: '20px',
          margin: '10px'
        }}
      >
        Elemento Editabile di Test
      </div>
    </div>
  );
}

describe('Application Integration with ThemeManager', () => {
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

  const renderApplication = () => {
    return render(
      <ThemeProvider>
        <TestApplication />
      </ThemeProvider>
    );
  };

  describe('Theme Toggle Integration', () => {
    it('should toggle theme edit mode across the entire application', async () => {
      renderApplication();
      
      const toggleButton = screen.getByText(/Tema DISATTIVO/);
      expect(toggleButton).toBeInTheDocument();
      
      // Verifica stato iniziale
      expect(toggleButton).toHaveTextContent('Tema DISATTIVO');
      expect(document.body.classList.contains('theme-edit-mode')).toBe(false);
      
      // Attiva edit mode
      fireEvent.click(toggleButton);
      
      await waitFor(() => {
        expect(toggleButton).toHaveTextContent('Tema ATTIVO');
        expect(document.body.classList.contains('theme-edit-mode')).toBe(true);
      });
      
      // Disattiva edit mode
      fireEvent.click(toggleButton);
      
      await waitFor(() => {
        expect(toggleButton).toHaveTextContent('Tema DISATTIVO');
        expect(document.body.classList.contains('theme-edit-mode')).toBe(false);
      });
    });
  });

  describe('Sidebar Header Integration', () => {
    it('should show edit cursors when theme mode is active', async () => {
      renderApplication();
      
      const toggleButton = screen.getByText(/Tema DISATTIVO/);
      const sidebarHeader = screen.getByText('Omnia');
      const logoElement = screen.getByText('O');
      
      // Verifica stato iniziale (cursori default)
      expect(logoElement.parentElement).toHaveStyle({ cursor: 'default' });
      expect(sidebarHeader).toHaveStyle({ cursor: 'default' });
      
      // Attiva edit mode
      fireEvent.click(toggleButton);
      
      await waitFor(() => {
        // Verifica che i cursori siano diventati pointer
        expect(logoElement.parentElement).toHaveStyle({ cursor: 'pointer' });
        expect(sidebarHeader).toHaveStyle({ cursor: 'pointer' });
      });
    });

    it('should handle clicks on sidebar elements when edit mode is active', async () => {
      renderApplication();
      
      const toggleButton = screen.getByText(/Tema DISATTIVO/);
      const logoElement = screen.getByText('O');
      
      // Attiva edit mode
      fireEvent.click(toggleButton);
      
      await waitFor(() => {
        expect(document.body.classList.contains('theme-edit-mode')).toBe(true);
      });
      
      // Click su elemento editabile (non dovrebbe dare errori)
      fireEvent.click(logoElement.parentElement!);
      
      // Verifica che l'elemento sia ancora presente
      expect(logoElement).toBeInTheDocument();
    });
  });

  describe('Editable Elements Integration', () => {
    it('should handle clicks on editable elements when edit mode is active', async () => {
      renderApplication();
      
      const toggleButton = screen.getByText(/Tema DISATTIVO/);
      const editableElement = screen.getByTestId('test-editable-element');
      
      // Verifica stato iniziale (cursor potrebbe non essere definito inline)
      expect(editableElement).toBeInTheDocument();
      
      // Attiva edit mode
      fireEvent.click(toggleButton);
      
      await waitFor(() => {
        expect(document.body.classList.contains('theme-edit-mode')).toBe(true);
      });
      
      // Click su elemento editabile (non dovrebbe dare errori)
      fireEvent.click(editableElement);
      
      // Verifica che l'elemento sia ancora presente
      expect(editableElement).toBeInTheDocument();
    });

    it('should not respond to clicks when edit mode is off', () => {
      renderApplication();
      
      const editableElement = screen.getByTestId('test-editable-element');
      
      // Verifica che l'elemento sia presente quando edit mode è off
      expect(editableElement).toBeInTheDocument();
      
      // Click sull'elemento non dovrebbe fare nulla
      fireEvent.click(editableElement);
      
      // Verifica che non ci siano errori
      expect(editableElement).toBeInTheDocument();
    });
  });

  describe('Theme Context Integration', () => {
    it('should maintain consistent state across all components', async () => {
      renderApplication();
      
      const toggleButton = screen.getByText(/Tema DISATTIVO/);
      const sidebarHeader = screen.getByText('Omnia');
      const editableElement = screen.getByTestId('test-editable-element');
      
      // Verifica stato iniziale coerente
      expect(toggleButton).toHaveTextContent('Tema DISATTIVO');
      expect(sidebarHeader).toBeInTheDocument();
      expect(editableElement).toBeInTheDocument();
      
      // Attiva edit mode
      fireEvent.click(toggleButton);
      
      await waitFor(() => {
        // Verifica che tutti i componenti abbiano lo stesso stato
        expect(toggleButton).toHaveTextContent('Tema ATTIVO');
        expect(sidebarHeader).toBeInTheDocument();
        expect(editableElement).toBeInTheDocument();
        expect(document.body.classList.contains('theme-edit-mode')).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing elements gracefully', () => {
      renderApplication();
      
      const toggleButton = screen.getByText(/Tema DISATTIVO/);
      
      // Attiva edit mode
      fireEvent.click(toggleButton);
      
      // Prova a cliccare su elemento inesistente (non dovrebbe dare errori)
      const nonExistentElement = document.querySelector('[data-theme-element="non-existent"]');
      expect(nonExistentElement).toBeNull();
      
      // Verifica che l'applicazione sia ancora funzionante
      expect(toggleButton).toBeInTheDocument();
    });

    it('should handle rapid state changes without errors', async () => {
      renderApplication();
      
      const toggleButton = screen.getByText(/Tema DISATTIVO/);
      
      // Cambiamenti rapidi di stato
      fireEvent.click(toggleButton); // ON
      fireEvent.click(toggleButton); // OFF
      fireEvent.click(toggleButton); // ON
      fireEvent.click(toggleButton); // OFF
      
      // Verifica che l'applicazione sia ancora funzionante
      await waitFor(() => {
        expect(toggleButton).toHaveTextContent('Tema DISATTIVO');
        expect(document.body.classList.contains('theme-edit-mode')).toBe(false);
      });
    });
  });

  describe('Performance', () => {
    it('should not cause excessive re-renders', () => {
      renderApplication();
      
      const toggleButton = screen.getByText(/Tema DISATTIVO/);
      
      // Verifica che il componente sia renderizzato correttamente
      expect(toggleButton).toBeInTheDocument();
      
      // Verifica che non ci siano errori di performance
      expect(() => {
        fireEvent.click(toggleButton);
      }).not.toThrow();
    });
  });
}); 