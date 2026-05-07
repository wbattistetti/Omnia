import { describe, expect, it } from 'vitest';
import { generateProjectId, sanitizeProjectIdSegment } from '../generateProjectId';

describe('sanitizeProjectIdSegment', () => {
  it('maps empty to na', () => {
    expect(sanitizeProjectIdSegment('')).toBe('na');
    expect(sanitizeProjectIdSegment('   ')).toBe('na');
  });

  it('keeps alphanumerics and maps other chars to underscore', () => {
    expect(sanitizeProjectIdSegment('Acme Corp')).toBe('Acme_Corp');
    expect(sanitizeProjectIdSegment('test__ spaces')).toBe('test_spaces');
  });
});

describe('generateProjectId', () => {
  it('builds Omnia_<c>_<p>_<v>', () => {
    expect(generateProjectId('acme', 'demo', '1.0')).toBe('Omnia_acme_demo_1_0');
  });

  it('sanitizes segments', () => {
    expect(generateProjectId('Acme & Co.', 'My Project', 'v2')).toBe('Omnia_Acme_Co_My_Project_v2');
  });
});
