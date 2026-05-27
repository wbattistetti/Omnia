import { describe, it, expect } from 'vitest';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import {
  appendVirtualAgentCatalogToRulesString,
  buildVirtualAgentRuntimeCatalogFromUseCases,
  buildVirtualAgentUseCaseConstrainedPromptAppendix,
} from '../virtualAgentRuntimeCatalog';

function sampleUseCase(): AIAgentUseCase {
  return {
    id: 'UC5',
    label: 'Orari disponibili',
    parent_id: null,
    sort_order: 0,
    refinement_prompt: '',
    payoff: 'User asks hours',
    dialogue: [
      {
        turn_id: 't1',
        role: 'assistant',
        content: "Per [data_richiesta], c'è disponibilità alle [ora_disponibile].",
        editable: true,
        motor_snapshot: {
          source_content: "Per [data_richiesta], c'è disponibilità alle [ora_disponibile].",
          payload: {
            use_case_id: 'UC5',
            label: 'Orari disponibili per una data',
            template: "Per [data_richiesta], c'è disponibilità alle [ora_disponibile].",
            segments: [],
            slots: [
              { slot_id: 'data_richiesta', surface: 'sabato 21' },
              { slot_id: 'ora_disponibile', surface: '8' },
            ],
            groups: [
              {
                slot_id: 'ora_disponibile',
                values: ['8', '10', '14'],
                separator: ', ',
                last_separator: ' e ',
              },
            ],
          },
        },
      },
    ],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
  };
}

describe('virtualAgentRuntimeCatalog', () => {
  it('builds schema shell and filled example', () => {
    const { entries, skipped } = buildVirtualAgentRuntimeCatalogFromUseCases([sampleUseCase()]);
    expect(skipped).toHaveLength(0);
    expect(entries).toHaveLength(1);
    expect(entries[0].schema.slots.map((s) => s.surface).every((x) => x === '')).toBe(true);
    expect(entries[0].schema.groups?.[0].values).toEqual([]);
    expect(entries[0].example_filled_output.slots[0].surface).toBe('sabato 21');
    expect(entries[0].example_filled_output.groups?.[0].values).toEqual(['8', '10', '14']);
    expect(entries[0].use_case_id).toBe('UC5');
    expect(entries[0].catalog_number).toBe(1);
  });

  it('appendVirtualAgentCatalogToRulesString appends when catalog entries exist', () => {
    const json = JSON.stringify([sampleUseCase()]);
    const out = appendVirtualAgentCatalogToRulesString('BASE', json);
    expect(out.startsWith('BASE')).toBe(true);
    expect(out).toContain('Instructions per Prompt Rendering');
    expect(out).toContain('### Catalogo Use Cases');
    expect(out).toContain('UC5');
    expect(out).toContain('UC 1');
  });

  it('skips use case without motor snapshot', () => {
    const bare: AIAgentUseCase = {
      ...sampleUseCase(),
      id: 'no-motor',
      dialogue: [{ turn_id: 't1', role: 'assistant', content: 'hi', editable: true }],
    };
    const { skipped } = buildVirtualAgentRuntimeCatalogFromUseCases([bare]);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].reason).toBe('missing_assistant_turn_or_motor_snapshot');
  });

  it('buildVirtualAgentUseCaseConstrainedPromptAppendix includes style block when set', () => {
    const { entries } = buildVirtualAgentRuntimeCatalogFromUseCases([sampleUseCase()]);
    const plain = buildVirtualAgentUseCaseConstrainedPromptAppendix(entries);
    expect(plain).not.toContain('Stile conversazionale globale');
    const styled = buildVirtualAgentUseCaseConstrainedPromptAppendix(entries, {
      globalStyleContract: 'Tono cortese.',
    });
    expect(styled).toContain('### Stile conversazionale globale');
    expect(styled).toContain('Tono cortese.');
  });
});
