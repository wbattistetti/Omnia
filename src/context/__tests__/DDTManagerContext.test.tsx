import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DDTManagerProvider, useDDTManager } from '../DDTManagerContext';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Test component to access context
const TestComponent = () => {
  const { 
    ddtList, 
    selectedDDT, 
    createDDT, 
    openDDT, 
    closeDDT, 
    deleteDDT,
    isLoadingDDT,
    loadDDTError 
  } = useDDTManager();

  return (
    <div>
      <div data-testid="ddt-count">{ddtList.length}</div>
      <div data-testid="selected-ddt">{selectedDDT?.label || 'none'}</div>
      <div data-testid="loading">{isLoadingDDT.toString()}</div>
      <div data-testid="error">{loadDDTError || 'none'}</div>
      <button onClick={() => createDDT({ id: 'test1', label: 'Test DDT 1' })}>
        Create DDT
      </button>
      <button onClick={() => openDDT({ id: 'test2', label: 'Test DDT 2' })}>
        Open DDT
      </button>
      <button onClick={closeDDT}>Close DDT</button>
      <button onClick={() => deleteDDT('test1')}>Delete DDT</button>
    </div>
  );
};

describe('DDTManagerContext', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial fetch', () => {
    it('should load DDT templates on mount', async () => {
      const mockDDTs = [
        { id: '1', label: 'DDT 1' },
        { id: '2', label: 'DDT 2' }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDDTs
      });

      render(
        <DDTManagerProvider>
          <TestComponent />
        </DDTManagerProvider>
      );

      // Should show loading initially
      expect(screen.getByTestId('loading')).toHaveTextContent('true');

      // Should call fetch with correct URL
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3100/api/factory/dialogue-templates'
      );

      // Should load DDTs and stop loading
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      expect(screen.getByTestId('ddt-count')).toHaveTextContent('2');
      expect(screen.getByTestId('error')).toHaveTextContent('none');
    });

    it('should handle server error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      render(
        <DDTManagerProvider>
          <TestComponent />
        </DDTManagerProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      expect(screen.getByTestId('ddt-count')).toHaveTextContent('0');
      expect(screen.getByTestId('error')).toHaveTextContent('Server error: 500');
    });

    it('should handle network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(
        <DDTManagerProvider>
          <TestComponent />
        </DDTManagerProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      expect(screen.getByTestId('ddt-count')).toHaveTextContent('0');
      expect(screen.getByTestId('error')).toHaveTextContent('Network error');
    });

    it('should handle non-array response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ notAnArray: true })
      });

      render(
        <DDTManagerProvider>
          <TestComponent />
        </DDTManagerProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      expect(screen.getByTestId('ddt-count')).toHaveTextContent('0');
      expect(screen.getByTestId('error')).toHaveTextContent('none');
    });
  });

  describe('CRUD operations', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => []
      });
    });

    it('should create DDT', async () => {
      render(
        <DDTManagerProvider>
          <TestComponent />
        </DDTManagerProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      act(() => {
        screen.getByText('Create DDT').click();
      });

      expect(screen.getByTestId('ddt-count')).toHaveTextContent('1');
      expect(screen.getByTestId('selected-ddt')).toHaveTextContent('Test DDT 1');
    });

    it('should open DDT', async () => {
      render(
        <DDTManagerProvider>
          <TestComponent />
        </DDTManagerProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      act(() => {
        screen.getByText('Open DDT').click();
      });

      expect(screen.getByTestId('selected-ddt')).toHaveTextContent('Test DDT 2');
    });

    it('should close DDT', async () => {
      render(
        <DDTManagerProvider>
          <TestComponent />
        </DDTManagerProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      // First open a DDT
      act(() => {
        screen.getByText('Open DDT').click();
      });

      expect(screen.getByTestId('selected-ddt')).toHaveTextContent('Test DDT 2');

      // Then close it
      act(() => {
        screen.getByText('Close DDT').click();
      });

      expect(screen.getByTestId('selected-ddt')).toHaveTextContent('none');
    });

    it('should delete DDT', async () => {
      render(
        <DDTManagerProvider>
          <TestComponent />
        </DDTManagerProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      // First create a DDT
      act(() => {
        screen.getByText('Create DDT').click();
      });

      expect(screen.getByTestId('ddt-count')).toHaveTextContent('1');

      // Then delete it
      act(() => {
        screen.getByText('Delete DDT').click();
      });

      expect(screen.getByTestId('ddt-count')).toHaveTextContent('0');
      expect(screen.getByTestId('selected-ddt')).toHaveTextContent('none');
    });

    it('should close editor when deleting selected DDT', async () => {
      render(
        <DDTManagerProvider>
          <TestComponent />
        </DDTManagerProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      // Create and select a DDT
      act(() => {
        screen.getByText('Create DDT').click();
      });

      expect(screen.getByTestId('selected-ddt')).toHaveTextContent('Test DDT 1');

      // Delete the selected DDT
      act(() => {
        screen.getByText('Delete DDT').click();
      });

      expect(screen.getByTestId('selected-ddt')).toHaveTextContent('none');
    });
  });

  describe('Context error handling', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useDDTManager must be used within a DDTManagerProvider');

      consoleSpy.mockRestore();
    });
  });
}); 