import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import TaskWizard from '../TaskTreeWizard/TaskWizard';

// Mock the orchestrator hook
vi.mock('../orchestrator/useDDTOrchestrator', () => ({
  default: () => ({
    state: {
      currentStepIndex: 0,
      steps: [
        { key: 'detectType', label: 'Detecting data type...' },
        { key: 'suggestStructureAndConstraints', label: 'Suggesting structure...' },
        { key: 'startPrompt', label: 'Generating start prompt...' }
      ],
      stepResults: [],
      stepError: false,
      stepLoading: false
    },
    step: 'structure',
    error: null,
      finalTaskTree: null,
    messages: {},
    start: vi.fn(),
    retry: vi.fn()
  })
}));

describe('DDT Builder Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render Task Wizard without crashing', () => {
    render(<TaskWizard />);

    // Verify that the wizard renders without errors
    expect(screen.getByText(/Creazione DDT/i)).toBeInTheDocument();
    expect(screen.getByText(/Sto generando la struttura del template/i)).toBeInTheDocument();
  });

  it('should show input field in structure step', () => {
    render(<TaskWizard />);

    // Verify that input field is present
    expect(screen.getByPlaceholderText(/Che tipo di dato vuoi acquisire/i)).toBeInTheDocument();
    expect(screen.getByText(/Crea DDT/i)).toBeInTheDocument();
  });
});