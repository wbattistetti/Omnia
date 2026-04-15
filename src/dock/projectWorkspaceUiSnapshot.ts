/**
 * Persisted workspace UI: dock structure + which flow canvases were open (flow tabs only).
 * Domain data (graphs, tasks) stays in the project save; this is client-side session layout per project.
 */

import type { DockNode, DockTab, DockTabFlow } from './types';
import { mapNode } from './ops';
import { resolveFlowTabDisplayTitle } from '@utils/resolveFlowTabDisplayTitle';

export const WORKSPACE_UI_STORAGE_VERSION = 1 as const;

export type SerializableFlowTab = {
  id: string;
  title: string;
  type: 'flow';
  flowId: string;
};

export type SerializableDockNode =
  | {
      kind: 'tabset';
      id: string;
      tabs: SerializableFlowTab[];
      active: number;
    }
  | {
      kind: 'split';
      id: string;
      orientation: 'row' | 'col';
      children: SerializableDockNode[];
      sizes?: number[];
    };

export type WorkspaceUiSnapshotV1 = {
  version: typeof WORKSPACE_UI_STORAGE_VERSION;
  root: SerializableDockNode;
};

const STORAGE_PREFIX = 'omnia.workspaceUi.v1.';

function storageKey(projectId: string): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(String(projectId || '').trim())}`;
}

/** Default dock when opening a project or after an invalid snapshot. */
export function createDefaultDockTree(): DockNode {
  return {
    kind: 'tabset',
    id: 'ts_main',
    tabs: [{ id: 'tab_main', title: 'Main', type: 'flow', flowId: 'main' }],
    active: 0,
  };
}

function isFlowTab(t: DockTab): t is DockTabFlow {
  return t.type === 'flow';
}

/** Keeps split/tabset structure and only `flow` tabs (editors/chat are not serializable). */
export function serializeDockTreeToSnapshot(tree: DockNode): WorkspaceUiSnapshotV1 | null {
  const root = serializeNode(tree);
  if (!root) return null;
  return { version: WORKSPACE_UI_STORAGE_VERSION, root };
}

function serializeNode(n: DockNode): SerializableDockNode | null {
  if (n.kind === 'tabset') {
    const tabs: SerializableFlowTab[] = n.tabs.filter(isFlowTab).map((t) => ({
      id: t.id,
      title: t.title,
      type: 'flow' as const,
      flowId: String(t.flowId || '').trim(),
    }));
    if (tabs.length === 0) return null;
    const active = Math.max(0, Math.min(n.active, tabs.length - 1));
    return { kind: 'tabset', id: n.id, tabs, active };
  }
  const children = n.children.map(serializeNode).filter((c): c is SerializableDockNode => c != null);
  if (children.length === 0) return null;
  if (children.length === 1) return children[0];
  return {
    kind: 'split',
    id: n.id,
    orientation: n.orientation,
    children,
    sizes: n.sizes,
  };
}

function collectFlowIdsFromSnapshot(node: SerializableDockNode, out: Set<string>): void {
  if (node.kind === 'tabset') {
    for (const t of node.tabs) out.add(t.flowId);
    return;
  }
  for (const c of node.children) collectFlowIdsFromSnapshot(c, out);
}

/** All flow ids referenced by flow tabs in a persisted workspace snapshot (deduped). */
export function getFlowIdsFromWorkspaceSnapshot(snapshot: WorkspaceUiSnapshotV1): string[] {
  const out = new Set<string>();
  collectFlowIdsFromSnapshot(snapshot.root, out);
  return Array.from(out);
}

/** True when every flow id in the snapshot exists in the loaded workspace. */
export function snapshotFlowIdsAreLoaded(snapshot: WorkspaceUiSnapshotV1, flowIds: Set<string>): boolean {
  const need = new Set<string>();
  collectFlowIdsFromSnapshot(snapshot.root, need);
  for (const id of need) {
    if (!flowIds.has(id)) return false;
  }
  return true;
}

/** Drops flow tabs whose canvas is not in the workspace (stale ids). Compacts empty tabsets to null. */
export function filterSnapshotToExistingFlows(
  snapshot: WorkspaceUiSnapshotV1,
  flowIds: Set<string>
): SerializableDockNode | null {
  const n = filterNode(snapshot.root, flowIds);
  return n;
}

function filterNode(n: SerializableDockNode, flowIds: Set<string>): SerializableDockNode | null {
  if (n.kind === 'tabset') {
    const tabs = n.tabs.filter((t) => flowIds.has(t.flowId));
    if (tabs.length === 0) return null;
    const active = Math.max(0, Math.min(n.active, tabs.length - 1));
    return { kind: 'tabset', id: n.id, tabs, active };
  }
  const children = n.children.map((c) => filterNode(c, flowIds)).filter((c): c is SerializableDockNode => c != null);
  if (children.length === 0) return null;
  if (children.length === 1) return children[0];
  return {
    kind: 'split',
    id: n.id,
    orientation: n.orientation,
    children,
    sizes: n.sizes,
  };
}

/** Builds runtime dock nodes; titles prefer live flow slice title. */
export function snapshotToDockNode(
  root: SerializableDockNode,
  flows: Record<string, { title?: string } | undefined>
): DockNode {
  return deserializeNode(root, flows);
}

function deserializeNode(n: SerializableDockNode, flows: Record<string, { title?: string } | undefined>): DockNode {
  if (n.kind === 'tabset') {
    const tabs: DockTab[] = n.tabs.map((tab) => {
      const title = resolveFlowTabDisplayTitle(tab.flowId, flows);
      const out: DockTabFlow = { id: tab.id, title, type: 'flow', flowId: tab.flowId };
      return out;
    });
    const active = Math.max(0, Math.min(n.active, tabs.length - 1));
    return { kind: 'tabset', id: n.id, tabs, active };
  }
  return {
    kind: 'split',
    id: n.id,
    orientation: n.orientation,
    children: n.children.map((c) => deserializeNode(c, flows)),
    sizes: n.sizes,
  };
}

/**
 * Flow id of the active tab in the **last** tabset in depth-first order (e.g. right pane in a row split).
 * Matches typical dual-pane focus (subflow on the right).
 */
/**
 * Updates flow-tab titles from domain (task name for Subflow canvases). No-op if nothing changes.
 */
export function applyFlowTabDisplayTitles(
  tree: DockNode,
  flows: Record<string, { title?: string } | undefined>
): DockNode {
  return mapNode(tree, (n) => {
    if (n.kind !== 'tabset') return n;
    let changed = false;
    const tabs = n.tabs.map((t) => {
      if (t.type !== 'flow') return t;
      const ft = t as DockTabFlow;
      const nextTitle = resolveFlowTabDisplayTitle(ft.flowId, flows);
      if (nextTitle === ft.title) return t;
      changed = true;
      return { ...ft, title: nextTitle };
    });
    return changed ? { ...n, tabs } : n;
  });
}

export function getLastActiveFlowIdFromDock(tree: DockNode): string | null {
  let last: string | null = null;
  function walk(node: DockNode): void {
    if (node.kind === 'tabset') {
      const t = node.tabs[node.active];
      if (t && t.type === 'flow') {
        const fid = String((t as DockTabFlow).flowId || '').trim();
        if (fid) last = fid;
      }
      return;
    }
    for (const c of node.children) walk(c);
  }
  walk(tree);
  return last;
}

export function parseStoredSnapshot(raw: string | null): WorkspaceUiSnapshotV1 | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== 'object') return null;
    const rec = o as Record<string, unknown>;
    if (rec.version !== WORKSPACE_UI_STORAGE_VERSION) return null;
    if (!rec.root || typeof rec.root !== 'object') return null;
    return { version: WORKSPACE_UI_STORAGE_VERSION, root: rec.root as SerializableDockNode };
  } catch {
    return null;
  }
}

export function loadWorkspaceUiSnapshot(projectId: string): WorkspaceUiSnapshotV1 | null {
  const pid = String(projectId || '').trim();
  if (!pid) return null;
  try {
    const raw = localStorage.getItem(storageKey(pid));
    return parseStoredSnapshot(raw);
  } catch {
    return null;
  }
}

export function saveWorkspaceUiSnapshot(projectId: string, tree: DockNode): void {
  const pid = String(projectId || '').trim();
  if (!pid) return;
  const snap = serializeDockTreeToSnapshot(tree);
  if (!snap) return;
  try {
    localStorage.setItem(storageKey(pid), JSON.stringify(snap));
  } catch {
    /* quota / private mode */
  }
}

export function clearWorkspaceUiSnapshot(projectId: string): void {
  const pid = String(projectId || '').trim();
  if (!pid) return;
  try {
    localStorage.removeItem(storageKey(pid));
  } catch {
    /* ignore */
  }
}

/**
 * Returns a dock tree from storage if all referenced flows exist; otherwise null (keep current UI).
 * If filtered snapshot is empty, returns default main tab.
 */
export function buildDockTreeFromSnapshotForFlows(
  snapshot: WorkspaceUiSnapshotV1,
  flows: Record<string, { title?: string } | undefined>
): DockNode | null {
  const ids = new Set(Object.keys(flows || {}));
  if (ids.size === 0) return null;
  if (!snapshotFlowIdsAreLoaded(snapshot, ids)) return null;
  const filtered = filterSnapshotToExistingFlows(snapshot, ids);
  if (!filtered) return createDefaultDockTree();
  return snapshotToDockNode(filtered, flows);
}
