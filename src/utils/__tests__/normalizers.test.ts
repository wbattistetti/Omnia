import { describe, it, expect } from 'vitest';
import { modeToType, typeToMode } from '../normalizers';

describe('normalizers mode/type mapping', () => {
  it('maps mode to type correctly', () => {
    expect(modeToType('DataRequest')).toBe('DataRequest');
    expect(modeToType('DataConfirmation')).toBe('Confirmation');
    expect(modeToType('ProblemClassification')).toBe('ProblemClassification');
    expect(modeToType('Summarizer')).toBe('Summarizer');
    expect(modeToType('BackendCall')).toBe('BackendCall');
    expect(modeToType('Unknown')).toBe('Message');
    expect(modeToType(undefined)).toBe('Message');
  });

  it('maps type to mode correctly', () => {
    expect(typeToMode('DataRequest')).toBe('DataRequest');
    expect(typeToMode('Confirmation')).toBe('DataConfirmation');
    expect(typeToMode('ProblemClassification')).toBe('ProblemClassification');
    expect(typeToMode('Summarizer')).toBe('Summarizer');
    expect(typeToMode('BackendCall')).toBe('BackendCall');
    expect(typeToMode('Message')).toBe('Message');
    // @ts-expect-error intentional wrong type
    expect(typeToMode('Unknown')).toBe('Message');
    // @ts-expect-error intentional undefined
    expect(typeToMode(undefined)).toBe('Message');
  });
});
