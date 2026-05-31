import { describe, expect, it } from 'vitest';
import { applySendHintsToBody } from '../applySendPathToBody';

describe('applySendHintsToBody', () => {
  it('applies nested path on generic API shape', () => {
    const body: Record<string, unknown> = {};
    const n = applySendHintsToBody(
      body,
      [
        {
          surface: 'fine mese',
          slotId: 'datarelativa',
          role: 'constraint',
          sendPath: 'filters.dateTo',
          valueKind: 'end_of_month',
        },
      ],
      { referenceDate: new Date(2026, 4, 15) }
    );
    expect(n).toBe(1);
    expect(body).toEqual({ filters: { dateTo: '2026-05-31' } });
  });

  it('applies horizon.end style path', () => {
    const body: Record<string, unknown> = { queryConstraints: {} };
    applySendHintsToBody(
      body,
      [
        {
          surface: 'fine mese',
          slotId: 'datarelativa',
          role: 'constraint',
          sendPath: 'queryConstraints.horizon.end',
          valueKind: 'end_of_month',
        },
      ],
      { referenceDate: new Date(2026, 4, 15) }
    );
    expect(body).toEqual({
      queryConstraints: { horizon: { end: '2026-05-31' } },
    });
  });
});
