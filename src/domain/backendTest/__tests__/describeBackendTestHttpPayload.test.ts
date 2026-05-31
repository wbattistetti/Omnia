import { describe, expect, it } from 'vitest';
import { isEmptyBackendTestBodyJson } from '../describeBackendTestHttpPayload';

describe('describeBackendTestHttpPayload', () => {
  it('isEmptyBackendTestBodyJson: null, empty string, {}', () => {
    expect(isEmptyBackendTestBodyJson(null)).toBe(true);
    expect(isEmptyBackendTestBodyJson('')).toBe(true);
    expect(isEmptyBackendTestBodyJson('{}')).toBe(true);
  });

  it('isEmptyBackendTestBodyJson: body con parametri', () => {
    expect(isEmptyBackendTestBodyJson('{"windowDays":10}')).toBe(false);
  });
});
