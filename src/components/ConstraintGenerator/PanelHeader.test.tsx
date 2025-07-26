import React from 'react';
import { render } from '@testing-library/react';
import PanelHeader from './PanelHeader';

describe('PanelHeader', () => {
  it('mostra il testo passato come children', () => {
    const { getByText } = render(<PanelHeader>Test Header</PanelHeader>);
    expect(getByText('Test Header')).toBeInTheDocument();
  });

  it('applica il colore di background se specificato', () => {
    const { getByText } = render(<PanelHeader color="#123456">Colore Custom</PanelHeader>);
    const el = getByText('Colore Custom');
    expect(el.parentElement).toHaveStyle('background: #123456');
  });
}); 