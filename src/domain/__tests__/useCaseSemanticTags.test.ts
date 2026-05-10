import { describe, expect, it } from 'vitest';
import {
  buildUseCaseMicroScenarioStyleLines,
  coerceUseCaseTagEnum,
} from '../useCaseSemanticTags';

describe('coerceUseCaseTagEnum', () => {
  it('accepts canonical enum strings', () => {
    expect(coerceUseCaseTagEnum('proposta')).toBe('proposta');
    expect(coerceUseCaseTagEnum('CONFERMA')).toBe('conferma');
  });

  it('maps common synonyms', () => {
    expect(coerceUseCaseTagEnum('propongo una alternativa')).toBe('proposta');
    expect(coerceUseCaseTagEnum('rifiuto dell utente')).toBe('rifiuto');
    expect(coerceUseCaseTagEnum('ambiguo')).toBe('chiarimento');
  });

  it('defaults unknown values', () => {
    expect(coerceUseCaseTagEnum('')).toBe('chiarimento');
    expect(coerceUseCaseTagEnum(null)).toBe('chiarimento');
  });
});

describe('buildUseCaseMicroScenarioStyleLines', () => {
  it('includes payoff when provided', () => {
    const lines = buildUseCaseMicroScenarioStyleLines({
      useCaseLabel: 'Prenotazione',
      styleId: 'cortese',
      payoff: 'Utente chiede una data alternativa dopo un rifiuto.',
    });
    expect(lines.some((l) => l.includes('Contesto scenario'))).toBe(true);
    expect(lines.some((l) => l.includes('alternativa'))).toBe(true);
  });
});
