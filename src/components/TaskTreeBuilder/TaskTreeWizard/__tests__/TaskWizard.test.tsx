import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TaskWizard from '../TaskWizard';

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('TaskWizard', () => {
  const mockOnCancel = vi.fn();
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle AI response with subData correctly', async () => {
    // Mock successful AI response with subData
    const mockResponse = {
      ai: {
        type: 'date of birth',
        icon: 'Calendar',
        subData: ['day', 'month', 'year']
      }
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    render(<TaskWizard onCancel={mockOnCancel} onComplete={mockOnComplete} />);

    // Enter description and submit
    const input = screen.getByPlaceholderText('e.g., date of birth, email, phone number...');
    fireEvent.change(input, { target: { value: 'date of birth' } });
    fireEvent.click(screen.getByText('Invia'));

    // Wait for AI response and check confirmation step
    await waitFor(() => {
      expect(screen.getByText('Create a dialogue for:')).toBeInTheDocument();
      expect(screen.getByText('date of birth')).toBeInTheDocument();
      expect(screen.getByText('Structure: (day, month, year)')).toBeInTheDocument();
    });
  });

  it('should handle AI response without subData correctly', async () => {
    // Mock successful AI response without subData
    const mockResponse = {
      ai: {
        type: 'email',
        icon: 'Mail'
      }
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    render(<TaskWizard onCancel={mockOnCancel} onComplete={mockOnComplete} />);

    // Enter description and submit
    const input = screen.getByPlaceholderText('e.g., date of birth, email, phone number...');
    fireEvent.change(input, { target: { value: 'email' } });
    fireEvent.click(screen.getByText('Invia'));

    // Wait for AI response and check confirmation step
    await waitFor(() => {
      expect(screen.getByText('Create a dialogue for:')).toBeInTheDocument();
      expect(screen.getByText('email')).toBeInTheDocument();
      expect(screen.queryByText(/Structure:/)).not.toBeInTheDocument();
    });
  });

  it('should handle AI response with empty subData array', async () => {
    // Mock successful AI response with empty subData
    const mockResponse = {
      ai: {
        type: 'number',
        icon: 'Hash',
        subData: []
      }
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    render(<TaskWizard onCancel={mockOnCancel} onComplete={mockOnComplete} />);

    // Enter description and submit
    const input = screen.getByPlaceholderText('e.g., date of birth, email, phone number...');
    fireEvent.change(input, { target: { value: 'number' } });
    fireEvent.click(screen.getByText('Invia'));

    // Wait for AI response and check confirmation step
    await waitFor(() => {
      expect(screen.getByText('Create a dialogue for:')).toBeInTheDocument();
      expect(screen.getByText('number')).toBeInTheDocument();
      expect(screen.queryByText(/Structure:/)).not.toBeInTheDocument();
    });
  });

  it('should handle AI error gracefully', async () => {
    // Mock failed AI response
    mockFetch.mockResolvedValueOnce({
      ok: false
    });

    render(<TaskWizard onCancel={mockOnCancel} onComplete={mockOnComplete} />);

    // Enter description and submit
    const input = screen.getByPlaceholderText('e.g., date of birth, email, phone number...');
    fireEvent.change(input, { target: { value: 'invalid' } });
    fireEvent.click(screen.getByText('Invia'));

    // Wait for error step
    await waitFor(() => {
      expect(screen.getByText(/Errore IA/)).toBeInTheDocument();
    });
  });

  it('should show current data when returning to input step', async () => {
    // Mock successful AI response with subData
    const mockResponse = {
      ai: {
        type: 'date of birth',
        icon: 'Calendar',
        subData: ['day', 'month', 'year']
      }
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    render(<TaskWizard onCancel={mockOnCancel} onComplete={mockOnComplete} />);

    // Enter description and submit
    const input = screen.getByPlaceholderText('e.g., date of birth, email, phone number...');
    fireEvent.change(input, { target: { value: 'date of birth' } });
    fireEvent.click(screen.getByText('Invia'));

    // Wait for confirmation step and click Wrong
    await waitFor(() => {
      expect(screen.getByText('Create a dialogue for:')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Wrong'));

    // Check that we're back to input step with current data shown
    await waitFor(() => {
      expect(screen.getByText('date of birth')).toBeInTheDocument();
      expect(screen.getByText('Structure: (day, month, year)')).toBeInTheDocument();
    });
  });

  it('should call onCancel when cancel button is clicked', () => {
    render(<TaskWizard onCancel={mockOnCancel} onComplete={mockOnComplete} />);

    fireEvent.click(screen.getByText('Annulla'));

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });
});