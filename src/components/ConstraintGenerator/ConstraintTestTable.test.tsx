import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import ConstraintTestTable from './ConstraintTestTable';

describe('ConstraintTestTable', () => {
  const testCases = [
    { input: '1', expected: true, description: 'desc1' },
    { input: '2', expected: false, description: 'desc2' }
  ];
  const newRow = { input: '', expected: true, description: '' };

  it('mostra le intestazioni delle colonne', () => {
    const { getByText } = render(
      <ConstraintTestTable
        script="return true;"
        variable="value"
        type="number"
        testCases={testCases}
        onChange={() => {}}
        newRow={newRow}
        onNewRowChange={() => {}}
        onAddRow={() => {}}
      />
    );
    expect(getByText('Valore')).toBeInTheDocument();
    expect(getByText('Esito')).toBeInTheDocument();
    expect(getByText('Descrizione')).toBeInTheDocument();
    expect(getByText('Risultato')).toBeInTheDocument();
  });

  it('mostra i test passati come prop', () => {
    const { getByText } = render(
      <ConstraintTestTable
        script="return true;"
        variable="value"
        type="number"
        testCases={testCases}
        onChange={() => {}}
        newRow={newRow}
        onNewRowChange={() => {}}
        onAddRow={() => {}}
      />
    );
    expect(getByText('desc1')).toBeInTheDocument();
    expect(getByText('desc2')).toBeInTheDocument();
  });

  it('chiama onChange quando si modifica una cella', () => {
    const handleChange = jest.fn();
    const { getByText, getByDisplayValue } = render(
      <ConstraintTestTable
        script="return true;"
        variable="value"
        type="number"
        testCases={testCases}
        onChange={handleChange}
        newRow={newRow}
        onNewRowChange={() => {}}
        onAddRow={() => {}}
      />
    );
    fireEvent.click(getByText('1'));
    const input = getByDisplayValue('1');
    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.blur(input);
    expect(handleChange).toHaveBeenCalled();
  });
}); 