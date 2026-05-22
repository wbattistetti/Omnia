/**
 * Lista use case per il pannello review (categorie + righe), senza wizard/dock.
 */

import type { AIAgentUseCase, AIAgentUseCaseCategory } from '@types/aiAgentUseCases';
import { resolveUseCaseListDisplayLayout } from '@domain/aiAgentUseCase/useCaseCategories';

export type UseCaseReviewListRow =
  | { kind: 'category'; category: AIAgentUseCaseCategory; count: number }
  | {
      kind: 'use_case';
      useCase: AIAgentUseCase;
      category: AIAgentUseCaseCategory | null;
    };

export function buildUseCaseReviewListRows(
  categories: readonly AIAgentUseCaseCategory[],
  ordered: readonly AIAgentUseCase[]
): UseCaseReviewListRow[] {
  const layout = resolveUseCaseListDisplayLayout(categories, ordered);
  const rows: UseCaseReviewListRow[] = [];
  for (const u of layout.uncategorized) {
    rows.push({ kind: 'use_case', useCase: u, category: null });
  }
  for (const g of layout.categoryGroups) {
    rows.push({ kind: 'category', category: g.category, count: g.cases.length });
    for (const u of g.cases) {
      rows.push({ kind: 'use_case', useCase: u, category: g.category });
    }
  }
  return rows;
}
