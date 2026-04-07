/**
 * Drag payload from flow node rows to the Interface mapping panel (Input/Output).
 * Uses a dedicated MIME type so drops resolve the promised variable GUID, not row label text.
 */

export const DND_FLOWROW_VAR = 'application/x-omnia-flowrow-var';

/** CustomEvent from useNodeDragDrop when a row is released over INPUT/OUTPUT (row stays on node). */
export const FLOW_INTERFACE_ROW_POINTER_DROP = 'flowInterfaceRowPointerDrop';

/** CustomEvent: pointer release over Backend Call SEND/RECEIVE mapping (row stays on node). */
export const FLOW_BACKEND_MAPPING_POINTER_DROP = 'flowBackendMappingPointerDrop';

export type FlowBackendMappingPointerDropDetail = {
  flowCanvasId: string;
  zone: 'send' | 'receive';
  variableRefId: string;
  rowLabel: string;
};

/** Live preview while pointer-dragging a row over the Interface tree (drop position). */
export const FLOW_INTERFACE_POINTER_PREVIEW = 'flowInterfacePointerPreview';

export type FlowInterfacePointerPreviewDetail = {
  flowId: string;
  zone: 'input' | 'output';
  /** Leaf path key under cursor; null when empty list / append-only. */
  targetPathKey: string | null;
  placement: 'before' | 'after' | 'append';
};

export type FlowInterfaceRowPointerDropDetail = {
  flowId: string;
  zone: 'output';
  /** Stable single-segment path key (e.g. iface_<guid>). */
  internalPath: string;
  variableRefId: string;
  rowId: string;
  fromNodeId: string;
  /** Row label text from the node (shown in UI). */
  rowLabel: string;
  /** Where to insert in the flat list (Output). */
  insertTargetPathKey: string | null;
  insertPlacement: 'before' | 'after' | 'append';
};

/** Payload written on drag start from a canvas row (JSON). */
export type FlowRowInterfaceDragPayload = {
  variableRefId: string;
  nodeId: string;
  suggestedInternalPath: string;
  displayLabel: string;
};

/** Normalized drop target info for Interface trees (demo chips use path-only). */
export type FlowInterfaceDropPayload = {
  internalPath: string;
  variableRefId?: string;
  /** When set (e.g. row drag), shown as primary label instead of path slug. */
  rowLabel?: string;
};

/** Single-segment path for tree; avoids dots in user row text. */
export function stableInterfacePathForVariable(variableRefId: string): string {
  return `iface_${variableRefId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

export function slugifyInternalPath(label: string): string {
  const s = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return s || 'field';
}

/**
 * Unique dot-path segment for a new mapping row (e.g. drop da variabile): avoids collision with existing `internalPath`.
 * Ignores the row being updated (`forEntryId`) so its old ephemeral path does not block the new slug.
 */
export function uniqueInternalPathFromLabel(
  label: string,
  entries: { id: string; internalPath: string }[],
  forEntryId: string
): string {
  const base = slugifyInternalPath(label);
  let candidate = base || 'field';
  const used = new Set(
    entries
      .filter((e) => e.id !== forEntryId)
      .map((e) => e.internalPath.trim())
      .filter(Boolean)
  );
  let n = 0;
  while (used.has(candidate)) {
    n += 1;
    candidate = `${base}_${n}`;
  }
  return candidate;
}

export function parseFlowInterfaceDropFromDataTransfer(dt: DataTransfer): FlowInterfaceDropPayload | null {
  const raw = dt.getData(DND_FLOWROW_VAR);
  if (raw?.trim()) {
    try {
      const p = JSON.parse(raw) as Partial<FlowRowInterfaceDragPayload>;
      if (typeof p.variableRefId === 'string' && p.variableRefId.trim() && typeof p.suggestedInternalPath === 'string') {
        const display =
          typeof p.displayLabel === 'string' && p.displayLabel.trim() ? p.displayLabel.trim() : undefined;
        return {
          internalPath: p.suggestedInternalPath.trim(),
          variableRefId: p.variableRefId.trim(),
          ...(display ? { rowLabel: display } : {}),
        };
      }
    } catch {
      /* fall through */
    }
  }
  return null;
}

/** HTML5 drag: reorder Interface rows (siblings only; handled in FlowMappingTree). */
export const DND_IFACE_REORDER = 'application/x-omnia-iface-reorder';

/**
 * Hit-test stack (top-first) so Interface zones win over the flow canvas when overlays use pointer-events quirks.
 */
/**
 * Hit-test: Backend Call mapping panel (SEND/RECEIVE) for pointer drop from canvas rows.
 */
export function findBackendMappingZoneAtPoint(
  clientX: number,
  clientY: number,
  flowCanvasId: string
): 'send' | 'receive' | null {
  let list: Element[];
  try {
    list = document.elementsFromPoint(clientX, clientY);
  } catch {
    return null;
  }
  for (const node of list) {
    if (!(node instanceof HTMLElement)) continue;
    const root = node.closest('[data-omnia-backend-mapping][data-flow-canvas-id]');
    if (root instanceof HTMLElement) {
      const fid = root.getAttribute('data-flow-canvas-id');
      if (fid !== flowCanvasId) continue;
      const zone = root.getAttribute('data-omnia-backend-mapping');
      if (zone === 'send' || zone === 'receive') return zone;
    }
  }
  return null;
}

export function findInterfaceZoneRootAtPoint(clientX: number, clientY: number, flowCanvasId: string): HTMLElement | null {
  let list: Element[];
  try {
    list = document.elementsFromPoint(clientX, clientY);
  } catch {
    return null;
  }
  for (const node of list) {
    if (!(node instanceof HTMLElement)) continue;
    const root = node.closest('[data-flow-interface-zone][data-flow-canvas-id]');
    if (root instanceof HTMLElement) {
      const fid = root.getAttribute('data-flow-canvas-id');
      if (fid === flowCanvasId) return root;
    }
  }
  return null;
}

/**
 * Hit-test for pointer-drag preview over the Output Interface tree (row drag from canvas).
 * Only `zone === 'output'` is returned (Input ignores row-acquired drops).
 */
export function computeInterfacePointerPreview(
  clientX: number,
  clientY: number,
  flowCanvasId: string
): FlowInterfacePointerPreviewDetail | null {
  const zoneRoot = findInterfaceZoneRootAtPoint(clientX, clientY, flowCanvasId);
  if (!zoneRoot) return null;
  const fid = zoneRoot.getAttribute('data-flow-canvas-id');
  const zone = zoneRoot.getAttribute('data-flow-interface-zone') as 'input' | 'output' | null;
  if (fid !== flowCanvasId || zone !== 'output') return null;

  let row: HTMLElement | null = null;
  try {
    const list = document.elementsFromPoint(clientX, clientY);
    for (const node of list) {
      if (!(node instanceof HTMLElement)) continue;
      if (!zoneRoot.contains(node)) continue;
      const r = node.closest('[data-flow-iface-row]');
      if (r instanceof HTMLElement && zoneRoot.contains(r)) {
        row = r;
        break;
      }
    }
  } catch {
    return null;
  }
  if (row) {
    const pathKey = row.getAttribute('data-path-key') || '';
    const rect = row.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    const placement = clientY < mid ? 'before' : 'after';
    return { flowId: fid, zone, targetPathKey: pathKey, placement };
  }

  const treeRoot = zoneRoot.querySelector('[data-flow-iface-tree-root]');
  let pointerInTree = false;
  if (treeRoot) {
    try {
      const stack = document.elementsFromPoint(clientX, clientY);
      for (const node of stack) {
        if (node instanceof HTMLElement && treeRoot.contains(node)) {
          pointerInTree = true;
          break;
        }
      }
    } catch {
      pointerInTree = false;
    }
  }
  if (treeRoot && pointerInTree) {
    const rows = [...treeRoot.querySelectorAll('[data-flow-iface-row]')] as HTMLElement[];
    if (rows.length === 0) {
      return { flowId: fid, zone, targetPathKey: null, placement: 'append' };
    }
    const first = rows[0];
    const firstRect = first.getBoundingClientRect();
    if (clientY < firstRect.top) {
      return { flowId: fid, zone, targetPathKey: first.getAttribute('data-path-key') || '', placement: 'before' };
    }
    const last = rows[rows.length - 1];
    const lastRect = last.getBoundingClientRect();
    if (clientY > lastRect.bottom) {
      return { flowId: fid, zone, targetPathKey: last.getAttribute('data-path-key') || '', placement: 'after' };
    }
    return { flowId: fid, zone, targetPathKey: null, placement: 'append' };
  }

  return null;
}
