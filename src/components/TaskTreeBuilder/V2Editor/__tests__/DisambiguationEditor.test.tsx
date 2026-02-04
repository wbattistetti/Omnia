import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DisambiguationEditor from '../DisambiguationEditor';

describe('DisambiguationEditor', () => {
  it('renders and updates fields', () => {
    const onChange = vi.fn();
    render(
      <DisambiguationEditor
        value={{ prompt: '', softRanking: true, defaultWithCancel: true, selectionMode: 'numbers' }}
        onChange={onChange}
      />
    );
    expect(screen.getByLabelText('v2-disambiguation')).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue(''), { target: { value: 'Choose one' } });
    expect(onChange).toHaveBeenCalled();
  });
});


