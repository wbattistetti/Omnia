/**
 * Computes a **tree path string** for inserting a new manual variable row in the flow variables rail
 * (before/after/child), not a variable identity. Identity is always the variable GUID; labels live in
 * `flow.meta.translations`. Collision avoidance uses these path strings only within the rail UI.
 */

export const DND_NEW_FLOW_DATA = 'application/x-omnia-new-flow-data';

export type FlowVarDropPlacement = 'before' | 'after' | 'child';

export interface FlowVarDropPosition {
  /** Path key of the row (e.g. "nome.cognome"); empty for root-level edge zones only. */
  targetPathKey: string;
  placement: FlowVarDropPlacement;
}

function ephemeralSuffix(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 10);
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Parent path for "a.b.c" -> "a.b"; "root" -> "". */
export function parentPathKey(pathKey: string): string {
  const t = pathKey.trim();
  if (!t) return '';
  const parts = t
    .split('.')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (parts.length <= 1) return '';
  return parts.slice(0, -1).join('.');
}

/** Last segment of "a.b.c" -> "c". */
export function lastSegment(pathKey: string): string {
  const parts = pathKey
    .trim()
    .split('.')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts.length ? parts[parts.length - 1] : '';
}

/** Direct child segment names under parentPathKey (from flat varNames). */
export function directChildSegments(varNames: string[], parentPathKey: string): Set<string> {
  const out = new Set<string>();
  const prefix = parentPathKey.trim() ? `${parentPathKey.trim()}.` : '';
  for (const vn of varNames) {
    const t = String(vn || '').trim();
    if (!t.startsWith(prefix)) continue;
    const rest = prefix ? t.slice(prefix.length) : t;
    const first = rest.split('.')[0]?.trim();
    if (first) out.add(first);
  }
  return out;
}

function sortedDirectChildren(varNames: string[], parentPathKey: string): string[] {
  return [...directChildSegments(varNames, parentPathKey)].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
}

/**
 * Returns a new varName (dotted path) that does not collide with existing names in varNames.
 */
export function computeNewFlowVariableVarName(varNames: string[], pos: FlowVarDropPosition): string {
  const cleaned = varNames.map((v) => String(v || '').trim()).filter(Boolean);
  const existing = new Set(cleaned);
  const ensureUnique = (candidate: string): string => {
    let c = candidate;
    let n = 0;
    while (existing.has(c) && n < 200) {
      n += 1;
      c = `${candidate}_${n}`;
    }
    return c;
  };

  const { targetPathKey, placement } = pos;
  const T = targetPathKey.trim();

  if (cleaned.length === 0) {
    return ensureUnique(`dato_${ephemeralSuffix()}`);
  }

  if (placement === 'child') {
    if (!T) {
      return ensureUnique(`dato_${ephemeralSuffix()}`);
    }
    const child = `nuovo_${ephemeralSuffix()}`;
    return ensureUnique(`${T}.${child}`);
  }

  if (!T) {
    const roots = sortedDirectChildren(cleaned, '');
    if (roots.length === 0) {
      return ensureUnique(`dato_${ephemeralSuffix()}`);
    }
    if (placement === 'before') {
      const newSeg = `!__${ephemeralSuffix()}`;
      return ensureUnique(newSeg);
    }
    const lastSeg = roots[roots.length - 1];
    const newSeg = `${lastSeg}__${ephemeralSuffix()}`;
    return ensureUnique(newSeg);
  }

  const parent = parentPathKey(T);
  const targetSeg = lastSegment(T);
  const siblings = sortedDirectChildren(cleaned, parent);
  const idx = siblings.indexOf(targetSeg);

  if (placement === 'before') {
    const prev = idx > 0 ? siblings[idx - 1] : null;
    const newSeg = prev ? `${prev}_x_${ephemeralSuffix()}` : `!__${ephemeralSuffix()}`;
    const path = parent ? `${parent}.${newSeg}` : newSeg;
    return ensureUnique(path);
  }

  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
  const newSeg = next ? `${targetSeg}_x_${ephemeralSuffix()}` : `${targetSeg}__${ephemeralSuffix()}`;
  const path = parent ? `${parent}.${newSeg}` : newSeg;
  return ensureUnique(path);
}

export function hasNewFlowDataDrag(e: React.DragEvent | DragEvent): boolean {
  return [...(e.dataTransfer?.types ?? [])].some(
    (t) => t === DND_NEW_FLOW_DATA || t.toLowerCase() === DND_NEW_FLOW_DATA.toLowerCase()
  );
}
