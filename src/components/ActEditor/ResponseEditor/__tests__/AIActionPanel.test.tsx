import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import AIActionPanel from '../AIActionPanel';

// Mock dei componenti esterni
vi.mock('../../SmartTooltip', () => ({
  default: ({ children, text }: any) => <div data-testid="smart-tooltip">{text}{children}</div>
}));

vi.mock('../../TooltipWrapper', () => ({
  TooltipWrapper: ({ children, tooltip }: any) => (
    <div data-testid="tooltip-wrapper">
      {tooltip}
      {children({ show: false, triggerProps: {} })}
    </div>
  )
}));

describe('AIActionPanel', () => {
  const mockProps = {
    currentMessage: 'Please enter your birth date',
    stepType: 'start',
    onGenerate: vi.fn(),
    onClose: vi.fn(),
    isGenerating: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with all elements', () => {
    render(<AIActionPanel {...mockProps} />);
    
    expect(screen.getByText('AI Message Refinement')).toBeInTheDocument();
    expect(screen.getByText('Current message:')).toBeInTheDocument();
    expect(screen.getByText('Please enter your birth date')).toBeInTheDocument();
    expect(screen.getByText('Example message style:')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/E.g., Please tell me your birth year/)).toBeInTheDocument();
    expect(screen.getByText(/Apply to all/)).toBeInTheDocument();
    expect(screen.getByText('Generate')).toBeInTheDocument();
  });

  it('shows current message in preview', () => {
    render(<AIActionPanel {...mockProps} />);
    
    expect(screen.getByText('Please enter your birth date')).toBeInTheDocument();
  });

  it('handles example message input', () => {
    render(<AIActionPanel {...mockProps} />);
    
    const textarea = screen.getByPlaceholderText(/E.g., Please tell me your birth year/);
    fireEvent.change(textarea, { target: { value: 'New example message' } });
    
    expect(textarea).toHaveValue('New example message');
  });

  it('handles apply to all checkbox', () => {
    render(<AIActionPanel {...mockProps} />);
    
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it('calls onGenerate when Generate button is clicked with valid input', () => {
    render(<AIActionPanel {...mockProps} />);
    
    const textarea = screen.getByPlaceholderText(/E.g., Please tell me your birth year/);
    const generateButton = screen.getByText('Generate');
    
    // Initially button should be disabled
    expect(generateButton).toBeDisabled();
    
    // Add example message
    fireEvent.change(textarea, { target: { value: 'New example message' } });
    
    // Now button should be enabled
    expect(generateButton).not.toBeDisabled();
    
    // Click generate
    fireEvent.click(generateButton);
    
    expect(mockProps.onGenerate).toHaveBeenCalledWith('New example message', false);
  });

  it('calls onGenerate with applyToAll=true when checkbox is checked', () => {
    render(<AIActionPanel {...mockProps} />);
    
    const textarea = screen.getByPlaceholderText(/E.g., Please tell me your birth year/);
    const checkbox = screen.getByRole('checkbox');
    const generateButton = screen.getByText('Generate');
    
    // Add example message and check apply to all
    fireEvent.change(textarea, { target: { value: 'New example message' } });
    fireEvent.click(checkbox);
    fireEvent.click(generateButton);
    
    expect(mockProps.onGenerate).toHaveBeenCalledWith('New example message', true);
  });

  it('calls onClose when close button is clicked', () => {
    render(<AIActionPanel {...mockProps} />);
    
    const closeButton = screen.getByTitle('Close AI panel');
    fireEvent.click(closeButton);
    
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('shows loading state when isGenerating is true', () => {
    render(<AIActionPanel {...mockProps} isGenerating={true} />);
    
    expect(screen.getByText('Generating...')).toBeInTheDocument();
    expect(screen.queryByText('Generate')).not.toBeInTheDocument();
  });

  it('disables generate button when isGenerating is true', () => {
    render(<AIActionPanel {...mockProps} isGenerating={true} />);
    
    const generateButton = screen.getByText('Generating...').closest('button');
    expect(generateButton).toBeDisabled();
  });

  it('handles keyboard shortcuts', async () => {
    render(<AIActionPanel {...mockProps} />);
    
    const textarea = screen.getByPlaceholderText(/E.g., Please tell me your birth year/);
    fireEvent.change(textarea, { target: { value: 'Test message' } });
    
    // Test Ctrl+Enter
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
    
    await waitFor(() => {
      expect(mockProps.onGenerate).toHaveBeenCalledWith('Test message', false);
    });
    
    // Test Escape
    fireEvent.keyDown(textarea, { key: 'Escape' });
    
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('shows step type in apply to all text', () => {
    render(<AIActionPanel {...mockProps} stepType="noMatch" />);
    
    expect(screen.getByText(/Apply to all noMatch messages/)).toBeInTheDocument();
  });
}); 