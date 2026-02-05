import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskWizard from '../TaskTreeWizard/TaskWizard';

// Mock fetch per simulare le risposte del backend
const mockFetch = vi.fn();

describe('DDT Builder SubData Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  it('should generate subData prompts when creating a date field', async () => {
    const user = userEvent.setup();

    // Mock delle risposte del backend
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ai: 'date' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ai: {
            name: 'birthDate',
            type: 'date',
            subData: [
              { name: 'day', type: 'number', constraints: ['range'] },
              { name: 'month', type: 'number', constraints: ['range'] },
              { name: 'year', type: 'number', constraints: ['range'] }
            ]
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ai: ['What is your birth date?'] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ai: {
            start: ['What day were you born?'],
            noMatch: ['Please enter a valid day between 1 and 31.']
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ai: {
            start: ['What month were you born?'],
            noMatch: ['Please enter a valid month between 1 and 12.']
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ai: {
            start: ['What year were you born?'],
            noMatch: ['Please enter a valid year.']
          }
        })
      });

    render(<TaskTreeWizard />);

    // Verifica che il wizard sia renderizzato
    expect(screen.getByText(/Creazione DDT/i)).toBeInTheDocument();

    // Inserisci il tipo di dato
    const input = screen.getByPlaceholderText(/Che tipo di dato vuoi acquisire/i);
    await user.type(input, 'data di nascita');

    // Clicca su Crea DDT
    const createButton = screen.getByText(/Crea DDT/i);
    await user.click(createButton);

    // Verifica che il processo sia iniziato
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/detectType',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });

    // Verifica che siano state chiamate le API per i subData
    await waitFor(() => {
      // Verifica chiamata per day
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/generateSubDataMessages',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"name":"day"')
        })
      );

      // Verifica chiamata per month
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/generateSubDataMessages',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"name":"month"')
        })
      );

      // Verifica chiamata per year
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/generateSubDataMessages',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"name":"year"')
        })
      );
    });

    // Verifica che siano state chiamate le API per gli script
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/generateSubDataScripts',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"name":"day"')
        })
      );
    });
  });

  it('should handle errors gracefully when subData generation fails', async () => {
    const user = userEvent.setup();

    // Mock di un errore durante la generazione dei subData
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ai: 'date' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ai: {
            name: 'birthDate',
            type: 'date',
            subData: [
              { name: 'day', type: 'number', constraints: ['range'] }
            ]
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ai: ['What is your birth date?'] })
      })
      .mockRejectedValueOnce(new Error('Network error')); // Errore per subData

    render(<TaskTreeWizard />);

    const input = screen.getByPlaceholderText(/Che tipo di dato vuoi acquisire/i);
    await user.type(input, 'data di nascita');

    const createButton = screen.getByText(/Crea DDT/i);
    await user.click(createButton);

    // Verifica che l'errore sia gestito correttamente
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/generateSubDataMessages',
        expect.any(Object)
      );
    });
  });
});