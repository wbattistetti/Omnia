import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WizardInputStep from '../WizardInputStep';

describe('WizardInputStep', () => {
  const defaultProps = {
    userDesc: '',
    setUserDesc: vi.fn(),
    onNext: vi.fn(),
    onCancel: vi.fn(),
    dataNode: undefined,
  };

  it('should render initial state correctly', () => {
    render(<WizardInputStep {...defaultProps} />);
    
    expect(screen.getByText('You want to create a dialogue for:')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g., date of birth, email, phone number...')).toBeInTheDocument();
    expect(screen.getByText('Describe the data you want to collect:')).toBeInTheDocument();
  });

  it('should show dataNode name when provided', () => {
    const propsWithDataNode = {
      ...defaultProps,
      dataNode: { name: 'date of birth' }
    };
    
    render(<WizardInputStep {...propsWithDataNode} />);
    
    expect(screen.getByText('date of birth')).toBeInTheDocument();
    expect(screen.getByText('Modify the description to change the data type or structure:')).toBeInTheDocument();
  });

  it('should show subData structure when present', () => {
    const propsWithSubData = {
      ...defaultProps,
      dataNode: { 
        name: 'date of birth',
        subData: ['day', 'month', 'year']
      }
    };
    
    render(<WizardInputStep {...propsWithSubData} />);
    
    expect(screen.getByText('date of birth')).toBeInTheDocument();
    expect(screen.getByText('Structure: (day, month, year)')).toBeInTheDocument();
  });

  it('should not show subData structure when not present', () => {
    const propsWithDataNode = {
      ...defaultProps,
      dataNode: { name: 'email' }
    };
    
    render(<WizardInputStep {...propsWithDataNode} />);
    
    expect(screen.getByText('email')).toBeInTheDocument();
    expect(screen.queryByText(/Structure:/)).not.toBeInTheDocument();
  });

  it('should not show subData structure when empty array', () => {
    const propsWithEmptySubData = {
      ...defaultProps,
      dataNode: { 
        name: 'number',
        subData: []
      }
    };
    
    render(<WizardInputStep {...propsWithEmptySubData} />);
    
    expect(screen.getByText('number')).toBeInTheDocument();
    expect(screen.queryByText(/Structure:/)).not.toBeInTheDocument();
  });

  it('should update placeholder based on dataNode presence', () => {
    // Without dataNode
    const { rerender } = render(<WizardInputStep {...defaultProps} />);
    expect(screen.getByPlaceholderText('e.g., date of birth, email, phone number...')).toBeInTheDocument();
    
    // With dataNode
    const propsWithDataNode = {
      ...defaultProps,
      dataNode: { name: 'date of birth' }
    };
    rerender(<WizardInputStep {...propsWithDataNode} />);
    expect(screen.getByPlaceholderText('e.g., "date of birth (day, month, year)" or "email"')).toBeInTheDocument();
  });

  it('should call setUserDesc when input changes', () => {
    render(<WizardInputStep {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('e.g., date of birth, email, phone number...');
    fireEvent.change(input, { target: { value: 'new value' } });
    
    expect(defaultProps.setUserDesc).toHaveBeenCalledWith('new value');
  });

  it('should call onNext when Enter is pressed with valid input', () => {
    const propsWithInput = {
      ...defaultProps,
      userDesc: 'valid input'
    };
    
    render(<WizardInputStep {...propsWithInput} />);
    
    const input = screen.getByPlaceholderText('e.g., date of birth, email, phone number...');
    fireEvent.keyDown(input, { key: 'Enter' });
    
    expect(defaultProps.onNext).toHaveBeenCalledTimes(1);
  });

  it('should not call onNext when Enter is pressed with empty input', () => {
    render(<WizardInputStep {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('e.g., date of birth, email, phone number...');
    fireEvent.keyDown(input, { key: 'Enter' });
    
    expect(defaultProps.onNext).not.toHaveBeenCalled();
  });

  it('should call onNext when Invia button is clicked with valid input', () => {
    const propsWithInput = {
      ...defaultProps,
      userDesc: 'valid input'
    };
    
    render(<WizardInputStep {...propsWithInput} />);
    
    fireEvent.click(screen.getByText('Invia'));
    
    expect(defaultProps.onNext).toHaveBeenCalledTimes(1);
  });

  it('should call onCancel when Annulla button is clicked', () => {
    render(<WizardInputStep {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Annulla'));
    
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('should disable Invia button when input is empty', () => {
    render(<WizardInputStep {...defaultProps} />);
    
    const button = screen.getByText('Invia');
    expect(button).toBeDisabled();
  });

  it('should enable Invia button when input has content', () => {
    const propsWithInput = {
      ...defaultProps,
      userDesc: 'valid input'
    };
    
    render(<WizardInputStep {...propsWithInput} />);
    
    const button = screen.getByText('Invia');
    expect(button).not.toBeDisabled();
  });

  it('should handle complex subData structure', () => {
    const propsWithComplexSubData = {
      ...defaultProps,
      dataNode: { 
        name: 'address',
        subData: ['street', 'city', 'postal_code', 'country']
      }
    };
    
    render(<WizardInputStep {...propsWithComplexSubData} />);
    
    expect(screen.getByText('address')).toBeInTheDocument();
    expect(screen.getByText('Structure: (street, city, postal_code, country)')).toBeInTheDocument();
  });
}); 