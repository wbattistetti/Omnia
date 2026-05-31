import { describe, expect, it } from 'vitest';
import {
  CATALOG_IA_FIRST_COMPILE_OPTIONS,
  collectCatalogCompileInputs,
  compileUseCasePhrases,
} from '../semanticCompile';
import { emptyProjectSlotLexicon } from '../projectSlotLexicon';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';

function minimalUc(content: string): AIAgentUseCase {
  return {
    id: 'uc-1',
    label: 'Test',
    parent_id: null,
    sort_order: 0,
    refinement_prompt: '',
    payoff: 'Scenario',
    dialogue: [{ turn_id: 't1', role: 'assistant', content, editable: true }],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
  };
}

describe('catalog IA-first compile', () => {
  it('does not infer giorno_primo_slot via domain hints', () => {
    const uc = minimalUc('Slot [giorno_primo_slot] alle [ora_primo_slot].');
    const compiled = compileUseCasePhrases(uc, emptyProjectSlotLexicon(), CATALOG_IA_FIRST_COMPILE_OPTIONS);
    const tokenized = compiled.phrases?.[0]?.variants?.[0]?.compiled?.tokenizedText ?? '';
    expect(tokenized).toContain('[giorno_primo_slot]');
    expect(tokenized).toContain('[ora_primo_slot]');
    const mappings = compiled.phrases?.[0]?.variants?.[0]?.compiled?.mappings ?? [];
    expect(mappings.every((m) => m.slot_id === 'undefined')).toBe(true);
  });

  it('collectCatalogCompileInputs includes surfaces and phrase tokens', () => {
    const uc = minimalUc('Prima data [giorno_primo_slot].');
    const { surfaces, phraseTokens } = collectCatalogCompileInputs(
      [uc],
      emptyProjectSlotLexicon()
    );
    expect(surfaces).toContain('giorno_primo_slot');
    expect(phraseTokens).toContain('giorno_primo_slot');
  });

  it('still infers cardiologica with default compile options', () => {
    const uc = minimalUc('Una visita [cardiologica].');
    const compiled = compileUseCasePhrases(uc, emptyProjectSlotLexicon());
    const tokenized = compiled.phrases?.[0]?.variants?.[0]?.compiled?.tokenizedText ?? '';
    expect(tokenized).toContain('[prestazione]');
  });
});
