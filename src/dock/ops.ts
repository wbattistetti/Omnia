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

export function splitWithTab(tree: DockNode, targetId: string, region: DockRegion, tab: DockTab): DockNode {
  return mapNode(tree, n => {
    if (n.kind === 'tabset' && n.id === targetId) {
      const newTabSet: DockNode = { kind: 'tabset', id: newId(), tabs: [tab], active: 0 };
      if (region === 'center') return { ...n, tabs: [...n.tabs, tab], active: n.tabs.length };
      const orient: 'row' | 'col' = (region === 'left' || region === 'right') ? 'row' : 'col';
      const children = (region === 'left' || region === 'top') ? [newTabSet, n] : [n, newTabSet];
      return { kind: 'split', id: newId(), orientation: orient, children };
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
    const kids = n.children.map(compact).filter(Boolean) as DockNode[];
    if (kids.length === 1) return kids[0];
    return { ...n, children: kids };
  }
  if (n.kind === 'tabset') {
    if (n.tabs.length === 0) return { ...n, tabs: [], active: 0 };
    return n;
  }
  return n;
}


