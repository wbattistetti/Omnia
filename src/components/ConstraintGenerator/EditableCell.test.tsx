import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import EditableCell from './EditableCell';

describe('EditableCell', () => {
  it('mostra il valore passato', () => {
    const { getByText } = render(<EditableCell value="test" onChange={() => {}} />);
    expect(getByText('test')).toBeInTheDocument();
  });

  it('mostra il placeholder se value è vuoto', () => {
    const { getByText } = render(<EditableCell value="" onChange={() => {}} placeholder="placeholder..." />);
    expect(getByText('placeholder...')).toBeInTheDocument();
  });

  it('diventa editabile al click e chiama onChange', () => {
    const handleChange = jest.fn();
    const { getByText, getByDisplayValue } = render(<EditableCell value="foo" onChange={handleChange} />);
    fireEvent.click(getByText('foo'));
    const input = getByDisplayValue('foo');
    fireEvent.change(input, { target: { value: 'bar' } });
    fireEvent.blur(input);
    expect(handleChange).toHaveBeenCalledWith('bar');
  });
}); 