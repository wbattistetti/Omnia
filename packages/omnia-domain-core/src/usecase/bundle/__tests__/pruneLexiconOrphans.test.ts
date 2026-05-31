import { describe, expect, it } from 'vitest';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import {
  emptyProjectSlotLexicon,
  pruneLexiconOrphans,
} from '../projectSlotLexicon';
import { collectSurfacesInCatalogUseCases } from '../semanticCompile';

function makeUseCase(content: string): AIAgentUseCase {
  return {
    id: 'uc-1',
    label: 'Test',
    sort_order: 0,
    dialogue: [{ turn_id: 't1', role: 'assistant', content, editable: true }],
    phrases: [
      {
        phraseId: 'p1',
        naturalText: content,
        variants: [{ variantId: 'default' }],
      },
    ],
  } as AIAgentUseCase;
}

describe('pruneLexiconOrphans', () => {
  it('removes lexicon entries not in catalog messages', () => {
    const lexicon = {
      ...emptyProjectSlotLexicon(),
      entries: [
        { surface: '12 giugno', slot_id: 'data', approved: true },
        { surface: '17', slot_id: 'undefined', approved: false },
        { surface: 'orfano', slot_id: 'nome', approved: false },
      ],
    };
    const surfaces = collectSurfacesInCatalogUseCases([
      makeUseCase('Il [12 giugno] alle [09:30].'),
    ]);
    expect(surfaces.has('12 giugno')).toBe(true);
    expect(surfaces.has('09:30')).toBe(true);
    expect(surfaces.has('17')).toBe(false);
    expect(surfaces.has('orfano')).toBe(false);

    const { lexicon: pruned, removedEntryCount } = pruneLexiconOrphans(lexicon, surfaces);
    expect(removedEntryCount).toBe(2);
    expect(pruned.entries.map((e) => e.surface)).toEqual(['12 giugno']);
  });
});
