import { describe, expect, it } from 'vitest';
import { formatUnknownError, readHttpErrorBody } from '../httpErrorFormatting';

describe('formatUnknownError', () => {
  it('uses Error.message', () => {
    expect(formatUnknownError(new Error('load failed'))).toBe('load failed');
  });

  it('stringifies plain objects instead of [object Object]', () => {
    expect(formatUnknownError({ error: 'project_not_found' })).toBe('project_not_found');
    expect(formatUnknownError({ message: 'x' })).toBe('x');
    expect(formatUnknownError({ foo: 1 })).toBe('{"foo":1}');
  });

  it('stringifies nested error objects', () => {
    expect(formatUnknownError({ error: { code: 'E1' } })).toBe('{"code":"E1"}');
  });
});

describe('readHttpErrorBody', () => {
  it('parses JSON error string', async () => {
    const res = new Response(JSON.stringify({ error: 'project_not_found_or_missing_dbName' }), {
      status: 500,
      statusText: 'Internal Server Error',
    });
    await expect(readHttpErrorBody(res)).resolves.toBe('project_not_found_or_missing_dbName');
  });

  it('parses message field', async () => {
    const res = new Response(JSON.stringify({ message: 'catalog unavailable' }), { status: 500 });
    await expect(readHttpErrorBody(res)).resolves.toBe('catalog unavailable');
  });

  it('falls back to truncated text when JSON has no known fields', async () => {
    const res = new Response('plain failure', { status: 500 });
    await expect(readHttpErrorBody(res)).resolves.toBe('plain failure');
  });
});
