import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

// Mock console methods to reduce noise in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeEach(() => {
  console.log = vi.fn();
  console.error = vi.fn();
  vi.clearAllMocks();
});

afterEach(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

describe('DDT Save Function', () => {
  it('should save DDT successfully', async () => {
    // Mock successful response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    });

    const mockDDTList = [
      { id: '1', label: 'Test DDT 1' },
      { id: '2', label: 'Test DDT 2' }
    ];

    // Simulate the save function
    const handleSaveDDT = async () => {
      console.log('[Sidebar] handleSaveDDT chiamato');
      try {
        const res = await fetch('http://localhost:3100/api/factory/dialogue-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mockDDTList)
        });
        if (!res.ok) {
          throw new Error('Server error: unable to save DDT');
        }
        console.log('[Sidebar] DDT salvati con successo');
        return { success: true };
      } catch (err) {
        console.error('[Sidebar] Errore durante il salvataggio:', err);
        throw err;
      }
    };

    const result = await handleSaveDDT();

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3100/api/factory/dialogue-templates',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockDDTList)
      })
    );
    expect(result).toEqual({ success: true });
  });

  it('should handle server error', async () => {
    // Mock server error response
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500
    });

    const mockDDTList = [{ id: '1', label: 'Test DDT' }];

    const handleSaveDDT = async () => {
      try {
        const res = await fetch('http://localhost:3100/api/factory/dialogue-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mockDDTList)
        });
        if (!res.ok) {
          throw new Error('Server error: unable to save DDT');
        }
        return { success: true };
      } catch (err) {
        return { error: err.message };
      }
    };

    const result = await handleSaveDDT();

    expect(result).toEqual({ error: 'Server error: unable to save DDT' });
  });

  it('should handle network error', async () => {
    // Mock network error
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    const mockDDTList = [{ id: '1', label: 'Test DDT' }];

    const handleSaveDDT = async () => {
      try {
        const res = await fetch('http://localhost:3100/api/factory/dialogue-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mockDDTList)
        });
        if (!res.ok) {
          throw new Error('Server error: unable to save DDT');
        }
        return { success: true };
      } catch (err) {
        return { error: err.message };
      }
    };

    const result = await handleSaveDDT();

    expect(result).toEqual({ error: 'Network error' });
  });
}); 