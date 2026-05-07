/**
 * Validazione dominio BookFromAgenda: queryConstraints deve essere oggetto JSON, non stringa serializzata.
 */
import { describe, expect, it } from 'vitest';
import { assertQueryConstraintPayloadShape } from '../../backend/services/bookFromAgendaService.js';

describe('BookFromAgenda assertQueryConstraintPayloadShape', () => {
  it('throws when queryConstraints is a JSON string (ConvAI / agent mistake)', () => {
    const body = {
      'agenda.type': 'Omnia',
      'agenda.url': 'https://example.com/feed',
      queryConstraints: '{"horizon":{"start":"2026-06-01","end":"2026-06-30"},"weekdays":[2,4]}',
      conversationId: 'omnia_conv_test',
      projectId: 'p1',
    };
    expect(() => assertQueryConstraintPayloadShape(body)).toThrow(/queryConstraints must be a JSON object/);
  });

  it('does not throw when queryConstraints is a plain object', () => {
    const body = {
      'agenda.type': 'Omnia',
      'agenda.url': 'https://example.com/feed',
      queryConstraints: {
        horizon: { start: '2026-06-01', end: '2026-06-30' },
        weekdays: [2, 4],
      },
      conversationId: 'omnia_conv_test',
      projectId: 'p1',
    };
    expect(() => assertQueryConstraintPayloadShape(body)).not.toThrow();
  });
});
