import { DockNode, DockRegion, DockTab } from './types';

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
      // Use provided sizes or default proportions
      const finalSizes = sizes || (region === 'bottom' ? [0.67, 0.33] : region === 'top' ? [0.33, 0.67] : undefined);
      return { kind: 'split', id: newId(), orientation: orient, children, sizes: finalSizes };
    }
    return n;
  });
}

export function closeTab(tree: DockNode, tabId: string): DockNode {
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

export function insertTab(tree: DockNode, targetId: string, region: DockRegion, tab: DockTab, sizes?: number[]): DockNode {
  return region === 'center' ? addTabCenter(tree, targetId, tab) : splitWithTab(tree, targetId, region, tab, sizes);
}

export function moveTab(tree: DockNode, tabId: string, targetId: string, region: DockRegion, sizes?: number[]): DockNode {
  const tab = getTab(tree, tabId);
  if (!tab) return tree;
  const without = removeTab(tree, tabId);
  return insertTab(without, targetId, region, tab, sizes);
}

// helpers

function mapNode(n: DockNode, f: (n: DockNode) => DockNode): DockNode {
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


