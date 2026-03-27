/**
 * Single merge path for React Flow edges: top-level persistence, `data`, and dual-write
 * for `label` / `conditionId` / `isElse` so UI and persistence stay aligned.
 */

import type { Edge } from 'reactflow';
import type { EdgeData } from '../types/flowTypes';

const TOP_LEVEL_KEYS = ['conditionId', 'isElse', 'linkStyle', 'controlPoints'] as const;

const TOP_LEVEL_SET = new Set<string>(TOP_LEVEL_KEYS);

function normalizeLabelInput(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'object' && v !== null) {
    const o = v as { description?: string; name?: string };
    const s = o.description || o.name || '';
    return s.trim() === '' ? undefined : String(s).trim();
  }
  const s = String(v).trim();
  return s.length ? s : undefined;
}

/**
 * Applies a partial update to one edge. Callers: FlowActionsContext, useEdgeDataManager, services.
 */
export function mergeEdgePatch(edge: Edge<EdgeData>, updates: Record<string, any>): Edge<EdgeData> {
  const next: Edge<EdgeData> = {
    ...edge,
    data: { ...(edge.data || {}) },
  };
  const nd = next.data as Record<string, any>;

  if ('label' in updates) {
    const normalized = normalizeLabelInput(updates.label);
    if (normalized === undefined) {
      delete (next as any).label;
      delete nd.label;
    } else {
      (next as any).label = normalized;
      nd.label = normalized;
    }
  }

  for (const k of TOP_LEVEL_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(updates, k)) continue;
    const v = (updates as any)[k];
    if (k === 'conditionId') {
      if (v === undefined || v === null || v === '') {
        delete (next as any).conditionId;
        delete nd.conditionId;
      } else {
        (next as any).conditionId = v;
        nd.conditionId = v;
      }
    } else if (k === 'isElse') {
      const b = !!v;
      (next as any).isElse = b;
      nd.isElse = b;
    } else if (v === undefined) {
      delete (next as any)[k];
      delete nd[k];
    } else {
      (next as any)[k] = v;
    }
  }

  const reserved = new Set<string>(['label', 'data', ...TOP_LEVEL_SET]);
  for (const key of Object.keys(updates)) {
    if (reserved.has(key)) continue;
    const v = updates[key];
    if (v === undefined) {
      delete nd[key];
    } else {
      nd[key] = v;
    }
  }

  if (updates.data !== undefined && updates.data !== null && typeof updates.data === 'object') {
    for (const [k, v] of Object.entries(updates.data)) {
      if (v === undefined) {
        delete nd[k];
      } else {
        nd[k] = v;
      }
    }
  }

  return next;
}
