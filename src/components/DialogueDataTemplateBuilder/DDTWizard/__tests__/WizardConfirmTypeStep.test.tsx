import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WizardConfirmTypeStep from '../WizardConfirmTypeStep';

describe('WizardConfirmTypeStep', () => {
  const defaultProps = {
    detectedType: 'date of birth',
    detectTypeIcon: 'Calendar',
    detectedSubData: null,
    onCorrect: vi.fn(),
    onWrong: vi.fn(),
    onCancel: vi.fn(),
  };

  it('should render the detected type correctly', () => {
    render(<WizardConfirmTypeStep {...defaultProps} />);
    
    expect(screen.getByText('Create a dialogue for:')).toBeInTheDocument();
    expect(screen.getByText('date of birth')).toBeInTheDocument();
  });

  it('should show subData structure when present', () => {
    const propsWithSubData = {
      ...defaultProps,
      detectedSubData: ['day', 'month', 'year']
    };
    
    render(<WizardConfirmTypeStep {...propsWithSubData} />);
    
    expect(screen.getByText('Structure: (day, month, year)')).toBeInTheDocument();
  });

  it('should not show subData structure when not present', () => {
    render(<WizardConfirmTypeStep {...defaultProps} />);
    
    expect(screen.queryByText(/Structure:/)).not.toBeInTheDocument();
  });

  it('should not show subData structure when empty array', () => {
    const propsWithEmptySubData = {
      ...defaultProps,
      detectedSubData: []
    };
    
    render(<WizardConfirmTypeStep {...propsWithEmptySubData} />);
    
    expect(screen.queryByText(/Structure:/)).not.toBeInTheDocument();
  });

  it('should call onCorrect when Correct button is clicked', () => {
    render(<WizardConfirmTypeStep {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Correct'));
    
    expect(defaultProps.onCorrect).toHaveBeenCalledTimes(1);
  });

  it('should call onWrong when Wrong button is clicked', () => {
    render(<WizardConfirmTypeStep {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Wrong'));
    
    expect(defaultProps.onWrong).toHaveBeenCalledTimes(1);
  });

  it('should call onCancel when Cancel button is clicked', () => {
    render(<WizardConfirmTypeStep {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Cancel'));
    
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('should handle null detectedType gracefully', () => {
    const propsWithNullType = {
      ...defaultProps,
      detectedType: null
    };
    
    render(<WizardConfirmTypeStep {...propsWithNullType} />);
    
    expect(screen.getByText('Create a dialogue for:')).toBeInTheDocument();
  });

  it('should handle complex subData structure', () => {
    const propsWithComplexSubData = {
      ...defaultProps,
      detectedSubData: ['street', 'city', 'postal_code', 'country']
    };
    
    render(<WizardConfirmTypeStep {...propsWithComplexSubData} />);
    
    expect(screen.getByText('Structure: (street, city, postal_code, country)')).toBeInTheDocument();
  });
}); 