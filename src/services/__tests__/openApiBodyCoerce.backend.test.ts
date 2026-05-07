/**
 * Verifica coercizione body Express BookFromAgenda (modulo Node in `backend/utils`).
 * @vitest-environment node
 */

import { createRequire } from 'module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  coerceBookFromAgendaRequestBody,
} = require('../../../backend/utils/openApiBodyCoerce.js') as {
  coerceBookFromAgendaRequestBody: (body: unknown) => Record<string, unknown>;
};

describe('openApiBodyCoerce (BookFromAgenda Express)', () => {
  it('coerces string booleans and 1/0 for forceRefresh', () => {
    const a = coerceBookFromAgendaRequestBody({
      conversationId: 'c1',
      projectId: 'p1',
      forceRefresh: 'true',
    });
    expect(a.forceRefresh).toBe(true);

    const b = coerceBookFromAgendaRequestBody({
      conversationId: 'c1',
      projectId: 'p1',
      forceRefresh: 'false',
    });
    expect(b.forceRefresh).toBe(false);

    const c = coerceBookFromAgendaRequestBody({
      conversationId: 'c1',
      projectId: 'p1',
      forceRefresh: '1',
    });
    expect(c.forceRefresh).toBe(true);

    const d = coerceBookFromAgendaRequestBody({
      conversationId: 'c1',
      projectId: 'p1',
      forceRefresh: '0',
    });
    expect(d.forceRefresh).toBe(false);
  });

  it('coerces integer strings in nested queryConstraints.weekdays', () => {
    const out = coerceBookFromAgendaRequestBody({
      conversationId: 'c1',
      projectId: 'p1',
      queryConstraints: { weekdays: ['1', '2', 3] },
    });
    const w = (out.queryConstraints as { weekdays: unknown }).weekdays as number[];
    expect(w[0]).toBe(1);
    expect(w[1]).toBe(2);
    expect(w[2]).toBe(3);
  });
});
