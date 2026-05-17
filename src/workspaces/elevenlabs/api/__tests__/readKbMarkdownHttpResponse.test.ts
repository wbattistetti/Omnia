import { describe, expect, it } from 'vitest';
import { parseKbMarkdownHttpBody } from '../readKbMarkdownHttpResponse';

describe('parseKbMarkdownHttpBody', () => {
  it('accepts raw markdown body', () => {
    const body = '## Ruolo\nUsa {{id}} quando serve.';
    const out = parseKbMarkdownHttpBody(body, 'text/markdown; charset=utf-8', true);
    expect(out.success).toBe(true);
    expect(out.markdown).toBe(body);
  });

  it('accepts legacy JSON wrapper', () => {
    const out = parseKbMarkdownHttpBody(
      JSON.stringify({ success: true, markdown: '## KB\n- regola' }),
      'application/json',
      true
    );
    expect(out.markdown).toBe('## KB\n- regola');
  });

  it('surfaces JSON error without throwing on empty body', () => {
    const out = parseKbMarkdownHttpBody('', 'application/json', false);
    expect(out.success).toBe(false);
    expect(out.error).toMatch(/vuota|empty/i);
  });
});
