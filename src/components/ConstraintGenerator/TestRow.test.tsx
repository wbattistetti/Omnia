import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import TestRow from './TestRow';

describe('TestRow', () => {
  const baseTestCase = { input: '42', expected: true, description: 'desc' };

  it('mostra i valori delle celle', () => {
    const { getByText } = render(
      <table><tbody>
        <TestRow testCase={baseTestCase} onChange={() => {}} variable="value" script="return true;" index={0} />
      </tbody></table>
    );
    expect(getByText('42')).toBeInTheDocument();
    expect(getByText('desc')).toBeInTheDocument();
  });

  it('chiama onChange quando si edita una cella', () => {
    const handleChange = jest.fn();
    const { getByText, getByDisplayValue } = render(
      <table><tbody>
        <TestRow testCase={baseTestCase} onChange={handleChange} variable="value" script="return true;" index={0} />
      </tbody></table>
    );
    fireEvent.click(getByText('42'));
    const input = getByDisplayValue('42');
    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.blur(input);
    expect(handleChange).toHaveBeenCalledWith('input', '99');
  });

  it('chiama onRemove quando si clicca il pulsante rimozione', () => {
    const handleRemove = jest.fn();
    const { getByTitle } = render(
      <table><tbody>
        <TestRow testCase={baseTestCase} onChange={() => {}} onRemove={handleRemove} variable="value" script="return true;" index={0} />
      </tbody></table>
    );
    fireEvent.click(getByTitle('Rimuovi test'));
    expect(handleRemove).toHaveBeenCalled();
  });
}); 