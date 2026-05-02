import { describe, expect, it } from 'vitest';
import type { BackendMockTableRow } from '../backendTestRowTypes';
import {
  isBackendMockInputCellFilled,
  isBackendMockRowInputsFilledForColumns,
} from '../backendMockRowCompletion';

function row(partial: Partial<BackendMockTableRow>): BackendMockTableRow {
  return {
    id: 'r1',
    inputs: {},
    outputs: {},
    ...partial,
  };
}

describe('isBackendMockInputCellFilled', () => {
  it('false for empty, whitespace, empty string, empty literal', () => {
    expect(isBackendMockInputCellFilled(undefined)).toBe(false);
    expect(isBackendMockInputCellFilled(null)).toBe(false);
    expect(isBackendMockInputCellFilled('')).toBe(false);
    expect(isBackendMockInputCellFilled('   ')).toBe(false);
    expect(isBackendMockInputCellFilled('empty')).toBe(false);
    expect(isBackendMockInputCellFilled('EMPTY')).toBe(false);
  });
  it('true for non-empty values', () => {
    expect(isBackendMockInputCellFilled('2025-01-01')).toBe(true);
    expect(isBackendMockInputCellFilled(0)).toBe(true);
  });
});

describe('isBackendMockRowInputsFilledForColumns', () => {
  it('vacuous true when no required columns', () => {
    expect(isBackendMockRowInputsFilledForColumns(row({ inputs: {} }), [])).toBe(true);
  });
  it('false until all named inputs filled', () => {
    const names = ['a', 'b'] as const;
    expect(
      isBackendMockRowInputsFilledForColumns(row({ inputs: { a: 'x' } }), names)
    ).toBe(false);
    expect(
      isBackendMockRowInputsFilledForColumns(row({ inputs: { a: 'x', b: 'y' } }), names)
    ).toBe(true);
  });
});
