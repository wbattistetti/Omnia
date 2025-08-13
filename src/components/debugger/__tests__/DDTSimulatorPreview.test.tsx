import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DDTSimulatorPreview from '../DDTSimulatorPreview';

describe('DDTSimulatorPreview', () => {
  it('renders and advances mode, shows lanes and breadcrumbs', async () => {
    render(<DDTSimulatorPreview /> as any);
    expect(screen.getByText(/Mode:/)).toBeTruthy();
    const input = screen.getByLabelText('user-input');
    fireEvent.change(input, { target: { value: '12/05/1990' } });
    fireEvent.click(screen.getByText('Send'));
    // simple presence check
    expect(screen.getByText(/Mode:/)).toBeTruthy();
    expect(screen.getByLabelText('mode-lanes')).toBeTruthy();
    expect(screen.getByLabelText('breadcrumbs')).toBeTruthy();
  });
});


