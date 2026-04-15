import { DockNode, DockRegion, DockTab, isLockedMainFlowTab } from './types';

let idCounter = 0;
const newId = () => `dock_${++idCounter}`;

export function addTabCenter(tree: DockNode, targetId: string, tab: DockTab): DockNode {
  return mapNode(tree, n => {
    if (n.kind === 'tabset' && n.id === targetId) {
      return { ...n, tabs: [...n.tabs, tab], active: n.tabs.length };
    }
    return n;
  });
}

export function upsertAddCenter(tree: DockNode, targetId: string, tab: DockTab): DockNode {
  // Rimuovi se già esiste lo stesso id, poi aggiungi al centro del target
  const without = removeTab(tree, tab.id);
  return addTabCenter(without, targetId, tab);
}

export function splitWithTab(tree: DockNode, targetId: string, region: DockRegion, tab: DockTab, sizes?: number[]): DockNode {
  return mapNode(tree, n => {
    if (n.kind === 'tabset' && n.id === targetId) {
      const newTabSet: DockNode = { kind: 'tabset', id: newId(), tabs: [tab], active: 0 };
      if (region === 'center') return { ...n, tabs: [...n.tabs, tab], active: n.tabs.length };
      const orient: 'row' | 'col' = (region === 'left' || region === 'right') ? 'row' : 'col';
      const children = (region === 'left' || region === 'top') ? [newTabSet, n] : [n, newTabSet];
      // Use provided sizes or defaults (never undefined — avoids 50/50 first paint then effect jump)
      const finalSizes =
        sizes ??
        (region === 'bottom'
          ? [0.67, 0.33]
          : region === 'top'
            ? [0.33, 0.67]
            : region === 'right'
              ? [0.75, 0.25]
              : region === 'left'
                ? [0.25, 0.75]
                : [0.5, 0.5]);
      return { kind: 'split', id: newId(), orientation: orient, children, sizes: finalSizes };
    }
    return n;
  });
}

export function closeTab(tree: DockNode, tabId: string): DockNode {
  const tab = getTab(tree, tabId);
  if (isLockedMainFlowTab(tab)) {
    return tree;
  }
  const pruned = mapNode(tree, n => {
    if (n.kind === 'tabset') {
      const idx = n.tabs.findIndex(t => t.id === tabId);
      if (idx === -1) return n;
      const tabs = n.tabs.filter(t => t.id !== tabId);
      const active = Math.max(0, Math.min(n.active, tabs.length - 1));
      return { ...n, tabs, active };
    }
    return n;
  });
  return compact(pruned);
}

export function activateTab(tree: DockNode, tabId: string): DockNode {
  return mapNode(tree, n => {
    if (n.kind === 'tabset') {
      const idx = n.tabs.findIndex(t => t.id === tabId);
      return idx === -1 ? n : { ...n, active: idx };
    }
    return n;
  });
}

export function addTabNextTo(tree: DockNode, siblingTabId: string, newTab: DockTab): DockNode {
  // Inserisce newTab nello stesso TabSet del sibling, subito dopo
  return mapNode(tree, n => {
    if (n.kind !== 'tabset') return n;
    const idx = n.tabs.findIndex(t => t.id === siblingTabId);
    if (idx === -1) return n;
    const tabs = [...n.tabs.slice(0, idx + 1), newTab, ...n.tabs.slice(idx + 1)];
    const active = idx + 1;
    return { ...n, tabs, active };
  });
}

export function upsertAddNextTo(tree: DockNode, siblingTabId: string, newTab: DockTab): DockNode {
  // Se la tab esiste altrove, rimuovila prima di inserirla accanto al sibling
  const without = removeTab(tree, newTab.id);
  return addTabNextTo(without, siblingTabId, newTab);
}

export function getTab(tree: DockNode, tabId: string): DockTab | null {
  let found: DockTab | null = null;
  mapNode(tree, n => {
    if (n.kind === 'tabset') {
      const t = n.tabs.find(x => x.id === tabId);
      if (t) found = t;
    }
    return n;
  });
  return found;
}

export function removeTab(tree: DockNode, tabId: string): DockNode {
  const pruned = mapNode(tree, n => {
    if (n.kind !== 'tabset') return n;
    const idx = n.tabs.findIndex(t => t.id === tabId);
    if (idx === -1) return n;
    const tabs = n.tabs.filter(t => t.id !== tabId);
    const active = Math.max(0, Math.min(n.active, tabs.length - 1));
    return { ...n, tabs, active };
  });
  return compact(pruned);
}

/**
 * Updates an existing tab with new data
 * If tab doesn't exist, returns tree unchanged
 */
export function updateTab(tree: DockNode, tabId: string, updatedTab: DockTab): DockNode {
  return mapNode(tree, n => {
    if (n.kind !== 'tabset') return n;
    const idx = n.tabs.findIndex(t => t.id === tabId);
    if (idx === -1) return n;
    const tabs = [...n.tabs];
    tabs[idx] = updatedTab;
    return { ...n, tabs };
  });
}

export function insertTab(tree: DockNode, targetId: string, region: DockRegion, tab: DockTab, sizes?: number[]): DockNode {
  return region === 'center' ? addTabCenter(tree, targetId, tab) : splitWithTab(tree, targetId, region, tab, sizes);
}

export function moveTab(tree: DockNode, tabId: string, targetId: string, region: DockRegion, sizes?: number[]): DockNode {
  const tab = getTab(tree, tabId);
  if (!tab) return tree;
  const without = removeTab(tree, tabId);
  return insertTab(without, targetId, region, tab, sizes);
}

// --- Dual-pane flow tabs (main + subflow): split once, then reuse the opposite side ---

function nodeContainsTabsetWithId(n: DockNode, tabsetId: string): boolean {
  if (n.kind === 'tabset') return n.id === tabsetId;
  if (n.kind === 'split') return n.children.some((c) => nodeContainsTabsetWithId(c, tabsetId));
  return false;
}

function getPrimaryTabsetId(n: DockNode): string | null {
  if (n.kind === 'tabset') return n.id;
  if (n.kind === 'split') {
    for (const c of n.children) {
      const id = getPrimaryTabsetId(c);
      if (id) return id;
    }
  }
  return null;
}

function findFirstTabsetId(n: DockNode): string | null {
  if (n.kind === 'tabset') return n.id;
  if (n.kind === 'split') {
    for (const c of n.children) {
      const id = findFirstTabsetId(c);
      if (id) return id;
    }
  }
  return null;
}

/** Returns the tabset `id` that owns the given dock tab, or null. */
export function findTabsetIdContainingTab(tree: DockNode, tabId: string): string | null {
  function walk(n: DockNode): string | null {
    if (n.kind === 'tabset') {
      if (n.tabs.some((t) => t.id === tabId)) return n.id;
      return null;
    }
    for (const c of n.children) {
      const r = walk(c);
      if (r) return r;
    }
    return null;
  }
  return walk(tree);
}

/**
 * In a horizontal split, returns the tabset id on the side that does not contain `sourceTabsetId`.
 * Used to open a flow in the opposite pane (VS Code / Figma style).
 */
export function findOpposingTabsetIdInRowSplit(tree: DockNode, sourceTabsetId: string): string | null {
  function walk(n: DockNode): string | null {
    if (n.kind === 'split' && n.orientation === 'row' && n.children.length === 2) {
      const [c0, c1] = n.children;
      const leftHas = nodeContainsTabsetWithId(c0, sourceTabsetId);
      const rightHas = nodeContainsTabsetWithId(c1, sourceTabsetId);
      if (leftHas && !rightHas) return getPrimaryTabsetId(c1);
      if (rightHas && !leftHas) return getPrimaryTabsetId(c0);
    }
    if (n.kind === 'split') {
      for (const c of n.children) {
        const r = walk(c);
        if (r) return r;
      }
    }
    return null;
  }
  return walk(tree);
}

/** Replaces all tabs in a tabset (e.g. swap the entire opposite pane). */
export function replaceTabsetTabs(tree: DockNode, tabsetId: string, tabs: DockTab[], active: number): DockNode {
  return mapNode(tree, (n) => {
    if (n.kind === 'tabset' && n.id === tabsetId) {
      const safeActive = tabs.length === 0 ? 0 : Math.max(0, Math.min(active, tabs.length - 1));
      return { ...n, tabs, active: safeActive };
    }
    return n;
  });
}

export type UpsertFlowTabInDualPaneOptions = {
  /** Split proportions when creating the first horizontal split [left, right]. Default [0.5, 0.5]. */
  splitSizes?: number[];
};

/**
 * Opens a flow tab in a two-pane layout: first open splits the source tabset (new tab on the right);
 * when a row split already exists, replaces the opposite pane only (no third column).
 */
export function upsertFlowTabInDualPane(
  tree: DockNode,
  sourceTabId: string,
  newTab: DockTab,
  options?: UpsertFlowTabInDualPaneOptions
): DockNode {
  const without = removeTab(tree, newTab.id);
  const sourceTabsetId = findTabsetIdContainingTab(without, sourceTabId);
  const sizes = options?.splitSizes ?? [0.5, 0.5];

  if (!sourceTabsetId) {
    const fallbackTs = findFirstTabsetId(without);
    if (fallbackTs) {
      return splitWithTab(without, fallbackTs, 'right', newTab, sizes);
    }
    return without;
  }

  const opposingTabsetId = findOpposingTabsetIdInRowSplit(without, sourceTabsetId);
  if (opposingTabsetId) {
    return replaceTabsetTabs(without, opposingTabsetId, [newTab], 0);
  }

  return splitWithTab(without, sourceTabsetId, 'right', newTab, sizes);
}

// helpers

export function mapNode(n: DockNode, f: (n: DockNode) => DockNode): DockNode {
  // Post-order: mappa prima i figli dell'albero originale, poi applica la trasformazione
  let mapped: DockNode;
  if (n.kind === 'split') {
    const children = n.children.map(c => mapNode(c, f));
    mapped = { ...n, children };
  } else {
    mapped = { ...n };
  }
  const res = f(mapped);
  return res;
}

function compact(n: DockNode): DockNode {
  if (n.kind === 'split') {
    // Compatta ricorsivamente e rimuove i tabset vuoti dai figli
    const kids = n.children
      .map(compact)
      .filter((child) => !(child.kind === 'tabset' && child.tabs.length === 0)) as DockNode[];

    if (kids.length === 1) return kids[0];
    if (kids.length === 0) {
      // Nessun figlio: torna a un tabset vuoto per mantenere una radice valida
      return { kind: 'tabset', id: newId(), tabs: [], active: 0 };
    }
    return { ...n, children: kids };
  }
  if (n.kind === 'tabset') {
    // I tabset vuoti rimangono solo se sono la radice; se sono figli verranno rimossi dal padre
    return n;
  }
  return n;
}


