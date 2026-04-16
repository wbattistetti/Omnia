import { describe, expect, it } from 'vitest';
import { extractNluFromVariableStore } from '../extractNluFromVariableStore';

describe('extractNluFromVariableStore', () => {
  it('returns utterance as linguistic when store is empty', () => {
    expect(extractNluFromVariableStore({}, 'mario')).toEqual({ semantic: '', linguistic: 'mario' });
  });

  it('reads structured semantic/linguistic objects', () => {
    expect(
      extractNluFromVariableStore(
        { x: { semantic: 'NAME', linguistic: 'mario' } } as Record<string, unknown>,
        'mario'
      )
    ).toEqual({ semantic: 'NAME', linguistic: 'mario' });
  });

  it('matches string slot value to utterance', () => {
    expect(
      extractNluFromVariableStore(
        { '00000000-0000-0000-0000-000000000001': 'mario' } as Record<string, unknown>,
        'mario'
      )
    ).toEqual({ semantic: 'mario', linguistic: 'mario' });
  });

  it('uses last string entry when no exact match', () => {
    expect(
      extractNluFromVariableStore(
        { a: 'foo', b: 'bar' } as Record<string, unknown>,
        'x'
      )
    ).toEqual({ semantic: 'bar', linguistic: 'x' });
  });
});
