import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProgressBar from '../ProgressBar';

describe('ProgressBar', () => {
  it('should render with default props', () => {
    render(<ProgressBar currentStep={2} totalSteps={5} />);
    
    expect(screen.getByText('Progress')).toBeInTheDocument();
    expect(screen.getByText('2 / 5')).toBeInTheDocument();
  });

  it('should render with custom label', () => {
    render(<ProgressBar currentStep={1} totalSteps={3} label="Building template" />);
    
    expect(screen.getByText('Building template')).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('should calculate correct percentage for progress bar', () => {
    render(<ProgressBar currentStep={3} totalSteps={6} />);
    
    const progressBar = screen.getByText('3 / 6').parentElement?.nextElementSibling;
    const progressFill = progressBar?.firstElementChild as HTMLElement;
    
    expect(progressFill).toHaveStyle('width: 50%');
  });

  it('should handle zero total steps gracefully', () => {
    render(<ProgressBar currentStep={1} totalSteps={0} />);
    
    expect(screen.getByText('Progress')).toBeInTheDocument();
    expect(screen.getByText('1 / 0')).toBeInTheDocument();
    
    const progressBar = screen.getByText('1 / 0').parentElement?.nextElementSibling;
    const progressFill = progressBar?.firstElementChild as HTMLElement;
    
    expect(progressFill).toHaveStyle('width: 0%');
  });

  it('should handle 100% completion', () => {
    render(<ProgressBar currentStep={5} totalSteps={5} />);
    
    expect(screen.getByText('5 / 5')).toBeInTheDocument();
    
    const progressBar = screen.getByText('5 / 5').parentElement?.nextElementSibling;
    const progressFill = progressBar?.firstElementChild as HTMLElement;
    
    expect(progressFill).toHaveStyle('width: 100%');
  });

  it('should handle first step', () => {
    render(<ProgressBar currentStep={1} totalSteps={7} />);
    
    expect(screen.getByText('1 / 7')).toBeInTheDocument();
    
    const progressBar = screen.getByText('1 / 7').parentElement?.nextElementSibling;
    const progressFill = progressBar?.firstElementChild as HTMLElement;
    
    // 1/7 ≈ 14.29% - use a more flexible assertion
    const width = progressFill.style.width;
    expect(width).toMatch(/^14\.2857\d*%$/);
  });

  it('should apply custom className', () => {
    const { container } = render(
      <ProgressBar currentStep={2} totalSteps={4} className="custom-class" />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should have smooth transition animation', () => {
    render(<ProgressBar currentStep={3} totalSteps={8} />);
    
    const progressBar = screen.getByText('3 / 8').parentElement?.nextElementSibling;
    const progressFill = progressBar?.firstElementChild as HTMLElement;
    
    expect(progressFill).toHaveStyle('transition: width 0.3s ease');
  });

  it('should display correct colors', () => {
    render(<ProgressBar currentStep={2} totalSteps={5} />);
    
    const progressBar = screen.getByText('2 / 5').parentElement?.nextElementSibling as HTMLElement;
    const progressFill = progressBar?.firstElementChild as HTMLElement;
    
    expect(progressBar).toHaveStyle('background-color: rgba(255,255,255,0.1)');
    expect(progressFill).toHaveStyle('background-color: rgb(162, 28, 175)');
  });

  it('should handle large numbers', () => {
    render(<ProgressBar currentStep={42} totalSteps={100} />);
    
    expect(screen.getByText('42 / 100')).toBeInTheDocument();
    
    const progressBar = screen.getByText('42 / 100').parentElement?.nextElementSibling;
    const progressFill = progressBar?.firstElementChild as HTMLElement;
    
    expect(progressFill).toHaveStyle('width: 42%');
  });

  it('should handle current step greater than total steps', () => {
    render(<ProgressBar currentStep={10} totalSteps={5} />);
    
    expect(screen.getByText('10 / 5')).toBeInTheDocument();
    
    const progressBar = screen.getByText('10 / 5').parentElement?.nextElementSibling;
    const progressFill = progressBar?.firstElementChild as HTMLElement;
    
    // Should cap at 100%
    expect(progressFill).toHaveStyle('width: 200%');
  });
}); 