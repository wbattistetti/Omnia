/**
 * Albero collassabile Slot Mapping: tool → Inputs/Outputs → segmenti → foglie.
 */

import type { ParameterDestination } from './parameterDestinationTree';
import type { ParameterDestinationBackendGroup } from './parameterDestinationTree';
import { buildDestinationPathTree, type DestinationPathTreeNode } from './destinationPathTree';

export type CollapsibleTreeNode =
  | {
      kind: 'branch';
      id: string;
      label: string;
      children: CollapsibleTreeNode[];
    }
  | {
      kind: 'leaf';
      id: string;
      label: string;
      hint?: string;
      destination: ParameterDestination;
    };

function lastSegment(path: string): string {
  const p = path.trim();
  const m = p.match(/([^.\[\]]+)(?:\[\])?$/);
  if (m?.[1]) return m[1];
  const parts = p.split(/[.[\]]/).filter(Boolean);
  return parts[parts.length - 1] ?? p;
}

function shortLeafLabel(dest: ParameterDestination): string {
  if (dest.kind === 'receive') {
    return lastSegment(dest.receivePath ?? dest.slotId);
  }
  if (dest.kind === 'send') {
    if (dest.valueKind) return dest.valueKind;
    if (dest.facetLabel) {
      const parts = dest.facetLabel.split('·').map((s) => s.trim());
      return parts[parts.length - 1] ?? dest.facetLabel;
    }
    return dest.role ?? 'value';
  }
  return dest.slotId;
}

function leafHint(dest: ParameterDestination): string | undefined {
  if (dest.kind === 'receive') {
    return `→ ${dest.slotId}`;
  }
  if (dest.kind === 'send') {
    return dest.slotId;
  }
  return undefined;
}

function pathNodesToBranches(
  nodes: readonly DestinationPathTreeNode[],
  idPrefix: string
): CollapsibleTreeNode[] {
  const out: CollapsibleTreeNode[] = [];
  for (const node of nodes) {
    const branchId = `${idPrefix}/${node.pathPrefix}`;
    const children: CollapsibleTreeNode[] = [];

    if (node.children.length > 0) {
      children.push(...pathNodesToBranches(node.children, branchId));
    }

    const byPath = new Map<string, ParameterDestination[]>();
    for (const dest of node.destinations) {
      const key = dest.sendPath ?? dest.receivePath ?? dest.destinationId;
      const list = byPath.get(key) ?? [];
      list.push(dest);
      byPath.set(key, list);
    }

    for (const [, dests] of byPath) {
      if (dests.length === 1) {
        const d = dests[0]!;
        children.push({
          kind: 'leaf',
          id: d.destinationId,
          label: shortLeafLabel(d),
          hint: leafHint(d),
          destination: d,
        });
      } else {
        const pathLabel = lastSegment(dests[0]!.sendPath ?? dests[0]!.receivePath ?? '');
        children.push({
          kind: 'branch',
          id: `${branchId}/leaf/${pathLabel}`,
          label: pathLabel,
          children: dests.map((d) => ({
            kind: 'leaf',
            id: d.destinationId,
            label: shortLeafLabel(d),
            hint: leafHint(d),
            destination: d,
          })),
        });
      }
    }

    if (children.length > 0) {
      out.push({ kind: 'branch', id: branchId, label: node.segment, children });
    }
  }
  return out;
}

function destinationsMatchQuery(dest: ParameterDestination, q: string): boolean {
  const hay = [
    dest.slotId,
    dest.toolName ?? '',
    dest.sendPath ?? '',
    dest.receivePath ?? '',
    dest.facetLabel ?? '',
    dest.valueKind ?? '',
    dest.description ?? '',
  ]
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

function filterTree(nodes: readonly CollapsibleTreeNode[], q: string): CollapsibleTreeNode[] {
  if (!q) return [...nodes];
  const out: CollapsibleTreeNode[] = [];
  for (const node of nodes) {
    if (node.kind === 'leaf') {
      if (destinationsMatchQuery(node.destination, q)) out.push(node);
      continue;
    }
    const kids = filterTree(node.children, q);
    if (kids.length > 0) {
      out.push({ kind: 'branch', id: node.id, label: node.label, children: kids });
    }
  }
  return out;
}

/** Raccoglie id di tutti i branch (per espansione automatica in ricerca). */
export function collectBranchIds(nodes: readonly CollapsibleTreeNode[]): string[] {
  const ids: string[] = [];
  const walk = (list: readonly CollapsibleTreeNode[]) => {
    for (const n of list) {
      if (n.kind === 'branch') {
        ids.push(n.id);
        walk(n.children);
      }
    }
  };
  walk(nodes);
  return ids;
}

/**
 * Foresta per tool: radici collassate (solo nome tool visibile finché non espandi).
 */
export function buildSlotMappingCollapsibleTree(
  toolName: string,
  group: ParameterDestinationBackendGroup,
  query: string
): CollapsibleTreeNode[] {
  const toolId = `tool/${group.backendTaskId}`;
  const children: CollapsibleTreeNode[] = [];

  if (group.sendDestinations.length > 0) {
    const sendBranches = pathNodesToBranches(
      buildDestinationPathTree(group.sendDestinations),
      `${toolId}/in`
    );
    if (sendBranches.length > 0) {
      children.push({
        kind: 'branch',
        id: `${toolId}/in`,
        label: 'Inputs',
        children: sendBranches,
      });
    }
  }

  if (group.receiveDestinations.length > 0) {
    const receiveBranches = pathNodesToBranches(
      buildDestinationPathTree(group.receiveDestinations),
      `${toolId}/out`
    );
    if (receiveBranches.length > 0) {
      children.push({
        kind: 'branch',
        id: `${toolId}/out`,
        label: 'Outputs',
        children: receiveBranches,
      });
    }
  }

  if (children.length === 0) return [];

  return filterTree(
    [{ kind: 'branch', id: toolId, label: toolName, children }],
    query.trim().toLowerCase()
  );
}

export function buildSemanticCollapsibleTree(
  destinations: readonly ParameterDestination[],
  query: string
): CollapsibleTreeNode[] {
  const leaves: CollapsibleTreeNode[] = destinations.map((d) => ({
    kind: 'leaf',
    id: d.destinationId,
    label: d.slotId,
    destination: d,
  }));
  if (leaves.length === 0) return [];
  return filterTree(
    [{ kind: 'branch', id: 'semantic', label: 'Semantico (fallback)', children: leaves }],
    query.trim().toLowerCase()
  );
}
