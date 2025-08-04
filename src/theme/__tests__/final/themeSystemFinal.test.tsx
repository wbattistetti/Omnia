import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ThemeProvider } from '../../components/ThemeProvider';
import { ThemeToggle } from '../../components/ThemeToggle';
import SidebarHeader from '../../../components/Sidebar/SidebarHeader';

// ============================================================================
// TEST FINALE SISTEMA THEME COMPLETO
// ============================================================================

function TestThemeSystem() {
  return (
    <div data-testid="theme-system-test">
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

describe('Theme System Final Integration Test', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.classList.remove('theme-edit-mode');
  });

  const renderThemeSystem = () => {
    return render(
      <ThemeProvider>
        <TestThemeSystem />
      </ThemeProvider>
    );
  };

  describe('Complete Theme System Functionality', () => {
    it('should have all theme components working together', async () => {
      renderThemeSystem();
      
      expect(screen.getByText(/Tema DISATTIVO/)).toBeInTheDocument();
      expect(screen.getByText('Omnia')).toBeInTheDocument();
      expect(screen.getByText('Elemento Editabile di Test')).toBeInTheDocument();
    });

    it('should toggle theme mode correctly across all components', async () => {
      renderThemeSystem();
      
      const toggleButton = screen.getByText(/Tema DISATTIVO/);
      
      expect(toggleButton).toHaveTextContent('Tema DISATTIVO');
      expect(document.body.classList.contains('theme-edit-mode')).toBe(false);
      
      fireEvent.click(toggleButton);
      
      await waitFor(() => {
        expect(toggleButton).toHaveTextContent('Tema ATTIVO');
        expect(document.body.classList.contains('theme-edit-mode')).toBe(true);
      });
      
      fireEvent.click(toggleButton);
      
      await waitFor(() => {
        expect(toggleButton).toHaveTextContent('Tema DISATTIVO');
        expect(document.body.classList.contains('theme-edit-mode')).toBe(false);
      });
    });

    it('should maintain consistent state across all theme components', async () => {
      renderThemeSystem();
      
      const toggleButton = screen.getByText(/Tema DISATTIVO/);
      const sidebarHeader = screen.getByText('Omnia');
      const editableElement = screen.getByTestId('test-editable-element');
      
      expect(toggleButton).toHaveTextContent('Tema DISATTIVO');
      expect(sidebarHeader).toBeInTheDocument();
      expect(editableElement).toBeInTheDocument();
      
      fireEvent.click(toggleButton);
      
      await waitFor(() => {
        expect(toggleButton).toHaveTextContent('Tema ATTIVO');
        expect(sidebarHeader).toBeInTheDocument();
        expect(editableElement).toBeInTheDocument();
        expect(document.body.classList.contains('theme-edit-mode')).toBe(true);
      });
    });
  });

  describe('Error Resilience', () => {
    it('should handle rapid theme mode changes without errors', async () => {
      renderThemeSystem();
      
      const toggleButton = screen.getByText(/Tema DISATTIVO/);
      
      fireEvent.click(toggleButton); // ON
      fireEvent.click(toggleButton); // OFF
      fireEvent.click(toggleButton); // ON
      fireEvent.click(toggleButton); // OFF
      
      await waitFor(() => {
        expect(toggleButton).toHaveTextContent('Tema DISATTIVO');
        expect(document.body.classList.contains('theme-edit-mode')).toBe(false);
      });
    });

    it('should handle missing elements gracefully', () => {
      renderThemeSystem();
      
      const toggleButton = screen.getByText(/Tema DISATTIVO/);
      
      fireEvent.click(toggleButton);
      
      const nonExistentElement = document.querySelector('[data-theme-element="non-existent"]');
      expect(nonExistentElement).toBeNull();
      
      expect(toggleButton).toBeInTheDocument();
    });
  });
}); 