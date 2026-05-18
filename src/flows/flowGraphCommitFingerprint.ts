/**
 * Fingerprints for FlowStore graph commits — skip no-op updates and selection-only churn.
 */

const POS_EPS = 0.01;

function nodeCommitSig(n: {
  id?: string;
  position?: { x?: number; y?: number };
  width?: number;
  height?: number;
  data?: unknown;
}): string {
  const id = String(n?.id ?? '');
  const x = Number(n?.position?.x);
  const y = Number(n?.position?.y);
  const w = Number(n?.width) || 0;
  const h = Number(n?.height) || 0;
  const rows = (n?.data as { rows?: unknown[] } | undefined)?.rows;
  const rowCount = Array.isArray(rows) ? rows.length : 0;
  const rowIds = Array.isArray(rows)
    ? rows
        .map((r) => String((r as { id?: string })?.id ?? ''))
        .sort()
        .join(',')
    : '';
  return `${id}:${Number.isFinite(x) ? x.toFixed(2) : '?'},${Number.isFinite(y) ? y.toFixed(2) : '?'}@${w}x${h}#r${rowCount}[${rowIds}]`;
}

function edgeCommitSig(e: { id?: string; source?: string; target?: string }): string {
  return `${String(e?.id ?? '')}>${String(e?.source ?? '')}->${String(e?.target ?? '')}`;
}

/** Stable structural fingerprint (ignores selected/dragging). */
export function fingerprintFlowGraphCommit(
  nodes: readonly unknown[],
  edges: readonly unknown[]
): string {
  const nodeSig = nodes
    .map((n) => nodeCommitSig(n as Parameters<typeof nodeCommitSig>[0]))
    .sort()
    .join(';');
  const edgeSig = edges
    .map((e) => edgeCommitSig(e as Parameters<typeof edgeCommitSig>[0]))
    .sort()
    .join(';');
  return `n${nodes.length}e${edges.length}|${nodeSig}|${edgeSig}`;
}

function stripEphemeralNodeFields<T extends Record<string, unknown>>(n: T): T {
  const { selected: _s, dragging: _d, ...rest } = n;
  return rest as T;
}

/** True when only React Flow ephemeral fields (e.g. selection) changed. */
export function isSelectionOnlyNodeGraphChange(
  before: readonly unknown[],
  after: readonly unknown[]
): boolean {
  if (before.length !== after.length) return false;
  const byId = (list: readonly unknown[]) =>
    new Map(list.map((n) => [String((n as { id?: string }).id ?? ''), n]));
  const mapB = byId(before);
  const mapA = byId(after);
  for (const [id, nb] of mapB) {
    const na = mapA.get(id);
    if (!na) return false;
    const sb = stripEphemeralNodeFields(nb as Record<string, unknown>);
    const sa = stripEphemeralNodeFields(na as Record<string, unknown>);
    if (JSON.stringify(sb) !== JSON.stringify(sa)) return false;
  }
  return true;
}

export function positionsChangedBetween(
  before: readonly { id?: string; position?: { x?: number; y?: number } }[],
  after: readonly { id?: string; position?: { x?: number; y?: number } }[]
): boolean {
  const mapB = new Map(before.map((n) => [String(n.id ?? ''), n.position]));
  for (const n of after) {
    const id = String(n.id ?? '');
    const p = n.position;
    const q = mapB.get(id);
    if (!p || !q) return true;
    if (Math.abs((p.x ?? 0) - (q.x ?? 0)) > POS_EPS) return true;
    if (Math.abs((p.y ?? 0) - (q.y ?? 0)) > POS_EPS) return true;
  }
  return false;
}
