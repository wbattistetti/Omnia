/**
 * Variable path trie helpers: flat outline rows and nested Radix menu entries
 * (cascading submenus for dotted paths / Subflow instance prefixes).
 */

export type FlatMenuRow<T> =
  | { kind: 'header'; depth: number; label: string }
  | { kind: 'leaf'; depth: number; item: T; displayLabel: string };

/** One level of the variable picker for @radix-ui/react-dropdown-menu (Sub / Item). */
export type RadixVariableMenuEntry<T> =
  | { kind: 'item'; item: T; displayLabel: string }
  | {
      kind: 'sub';
      label: string;
      /** True when every leaf under this node is a Subflow interface output (Workflow icon). */
      subflowGroup: boolean;
      children: RadixVariableMenuEntry<T>[];
    };

type TrieNode<T> = {
  segment: string;
  children: Map<string, TrieNode<T>>;
  items: T[];
};

function sortedKeys(map: Map<string, unknown>): string[] {
  return [...map.keys()].sort((a, b) => a.localeCompare(b));
}

/** Splits a dotted path into non-empty trimmed segments. */
export function splitTokenLabelSegments(tokenLabel: string): string[] {
  return String(tokenLabel || '')
    .split('.')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function insertPath<T>(root: Map<string, TrieNode<T>>, segments: string[], item: T): void {
  let map = root;
  let node: TrieNode<T> | undefined;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!map.has(seg)) {
      map.set(seg, { segment: seg, children: new Map(), items: [] });
    }
    node = map.get(seg)!;
    if (i === segments.length - 1) {
      node.items.push(item);
    }
    map = node.children;
  }
}

/**
 * Under nested Sub / headers, show only the path suffix so parent segments are not repeated
 * (e.g. submenu "dati personali" → leaves "nome", "telefono" not "dati personali.nome").
 */
function displayLabelForLeaf<T extends { tokenLabel?: string; varLabel: string }>(
  item: T,
  depth: number
): string {
  const full = String(item.tokenLabel || item.varLabel || '').trim();
  const segments = splitTokenLabelSegments(full);
  if (depth <= 0 || segments.length <= depth) {
    return full;
  }
  const suffix = segments.slice(depth);
  if (suffix.length === 0) return full;
  return suffix.join('.');
}

function collectAllItemsInSubtree<T>(node: TrieNode<T>): T[] {
  const out = [...node.items];
  for (const k of sortedKeys(node.children)) {
    out.push(...collectAllItemsInSubtree(node.children.get(k)!));
  }
  return out;
}

function isSubflowOnlySubtree<T extends { isFromActiveFlow?: boolean }>(node: TrieNode<T>): boolean {
  const all = collectAllItemsInSubtree(node);
  if (all.length === 0) return false;
  return all.every((it) => (it as { isFromActiveFlow?: boolean }).isFromActiveFlow === false);
}

/**
 * Converts a trie node into Radix menu entries (items and nested subs).
 */
function nodeToMenuEntries<T extends { tokenLabel?: string; varLabel: string; isFromActiveFlow?: boolean }>(
  node: TrieNode<T>,
  depth: number
): RadixVariableMenuEntry<T>[] {
  const hasChildren = node.children.size > 0;
  const hasItems = node.items.length > 0;

  if (!hasChildren && hasItems) {
    return node.items.map((it) => ({
      kind: 'item' as const,
      item: it,
      displayLabel: displayLabelForLeaf(it, depth),
    }));
  }

  if (hasChildren && !hasItems) {
    const children: RadixVariableMenuEntry<T>[] = [];
    for (const k of sortedKeys(node.children)) {
      children.push(...nodeToMenuEntries(node.children.get(k)!, depth + 1));
    }
    return [
      {
        kind: 'sub',
        label: node.segment,
        subflowGroup: isSubflowOnlySubtree(node),
        children,
      },
    ];
  }

  if (hasItems && hasChildren) {
    const children: RadixVariableMenuEntry<T>[] = [];
    for (const it of node.items) {
      children.push({
        kind: 'item',
        item: it,
        displayLabel: displayLabelForLeaf(it, depth),
      });
    }
    for (const k of sortedKeys(node.children)) {
      children.push(...nodeToMenuEntries(node.children.get(k)!, depth + 1));
    }
    return [
      {
        kind: 'sub',
        label: node.segment,
        subflowGroup: isSubflowOnlySubtree(node),
        children,
      },
    ];
  }

  return [];
}

/**
 * Builds nested Radix dropdown entries: dotted paths become Sub + SubContent instead of a flat list.
 */
export function buildRadixVariableMenuTree<T extends { tokenLabel?: string; varLabel: string; isFromActiveFlow?: boolean }>(
  items: T[]
): RadixVariableMenuEntry<T>[] {
  const root = new Map<string, TrieNode<T>>();
  for (const item of items) {
    const label = String(item.tokenLabel || item.varLabel || '').trim();
    const segments = splitTokenLabelSegments(label);
    if (segments.length === 0) continue;
    insertPath(root, segments, item);
  }

  const out: RadixVariableMenuEntry<T>[] = [];
  for (const key of sortedKeys(root)) {
    out.push(...nodeToMenuEntries(root.get(key)!, 0));
  }
  return out;
}

/**
 * Flattens variable menu items into header rows (pure path prefixes) and leaf rows,
 * in tree pre-order with locale-sorted siblings.
 */
export function buildFlatVariableMenuRows<T extends { tokenLabel?: string; varLabel: string }>(
  items: T[]
): FlatMenuRow<T>[] {
  const root = new Map<string, TrieNode<T>>();
  for (const item of items) {
    const label = String(item.tokenLabel || item.varLabel || '').trim();
    const segments = splitTokenLabelSegments(label);
    if (segments.length === 0) continue;
    insertPath(root, segments, item);
  }

  const out: FlatMenuRow<T>[] = [];
  for (const key of sortedKeys(root)) {
    const node = root.get(key)!;
    out.push(...flattenTrieNode(node, 0));
  }
  return out;
}

function flattenTrieNode<T extends { tokenLabel?: string; varLabel: string }>(
  node: TrieNode<T>,
  depth: number
): FlatMenuRow<T>[] {
  const out: FlatMenuRow<T>[] = [];
  const hasChildren = node.children.size > 0;
  const hasItems = node.items.length > 0;

  if (hasChildren && !hasItems) {
    out.push({ kind: 'header', depth, label: node.segment });
    for (const k of sortedKeys(node.children)) {
      out.push(...flattenTrieNode(node.children.get(k)!, depth + 1));
    }
    return out;
  }

  if (hasItems && !hasChildren) {
    for (const it of node.items) {
      out.push({
        kind: 'leaf',
        depth,
        item: it,
        displayLabel: displayLabelForLeaf(it, depth),
      });
    }
    return out;
  }

  if (hasItems && hasChildren) {
    for (const it of node.items) {
      out.push({
        kind: 'leaf',
        depth,
        item: it,
        displayLabel: displayLabelForLeaf(it, depth),
      });
    }
    for (const k of sortedKeys(node.children)) {
      out.push(...flattenTrieNode(node.children.get(k)!, depth + 1));
    }
    return out;
  }

  return out;
}
