/**
 * Logica dominio griglia messaggio parametrico (dimensioni catalogo, no duplicati).
 */

import { describe, expect, it } from 'vitest';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { ensureUseCasePhrases } from '../migrateUseCase';
import {
  addParametricCatalogDimension,
  applyParametricRevertToSingleMessage,
  setPrimaryPhraseParametricEnabled,
} from '../parametricPhraseHelpers';

function minimalUc(): AIAgentUseCase {
  return ensureUseCasePhrases({
    id: 'uc-1',
    label: 'Test',
    parent_id: null,
    sort_order: 0,
    refinement_prompt: '',
    payoff: 'Scenario',
    dialogue: [{ turn_id: 't1', role: 'assistant', content: 'Hi', editable: true }],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
  });
}

describe('parametricPhraseHelpers', () => {
  it('addParametricCatalogDimension is no-op when catalog key already exists', () => {
    let uc = minimalUc();
    uc = setPrimaryPhraseParametricEnabled(uc, true);
    uc = addParametricCatalogDimension(uc, 'prestazione');
    expect(uc.phrases?.[0]?.parametric?.dimensions?.length).toBe(1);
    const again = addParametricCatalogDimension(uc, 'prestazione');
    expect(again.phrases?.[0]?.parametric?.dimensions?.length).toBe(1);
    expect(again).toBe(uc);
  });

  it('applyParametricRevertToSingleMessage picks row prompt and clears parametric grid', () => {
    let uc = minimalUc();
    uc = setPrimaryPhraseParametricEnabled(uc, true);
    uc = addParametricCatalogDimension(uc, 'prestazione');
    const rowId = uc.phrases?.[0]?.parametric?.rows[0]?.rowId;
    expect(rowId).toBeTruthy();
    uc = {
      ...uc,
      phrases: [
        {
          ...uc.phrases![0],
          parametric: {
            ...uc.phrases![0].parametric!,
            rows: [
              {
                ...uc.phrases![0].parametric!.rows[0],
                promptNaturalText: 'Messaggio scelto [slot]',
              },
            ],
          },
        },
      ],
    };
    const out = applyParametricRevertToSingleMessage(uc, rowId!);
    expect(out.phrases?.[0]?.naturalText).toBe('Messaggio scelto [slot]');
    expect(out.phrases?.[0]?.parametric?.enabled).toBe(false);
    expect(out.phrases?.[0]?.parametric?.dimensions).toEqual([]);
    expect(out.phrases?.[0]?.parametric?.rows).toEqual([]);
  });
});
