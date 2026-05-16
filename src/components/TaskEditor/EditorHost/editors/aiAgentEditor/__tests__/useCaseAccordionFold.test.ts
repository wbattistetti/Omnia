/**
 * Logica espansione accordion use case (default vs custom).
 */

import { describe, expect, it } from 'vitest';
import {
  applyUseCaseCardExpansion,
  collapseAllUseCaseCards,
  countExpandedUseCaseCards,
  expandAllUseCaseCards,
} from '../useCaseAccordionFold';

const IDS = ['a', 'b', 'c'] as const;

describe('useCaseAccordionFold', () => {
  it('collapse all resets to default mode with all closed', () => {
    const { expandedById, mode } = collapseAllUseCaseCards(IDS);
    expect(mode).toBe('default');
    expect(expandedById).toEqual({ a: false, b: false, c: false });
  });

  it('expand all sets custom mode', () => {
    const { expandedById, mode } = expandAllUseCaseCards(IDS);
    expect(mode).toBe('custom');
    expect(countExpandedUseCaseCards(expandedById, IDS)).toBe(3);
  });

  it('dblclick open in default closes other cards', () => {
    const start = { a: true, b: false, c: false };
    const { expandedById, mode } = applyUseCaseCardExpansion(
      'default',
      start,
      'b',
      true,
      IDS,
      'dblclick'
    );
    expect(mode).toBe('default');
    expect(expandedById).toEqual({ a: false, b: true, c: false });
  });

  it('chevron open second card in default switches to custom', () => {
    const start = { a: true, b: false, c: false };
    const { expandedById, mode } = applyUseCaseCardExpansion(
      'default',
      start,
      'b',
      true,
      IDS,
      'chevron'
    );
    expect(mode).toBe('custom');
    expect(expandedById.a).toBe(true);
    expect(expandedById.b).toBe(true);
  });

  it('closing last open card returns to default mode', () => {
    const start = { a: true, b: false, c: false };
    const { expandedById, mode } = applyUseCaseCardExpansion(
      'custom',
      start,
      'a',
      false,
      IDS,
      'chevron'
    );
    expect(mode).toBe('default');
    expect(countExpandedUseCaseCards(expandedById, IDS)).toBe(0);
  });
});
