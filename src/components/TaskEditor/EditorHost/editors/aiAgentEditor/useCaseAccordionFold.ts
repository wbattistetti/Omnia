/**
 * Modalità espansione accordion lista use case (wizard): default vs custom.
 *
 * - **default**: tutti collassati; doppio click apre uno solo e chiude gli altri.
 * - **custom**: più card aperte; «Espandi tutto» entra in custom, «Collassa tutto» torna default.
 */

export type UseCaseAccordionFoldMode = 'default' | 'custom';

export type UseCaseCardExpandSource =
  | 'dblclick'
  | 'chevron'
  | 'bulk-expand'
  | 'bulk-collapse'
  | 'programmatic';

export function countExpandedUseCaseCards(
  expandedById: Readonly<Record<string, boolean>>,
  orderedIds: readonly string[]
): number {
  return orderedIds.filter((id) => expandedById[id] === true).length;
}

function buildAllExpanded(
  orderedIds: readonly string[],
  open: boolean
): Record<string, boolean> {
  const next: Record<string, boolean> = {};
  for (const id of orderedIds) next[id] = open;
  return next;
}

function onlyTargetOpen(
  orderedIds: readonly string[],
  targetId: string
): Record<string, boolean> {
  return Object.fromEntries(orderedIds.map((id) => [id, id === targetId])) as Record<
    string,
    boolean
  >;
}

export function expandAllUseCaseCards(orderedIds: readonly string[]): {
  expandedById: Record<string, boolean>;
  mode: UseCaseAccordionFoldMode;
} {
  return { expandedById: buildAllExpanded(orderedIds, true), mode: 'custom' };
}

export function collapseAllUseCaseCards(orderedIds: readonly string[]): {
  expandedById: Record<string, boolean>;
  mode: UseCaseAccordionFoldMode;
} {
  return { expandedById: buildAllExpanded(orderedIds, false), mode: 'default' };
}

/**
 * Applica apertura/chiusura di una card rispettando default/custom.
 */
export function applyUseCaseCardExpansion(
  mode: UseCaseAccordionFoldMode,
  expandedById: Readonly<Record<string, boolean>>,
  targetId: string,
  open: boolean,
  orderedIds: readonly string[],
  source: UseCaseCardExpandSource
): { expandedById: Record<string, boolean>; mode: UseCaseAccordionFoldMode } {
  if (source === 'bulk-expand') {
    return expandAllUseCaseCards(orderedIds);
  }
  if (source === 'bulk-collapse') {
    return collapseAllUseCaseCards(orderedIds);
  }

  if (!open) {
    const next = { ...expandedById, [targetId]: false };
    const anyOpen = orderedIds.some((id) => next[id] === true);
    return { expandedById: next, mode: anyOpen ? mode : 'default' };
  }

  if (source === 'dblclick' || source === 'programmatic') {
    return {
      expandedById: onlyTargetOpen(orderedIds, targetId),
      mode: 'default',
    };
  }

  const targetOpen = expandedById[targetId] === true;
  const openCount = countExpandedUseCaseCards(expandedById, orderedIds);

  if (mode === 'default') {
    if (openCount >= 1 && !targetOpen) {
      return {
        expandedById: { ...expandedById, [targetId]: true },
        mode: 'custom',
      };
    }
    return {
      expandedById: onlyTargetOpen(orderedIds, targetId),
      mode: 'default',
    };
  }

  return {
    expandedById: { ...expandedById, [targetId]: true },
    mode: 'custom',
  };
}
