import React from 'react';
import { render } from '@testing-library/react';
import ErrorMessage from './ErrorMessage';

describe('ErrorMessage', () => {
  it('mostra il messaggio di errore', () => {
    const { getByText } = render(<ErrorMessage message="Errore di test" />);
    expect(getByText('Errore di test')).toBeInTheDocument();
  });
}); 