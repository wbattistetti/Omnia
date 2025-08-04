import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import TestRow from './TestRow';

describe('TestRow', () => {
  const mockTestData = {
    id: '1',
    input: 'test input',
    expected: 'test expected',
    actual: 'test actual',
    passed: true
  };

  it('chiama onChange quando si edita una cella', () => {
    const handleChange = vi.fn();
    const { getByText, getByDisplayValue } = render(
      <table><tbody>
        <TestRow 
          testData={mockTestData} 
          onChange={handleChange} 
          onRemove={vi.fn()} 
        />
      </tbody></table>
    );

    const inputCell = getByDisplayValue('test input');
    fireEvent.change(inputCell, { target: { value: 'nuovo input' } });

    expect(handleChange).toHaveBeenCalledWith('1', {
      ...mockTestData,
      input: 'nuovo input'
    });
  });

  it('chiama onRemove quando si clicca il pulsante rimozione', () => {
    const handleRemove = vi.fn();
    const { getByTitle } = render(
      <table><tbody>
        <TestRow 
          testData={mockTestData} 
          onChange={vi.fn()} 
          onRemove={handleRemove} 
        />
      </tbody></table>
    );

    const removeButton = getByTitle('Rimuovi test case');
    fireEvent.click(removeButton);

    expect(handleRemove).toHaveBeenCalledWith('1');
  });
}); 