/**
 * Tests for review portal stepper.
 */

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ReviewPortalStepper } from '../ReviewPortalStepper';

describe('ReviewPortalStepper', () => {
  it('renders five steps and calls onSelectStep', () => {
    const onSelectStep = vi.fn();
    render(
      <ReviewPortalStepper activeStep="task" onSelectStep={onSelectStep} badges={{ prompts: 3 }} />
    );
    expect(screen.getByRole('button', { name: /Prompts/i })).toHaveTextContent('3');
    fireEvent.click(screen.getByRole('button', { name: /Backend/i }));
    expect(onSelectStep).toHaveBeenCalledWith('backend');
  });
});
