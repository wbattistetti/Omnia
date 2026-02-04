import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NotConfirmedEditor from '../NotConfirmedEditor';

describe('NotConfirmedEditor', () => {
  it('renders and updates prompts and thresholds', () => {
    const onChange = vi.fn();
    render(
      <NotConfirmedEditor
        value={{ prompts: ['', '', ''], offerHandoffAfter: 3, offerSkipAfter: 3 }}
        onChange={onChange}
      />
    );
    expect(screen.getByLabelText('v2-notconfirmed')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('prompt-1'), { target: { value: 'L1' } });
    expect(onChange).toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('offer-skip-after'), { target: { value: '2' } });
    expect(onChange).toHaveBeenCalled();
  });
});


