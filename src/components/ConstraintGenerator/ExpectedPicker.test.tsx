import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import ExpectedPicker from './ExpectedPicker';

describe('ExpectedPicker', () => {
  it('mostra il placeholder quando value è undefined', () => {
    const { getByText } = render(<ExpectedPicker value={undefined} onChange={() => {}} placeholder="scegli..." />);
    expect(getByText('scegli...')).toBeInTheDocument();
  });

  it('apre il menu e chiama onChange con true', () => {
    const handleChange = jest.fn();
    const { getByText, getAllByText } = render(<ExpectedPicker value={undefined} onChange={handleChange} />);
    fireEvent.click(getByText(/descrizione|scegli|…/i));
    fireEvent.click(getAllByText(/Valore valido/i)[0]);
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it('apre il menu e chiama onChange con false', () => {
    const handleChange = jest.fn();
    const { getByText, getAllByText } = render(<ExpectedPicker value={undefined} onChange={handleChange} />);
    fireEvent.click(getByText(/descrizione|scegli|…/i));
    fireEvent.click(getAllByText(/Valore non valido/i)[0]);
    expect(handleChange).toHaveBeenCalledWith(false);
  });
}); 