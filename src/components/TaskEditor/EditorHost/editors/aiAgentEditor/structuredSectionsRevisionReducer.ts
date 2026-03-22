/**
 * Reducer: independent revision state per structured AI Agent section.
 */

import type { AgentStructuredSectionId } from './agentStructuredSectionIds';
import { AGENT_STRUCTURED_SECTION_IDS } from './agentStructuredSectionIds';
import type { InsertOp } from './effectiveFromRevisionMask';
import type { PersistedStructuredSections, PersistedSectionSnapshot } from './structuredSectionPersist';
import type { StructuredRefinementOp } from './structuredRefinementOps';
import { applyRevisionBatchToSlice } from './applyRevisionBatchToSlice';
import type { RevisionBatchOp } from './textRevisionLinear';

export interface StructuredSectionRevisionSlice {
  promptBaseText: string;
  deletedMask: boolean[];
  inserts: InsertOp[];
  refinementOpLog: StructuredRefinementOp[];
}

export type StructuredSectionsRevisionState = Record<
  AgentStructuredSectionId,
  StructuredSectionRevisionSlice
>;

export type StructuredSectionsRevisionAction =
  | { type: 'RESET_ALL'; bases: Record<AgentStructuredSectionId, string> }
  | { type: 'RESET_FROM_PERSISTED'; persisted: PersistedStructuredSections }
  | { type: 'DELETE_RANGE'; sectionId: AgentStructuredSectionId; start: number; end: number }
  | { type: 'INSERT'; sectionId: AgentStructuredSectionId; position: number; text: string }
  | { type: 'APPLY_REVISION_OPS'; sectionId: AgentStructuredSectionId; ops: readonly RevisionBatchOp[] };

function emptySlice(base: string): StructuredSectionRevisionSlice {
  return {
    promptBaseText: base,
    deletedMask: new Array(Math.max(0, base.length)).fill(false),
    inserts: [],
    refinementOpLog: [],
  };
}

function sliceFromPersisted(p: PersistedSectionSnapshot): StructuredSectionRevisionSlice {
  const base = p.base;
  const dm = [...p.deletedMask];
  while (dm.length < base.length) dm.push(false);
  if (dm.length > base.length) dm.length = base.length;
  return {
    promptBaseText: base,
    deletedMask: dm,
    inserts: p.inserts.map((x) => ({ ...x })),
    refinementOpLog: [],
  };
}

export function createInitialStructuredSectionsState(
  bases: Record<AgentStructuredSectionId, string>
): StructuredSectionsRevisionState {
  const out = {} as StructuredSectionsRevisionState;
  for (const id of AGENT_STRUCTURED_SECTION_IDS) {
    out[id] = emptySlice(bases[id] ?? '');
  }
  return out;
}

export function structuredSectionsRevisionReducer(
  state: StructuredSectionsRevisionState,
  action: StructuredSectionsRevisionAction
): StructuredSectionsRevisionState {
  switch (action.type) {
    case 'RESET_ALL': {
      const next = {} as StructuredSectionsRevisionState;
      for (const id of AGENT_STRUCTURED_SECTION_IDS) {
        next[id] = emptySlice(action.bases[id] ?? '');
      }
      return next;
    }
    case 'RESET_FROM_PERSISTED': {
      const next = {} as StructuredSectionsRevisionState;
      for (const id of AGENT_STRUCTURED_SECTION_IDS) {
        const row = action.persisted[id];
        next[id] = row ? sliceFromPersisted(row) : emptySlice('');
      }
      return next;
    }
    case 'DELETE_RANGE': {
      const { sectionId, start, end } = action;
      const slice = state[sectionId];
      const base = slice.promptBaseText;
      const n = [...slice.deletedMask];
      const hi = Math.min(end, base.length);
      const lo = Math.max(0, start);
      const newOps: StructuredRefinementOp[] = [];
      let i = lo;
      while (i < hi) {
        if (i >= n.length || n[i]) {
          i++;
          continue;
        }
        const runStart = i;
        while (i < hi && i < n.length && !n[i]) {
          n[i] = true;
          i++;
        }
        const runEnd = i;
        newOps.push({
          type: 'delete',
          start: runStart,
          end: runEnd,
          text: base.slice(runStart, runEnd),
        });
      }
      if (newOps.length === 0) {
        return state;
      }
      return {
        ...state,
        [sectionId]: {
          ...slice,
          deletedMask: n,
          refinementOpLog: [...slice.refinementOpLog, ...newOps],
        },
      };
    }
    case 'INSERT': {
      const { sectionId, position, text } = action;
      const slice = state[sectionId];
      const pos = Math.max(0, Math.min(position, slice.promptBaseText.length));
      const id =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `ins-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const op: InsertOp = { id, position: pos, text };
      return {
        ...state,
        [sectionId]: {
          ...slice,
          inserts: [...slice.inserts, op],
          refinementOpLog: [...slice.refinementOpLog, { type: 'insert', position: pos, text }],
        },
      };
    }
    case 'APPLY_REVISION_OPS': {
      const { sectionId, ops } = action;
      if (!ops.length) {
        return state;
      }
      const slice = state[sectionId];
      const nextSlice = applyRevisionBatchToSlice(slice, ops);
      return {
        ...state,
        [sectionId]: nextSlice,
      };
    }
    default:
      return state;
  }
}
