import { describe, expect, it } from 'vitest';

import type { AIAgentUseCase, AIAgentUseCaseCategory } from '@types/aiAgentUseCases';

import {

  applyUseCaseCategorization,

  displayUseCaseLabelForCategory,

  getValidUseCaseCategoryId,

  groupUseCasesByCategory,

  parseUseCaseCategoriesFromBundle,

  resolveUseCaseListDisplayLayout,

  stripThematicPrefixFromUseCaseLabel,

} from '../useCaseCategories';



function uc(id: string, label: string, sort = 0): AIAgentUseCase {

  return {

    id,

    label,

    parent_id: null,

    sort_order: sort,

    refinement_prompt: '',

    payoff: label,

    dialogue: [{ turn_id: 't1', role: 'assistant', content: 'Ciao.', editable: true }],

    notes: { behavior: '', tone: '' },

    bubble_notes: {},

  };

}



describe('groupUseCasesByCategory', () => {

  it('orders categories and cases inside each group', () => {

    const categories: AIAgentUseCaseCategory[] = [

      { id: 'cat_b', label: 'B', sort_order: 1 },

      { id: 'cat_a', label: 'A', sort_order: 0 },

    ];

    const useCases = [

      { ...uc('u2', 'Second'), category_id: 'cat_b' },

      { ...uc('u1', 'First'), category_id: 'cat_a' },

    ];

    const groups = groupUseCasesByCategory(categories, useCases);

    expect(groups.map((g) => g.category.id)).toEqual(['cat_a', 'cat_b']);

    expect(groups[0]?.cases.map((c) => c.id)).toEqual(['u1']);

    expect(groups[1]?.cases.map((c) => c.id)).toEqual(['u2']);

  });



  it('excludes use cases without valid category_id', () => {

    const categories = [{ id: 'cat_a', label: 'A', sort_order: 0 }];

    const useCases = [

      { ...uc('u1', 'In cat'), category_id: 'cat_a' },

      { ...uc('u2', 'Orphan'), category_id: undefined },

      { ...uc('u3', 'Bad ref'), category_id: 'cat_missing' },

    ];

    const groups = groupUseCasesByCategory(categories, useCases);

    expect(groups).toHaveLength(1);

    expect(groups[0]?.cases.map((c) => c.id)).toEqual(['u1']);

  });

});



describe('applyUseCaseCategorization', () => {

  it('assigns category_id only for explicit placements and strips label prefix', () => {

    const useCases = [

      uc('a', 'Chiarimento: cardiologia'),

      uc('b', 'B senza prefisso'),

      uc('c', 'Altro'),

    ];

    const categories = [

      { id: 'cat_1', label: 'Chiarimento', sort_order: 0 },

      { id: 'cat_2', label: 'Due', sort_order: 1 },

    ];

    const { useCases: out } = applyUseCaseCategorization(useCases, categories, [

      { use_case_id: 'a', category_id: 'cat_1', position: 0 },

      { use_case_id: 'b', category_id: 'cat_2', position: 0 },

    ]);

    expect(out.find((u) => u.id === 'a')?.category_id).toBe('cat_1');

    expect(out.find((u) => u.id === 'a')?.label).toBe('cardiologia');

    expect(out.find((u) => u.id === 'b')?.category_id).toBe('cat_2');

    expect(out.find((u) => u.id === 'c')?.category_id).toBeUndefined();

  });

});



describe('resolveUseCaseListDisplayLayout', () => {

  it('puts uncategorized use cases in flat root before category groups', () => {

    const categories = [{ id: 'cat_sel', label: 'Selezione', sort_order: 0 }];

    const useCases = [

      { ...uc('root', 'Titolo radice'), category_id: undefined },

      { ...uc('in', 'dentro categoria'), category_id: 'cat_sel' },

    ];

    const layout = resolveUseCaseListDisplayLayout(categories, useCases);

    expect(layout.uncategorized.map((u) => u.id)).toEqual(['root']);

    expect(layout.categoryGroups[0]?.cases.map((u) => u.id)).toEqual(['in']);

  });



  it('does not infer categories from label prefixes when categories array is empty', () => {

    const useCases = [

      { ...uc('a', 'Chiarimento: cardiologia'), category_id: undefined },

      { ...uc('b', 'Selezione: dermatologia'), category_id: undefined },

    ];

    const layout = resolveUseCaseListDisplayLayout([], useCases);

    expect(layout.categoryGroups).toHaveLength(0);

    expect(layout.uncategorized).toHaveLength(2);

  });

  it('pins start use case first in uncategorized flat list', () => {
    const useCases = [
      { ...uc('a', 'Primo'), category_id: undefined, sort_order: 0 },
      { ...uc('b', 'Secondo'), category_id: undefined, sort_order: 1 },
      { ...uc('c', 'Start'), category_id: undefined, sort_order: 2 },
    ];
    const layout = resolveUseCaseListDisplayLayout([], useCases, { startUseCaseId: 'c' });
    expect(layout.uncategorized.map((u) => u.id)).toEqual(['c', 'a', 'b']);
  });

  it('pins start use case first within its category subset', () => {
    const categories = [{ id: 'cat_sel', label: 'Selezione', sort_order: 0 }];
    const useCases = [
      { ...uc('in1', 'Uno'), category_id: 'cat_sel', sort_order: 0 },
      { ...uc('start', 'Start'), category_id: 'cat_sel', sort_order: 1 },
    ];
    const layout = resolveUseCaseListDisplayLayout(categories, useCases, {
      startUseCaseId: 'start',
    });
    expect(layout.categoryGroups[0]?.cases.map((u) => u.id)).toEqual(['start', 'in1']);
  });

});



describe('getValidUseCaseCategoryId', () => {

  it('returns null when category_id is missing or unknown', () => {

    const cats = [{ id: 'cat_x', label: 'X', sort_order: 0 }];

    expect(getValidUseCaseCategoryId(uc('a', 'A'), cats)).toBeNull();

    expect(

      getValidUseCaseCategoryId({ ...uc('b', 'B'), category_id: 'cat_x' }, cats)

    ).toBe('cat_x');

    expect(

      getValidUseCaseCategoryId({ ...uc('c', 'C'), category_id: 'cat_y' }, cats)

    ).toBeNull();

  });

});



describe('stripThematicPrefixFromUseCaseLabel', () => {

  it('strips when prefix matches category label', () => {

    expect(stripThematicPrefixFromUseCaseLabel('Selezione: dermatologia', 'Selezione')).toBe(

      'dermatologia'

    );

    expect(stripThematicPrefixFromUseCaseLabel('Altro: test', 'Selezione')).toBe('Altro: test');

  });

});



describe('displayUseCaseLabelForCategory', () => {

  it('strips redundant category prefix', () => {

    const cat = { id: 'cat_sel', label: 'Selezione', sort_order: 0 };

    const label = displayUseCaseLabelForCategory(

      uc('x', 'Selezione: dermatologia con videodermatoscopia'),

      cat

    );

    expect(label).toBe('dermatologia con videodermatoscopia');

  });

});



describe('parseUseCaseCategoriesFromBundle', () => {

  it('parses valid category rows', () => {

    const parsed = parseUseCaseCategoriesFromBundle([

      { id: 'cat_x', label: 'X', sort_order: 2 },

      { id: 'cat_y', label: 'Y', sort_order: 0 },

    ]);

    expect(parsed.map((c) => c.id)).toEqual(['cat_y', 'cat_x']);

  });



  it('parses description when present', () => {

    const parsed = parseUseCaseCategoriesFromBundle([

      {

        id: 'cat_ingresso',

        label: 'Ingresso',

        description: 'Apertura conversazione.',

        sort_order: 0,

      },

    ]);

    expect(parsed[0]?.description).toBe('Apertura conversazione.');

  });

});


