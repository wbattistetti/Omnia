import { describe, expect, it } from 'vitest';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import {
  buildUseCaseCatalogNumberById,
  buildUseCaseLogValue,
  formatUseCaseCatalogNumberLabel,
  formatUseCaseCatalogListLabel,
} from '../useCaseCatalogNumber';

const uc = (id: string, sort_order: number, label: string): AIAgentUseCase =>
  ({
    id,
    label,
    parent_id: null,
    sort_order,
    refinement_prompt: '',
    dialogue: [],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
  }) as AIAgentUseCase;

describe('useCaseCatalogNumber', () => {
  it('assigns stable 1..N by sort_order then label', () => {
    const map = buildUseCaseCatalogNumberById([
      uc('b', 2, 'Beta'),
      uc('a', 1, 'Alpha'),
    ]);
    expect(map.get('a')).toBe(1);
    expect(map.get('b')).toBe(2);
  });

  it('buildUseCaseLogValue includes number and upper label', () => {
    expect(buildUseCaseLogValue(7, 'Orari')).toBe('USECASE: "7 — ORARI"');
  });

  it('formatUseCaseCatalogNumberLabel', () => {
    expect(formatUseCaseCatalogNumberLabel(3)).toBe('UC 3');
  });

  it('formatUseCaseCatalogListLabel', () => {
    expect(formatUseCaseCatalogListLabel(3, 'Saluto')).toBe('3 — Saluto');
    expect(formatUseCaseCatalogListLabel(undefined, 'Solo')).toBe('Solo');
  });
});
