/**

 * Categorie use case: parse, applicazione risposta IA, raggruppamento lista UI.

 * `category_id` valido solo se punta a una categoria persistita; assente = lista piatta (radice).

 */



import type { AIAgentUseCase, AIAgentUseCaseCategory } from '@types/aiAgentUseCases';

import { applyNarrativeOrder } from './useCaseNarrativeOrder';
import { pinStartUseCaseFirst } from '../tree/useCaseTreeOrder';



export const LABEL_DEFAULT_USE_CASE_CATEGORY = 'Generale';



const LABEL_PREFIX_PATTERN = /^([^:]{2,48}):\s*(.+)$/;



function sortUseCasesWithinCategorySubset(
  subset: readonly AIAgentUseCase[],
  startUseCaseId?: string | null
): AIAgentUseCase[] {

  const ids = new Set(subset.map((c) => c.id));

  const byParent = new Map<string | null, AIAgentUseCase[]>();

  for (const c of subset) {

    let p = c.parent_id;

    if (typeof p === 'string') {

      const t = p.trim();

      p = t.length > 0 && ids.has(t) && t !== c.id ? t : null;

    } else {

      p = null;

    }

    const arr = byParent.get(p) ?? [];

    arr.push(c);

    byParent.set(p, arr);

  }

  for (const arr of byParent.values()) {

    arr.sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));

  }

  const out: AIAgentUseCase[] = [];

  const walk = (parentId: string | null) => {

    for (const k of byParent.get(parentId) ?? []) {

      out.push(k);

      walk(k.id);

    }

  };

  walk(null);

  return pinStartUseCaseFirst(out, startUseCaseId);

}



export function createDefaultUseCaseCategory(): AIAgentUseCaseCategory {

  return {

    id: 'cat_generale',

    label: LABEL_DEFAULT_USE_CASE_CATEGORY,

    sort_order: 0,

  };

}



/** Parse categorie dal wrapper bundle (v3 o v2 con campo opzionale). */

export function parseUseCaseCategoriesFromBundle(value: unknown): AIAgentUseCaseCategory[] {

  if (!Array.isArray(value)) return [];

  const out: AIAgentUseCaseCategory[] = [];

  for (const e of value) {

    if (!e || typeof e !== 'object') continue;

    const o = e as Record<string, unknown>;

    const id = typeof o.id === 'string' ? o.id.trim() : '';

    const label = typeof o.label === 'string' ? o.label.trim() : '';

    const sort_order =

      typeof o.sort_order === 'number' && Number.isFinite(o.sort_order) ? o.sort_order : out.length;

    const description =

      typeof o.description === 'string' && o.description.trim() ? o.description.trim() : undefined;

    if (!id || !label) continue;

    out.push({ id, label, sort_order, ...(description ? { description } : {}) });

  }

  out.sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));

  return out;

}



/** `category_id` solo se valido rispetto alle categorie persistite; altrimenti `null` (radice piatta). */

export function getValidUseCaseCategoryId(

  useCase: AIAgentUseCase,

  categories: readonly AIAgentUseCaseCategory[]

): string | null {

  const raw = useCase.category_id;

  if (typeof raw !== 'string' || !raw.trim()) return null;

  const id = raw.trim();

  return categories.some((c) => c.id === id) ? id : null;

}



/** Rimuove prefisso "Categoria: titolo" quando coincide con la categoria assegnata (legacy / IA). */

export function stripThematicPrefixFromUseCaseLabel(

  label: string,

  categoryLabel?: string

): string {

  const trimmed = label.trim();

  if (!trimmed) return trimmed;

  const m = LABEL_PREFIX_PATTERN.exec(trimmed);

  if (!m) return trimmed;

  const prefix = m[1].trim();

  if (categoryLabel && prefix.toLowerCase() !== categoryLabel.trim().toLowerCase()) {

    return trimmed;

  }

  const rest = m[2].trim();

  return rest || trimmed;

}



function useCaseWithoutCategoryId(uc: AIAgentUseCase): AIAgentUseCase {

  const { category_id: _c, ...rest } = uc;

  return rest;

}



/** Categorie + assegnazioni esplicite; senza placement valido l'use case resta senza categoria. */

export function applyUseCaseCategorization(

  useCases: readonly AIAgentUseCase[],

  categories: readonly AIAgentUseCaseCategory[],

  placements: readonly { use_case_id: string; category_id: string; position: number }[]

): { categories: AIAgentUseCaseCategory[]; useCases: AIAgentUseCase[] } {

  if (useCases.length === 0) {

    return { categories: [...categories], useCases: [] };

  }

  const byId = new Map(useCases.map((u) => [u.id, u]));

  const placementByUc = new Map<string, { category_id: string; position: number }>();

  for (const p of placements) {

    const ucId = typeof p.use_case_id === 'string' ? p.use_case_id.trim() : '';

    const catId = typeof p.category_id === 'string' ? p.category_id.trim() : '';

    if (!ucId || !catId || !byId.has(ucId)) continue;

    placementByUc.set(ucId, {

      category_id: catId,

      position: typeof p.position === 'number' && Number.isFinite(p.position) ? p.position : 0,

    });

  }



  const catsSorted = [...categories].sort(

    (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)

  );

  const catIds = new Set(catsSorted.map((c) => c.id));

  const catById = new Map(catsSorted.map((c) => [c.id, c]));



  const withCategory: AIAgentUseCase[] = useCases.map((uc) => {

    const p = placementByUc.get(uc.id);

    if (!p || !catIds.has(p.category_id)) {

      return useCaseWithoutCategoryId(uc);

    }

    const cat = catById.get(p.category_id)!;

    const label = stripThematicPrefixFromUseCaseLabel(uc.label ?? '', cat.label);

    return { ...uc, category_id: p.category_id, label };

  });



  const reorderedChunks: AIAgentUseCase[] = [];

  const assigned = new Set<string>();



  for (const cat of catsSorted) {

    const ids = placements

      .filter((p) => p.category_id === cat.id && byId.has(p.use_case_id))

      .sort((a, b) => a.position - b.position)

      .map((p) => p.use_case_id);

    const missingInCat = withCategory

      .filter((u) => u.category_id === cat.id && !ids.includes(u.id))

      .map((u) => u.id);

    const orderedIds = [...ids, ...missingInCat];

    if (orderedIds.length === 0) continue;

    const subset = withCategory.filter((u) => orderedIds.includes(u.id));

    try {

      const reordered = applyNarrativeOrder(subset, orderedIds);

      for (const u of reordered) {

        reorderedChunks.push(u);

        assigned.add(u.id);

      }

    } catch {

      const sorted = sortUseCasesWithinCategorySubset(subset);

      for (const u of sorted) {

        reorderedChunks.push(u);

        assigned.add(u.id);

      }

    }

  }



  const uncategorized = sortUseCasesWithinCategorySubset(

    withCategory.filter((u) => !getValidUseCaseCategoryId(u, catsSorted))

  );

  for (const u of uncategorized) {

    if (!assigned.has(u.id)) reorderedChunks.push(u);

  }



  return { categories: catsSorted, useCases: reorderedChunks };

}



/** Non inventa categorie: restituisce solo quelle già nel bundle. */

export function ensureUseCaseCategoriesForBundle(

  categories: readonly AIAgentUseCaseCategory[],

  _useCases?: readonly AIAgentUseCase[]

): AIAgentUseCaseCategory[] {

  return categories.length > 0 ? [...categories] : [];

}



/** @deprecated Usare {@link getValidUseCaseCategoryId}. */

export function resolveUseCaseCategoryId(

  useCase: AIAgentUseCase,

  categories: readonly AIAgentUseCaseCategory[]

): string {

  return getValidUseCaseCategoryId(useCase, categories) ?? '';

}



export type UseCaseCategoryGroup = {

  category: AIAgentUseCaseCategory;

  cases: AIAgentUseCase[];

};



export type UseCaseListDisplayLayout = {

  categoryGroups: UseCaseCategoryGroup[];

  /** Use case senza `category_id` valido: lista piatta in cima, senza accordion. */

  uncategorized: AIAgentUseCase[];

};



/** Solo use case con `category_id` valido; nessun bucket «Generale» artificiale. */

export function groupUseCasesByCategory(

  categories: readonly AIAgentUseCaseCategory[],

  useCases: readonly AIAgentUseCase[],

  startUseCaseId?: string | null

): UseCaseCategoryGroup[] {

  const sortedCats = [...categories].sort(

    (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)

  );

  const groups: UseCaseCategoryGroup[] = [];

  for (const category of sortedCats) {

    const subset = useCases.filter(

      (u) => getValidUseCaseCategoryId(u, sortedCats) === category.id

    );

    if (subset.length === 0) continue;

    groups.push({ category, cases: sortUseCasesWithinCategorySubset(subset, startUseCaseId) });

  }

  return groups;

}



export function assignAllUseCasesToDefaultCategory(

  useCases: readonly AIAgentUseCase[],

  categoryId: string = 'cat_generale'

): AIAgentUseCase[] {

  return useCases.map((u) => ({ ...u, category_id: categoryId }));

}



/** Titolo use case in lista senza ripetere il nome categoria nel prefisso (dati legacy). */

export function displayUseCaseLabelForCategory(

  useCase: AIAgentUseCase,

  category: AIAgentUseCaseCategory

): string {

  return stripThematicPrefixFromUseCaseLabel(useCase.label ?? '', category.label) || useCase.id;

}



/** Layout lista: radice piatta + gruppi per categorie persistite (niente inferenza dai titoli). */

export function resolveUseCaseListDisplayLayout(

  categories: readonly AIAgentUseCaseCategory[],

  useCases: readonly AIAgentUseCase[],

  options?: { startUseCaseId?: string | null }

): UseCaseListDisplayLayout {

  if (useCases.length === 0) {

    return { categoryGroups: [], uncategorized: [] };

  }

  const startUseCaseId = options?.startUseCaseId;

  const uncategorized = sortUseCasesWithinCategorySubset(

    useCases.filter((u) => !getValidUseCaseCategoryId(u, categories)),

    startUseCaseId

  );

  const categoryGroups = groupUseCasesByCategory(categories, useCases, startUseCaseId);

  return { categoryGroups, uncategorized };

}



/** @deprecated Usare {@link resolveUseCaseListDisplayLayout}. */

export function resolveUseCaseCategoryGroupsForDisplay(

  categories: readonly AIAgentUseCaseCategory[],

  useCases: readonly AIAgentUseCase[]

): UseCaseCategoryGroup[] | null {

  const layout = resolveUseCaseListDisplayLayout(categories, useCases);

  if (layout.categoryGroups.length === 0 && layout.uncategorized.length === 0) return null;

  if (layout.categoryGroups.length === 0) return null;

  return layout.categoryGroups;

}


