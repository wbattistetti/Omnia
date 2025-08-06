import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import WizardPipelineStep from '../WizardPipelineStep';

// Mock semplificato dell'orchestrator
vi.mock('../../orchestrator/useOrchestrator', () => ({
  useOrchestrator: vi.fn(() => ({
    state: {
      currentStepIndex: 0,
      steps: [
        { label: 'Step 1', stepKey: 'step1' },
        { label: 'Step 2', stepKey: 'step2' },
        { label: 'Step 3', stepKey: 'step3' }
      ],
      stepResults: []
    },
    runNextStep: vi.fn(),
    debugModal: false,
    closeDebugModalAndContinue: vi.fn()
  }))
}));

// Mock degli altri moduli
vi.mock('../../DDTAssembler/DDTBuilder', () => ({
  buildDDT: vi.fn()
}));

vi.mock('../../DDTAssembler/buildStepMessagesFromResults', () => ({
  buildSteps: vi.fn()
}));

vi.mock('../../orchestrator/stepGenerator', () => ({
  generateStepsSkipDetectType: vi.fn()
}));

vi.mock('../../utils/stepCalculator', () => ({
  calculateTotalSteps: vi.fn(() => 20), // 5 × (1 + 3) = 20
  getStepDescription: vi.fn(() => 'Detecting data type for date of birth')
}));

vi.mock('../DataTypeLabel', () => ({
  default: ({ label }: { label: string }) => <div data-testid="data-type-label">{label}</div>
}));

vi.mock('../StepLabel', () => ({
  default: ({ label }: { label: string }) => <div data-testid="step-label">{label}</div>
}));

vi.mock('../HourglassSpinner', () => ({
  default: () => <div data-testid="hourglass-spinner">⏳</div>
}));

vi.mock('../../../Common/ProgressBar', () => ({
  default: ({ currentStep, totalSteps, label }: { currentStep: number; totalSteps: number; label: string }) => (
    <div data-testid="progress-bar">
      <span data-testid="progress-label">{label}</span>
      <span data-testid="progress-steps">{currentStep} / {totalSteps}</span>
    </div>
  )
}));

describe('WizardPipelineStep', () => {
  const defaultProps = {
    dataNode: { name: 'date of birth', subData: ['day', 'month', 'year'] },
    detectTypeIcon: 'Calendar',
    onCancel: vi.fn(),
    onComplete: vi.fn(),
    skipDetectType: false,
    confirmedLabel: undefined
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with progress bar and step information', () => {
    render(<WizardPipelineStep {...defaultProps} />);

    expect(screen.getByText('Creating...')).toBeInTheDocument();
    expect(screen.getByTestId('data-type-label')).toHaveTextContent('date of birth');
    expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
    expect(screen.getByTestId('progress-label')).toHaveTextContent('Building your dialogue template');
    expect(screen.getByTestId('progress-steps')).toHaveTextContent('1 / 20');
    expect(screen.getByText('Current step: Detecting data type for date of birth')).toBeInTheDocument();
  });

  it('should show hourglass spinner and step label', () => {
    render(<WizardPipelineStep {...defaultProps} />);

    expect(screen.getByTestId('hourglass-spinner')).toBeInTheDocument();
    expect(screen.getByTestId('step-label')).toBeInTheDocument();
  });

  it('should display Calendar icon when detectTypeIcon is Calendar', () => {
    render(<WizardPipelineStep {...defaultProps} detectTypeIcon="Calendar" />);

    expect(screen.getByTestId('data-type-label')).toBeInTheDocument();
  });

  it('should not display Calendar icon when detectTypeIcon is not Calendar', () => {
    render(<WizardPipelineStep {...defaultProps} detectTypeIcon="Mail" />);

    expect(screen.getByTestId('data-type-label')).toBeInTheDocument();
  });
}); 