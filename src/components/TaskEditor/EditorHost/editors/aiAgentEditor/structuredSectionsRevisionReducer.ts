/**
 * Reducer: independent revision state per structured AI Agent section.
 */

import type { AgentStructuredSectionId } from './agentStructuredSectionIds';
import { AGENT_STRUCTURED_SECTION_IDS } from './agentStructuredSectionIds';
import { effectiveFromRevisionMask, type InsertOp } from './effectiveFromRevisionMask';
import { baseRelativeDiffToRefinementOps } from './otRefinementPatch';
import { commitOperations } from './otTextDocument';
import type { OtOp, OtTextDocument } from './otTypes';
import { createOtDocument } from './otTextDocument';
import type { PersistedSectionSnapshot, PersistedSectionSnapshotV2, PersistedStructuredSections } from './structuredSectionPersist';
import type { StructuredRefinementOp } from './structuredRefinementOps';
import { applyRevisionBatchToSlice } from './applyRevisionBatchToSlice';
import type { RevisionBatchOp } from './textRevisionLinear';
import { diffToOps } from './otDiffToOps';
import { formatOperationalSequenceNewlines } from './operationalSequenceDisplay';

export interface StructuredSectionRevisionSlice {
  promptBaseText: string;
  deletedMask: boolean[];
  inserts: InsertOp[];
  refinementOpLog: StructuredRefinementOp[];
  /** Linear: mask/inserts; OT: {@link ot} is authoritative for effective text. */
  storageMode: 'linear' | 'ot';
  ot: OtTextDocument | null;
}

export type StructuredSectionsRevisionState = Record<
  AgentStructuredSectionId,
  StructuredSectionRevisionSlice
>;

export type StructuredSectionsRevisionAction =
  | { type: 'RESET_ALL'; bases: Record<AgentStructuredSectionId, string>; structuredOt?: boolean }
  | { type: 'RESET_FROM_PERSISTED'; persisted: PersistedStructuredSections }
  | { type: 'DELETE_RANGE'; sectionId: AgentStructuredSectionId; start: number; end: number }
  | { type: 'INSERT'; sectionId: AgentStructuredSectionId; position: number; text: string }
  | { type: 'APPLY_REVISION_OPS'; sectionId: AgentStructuredSectionId; ops: readonly RevisionBatchOp[] }
  | { type: 'APPLY_OT_COMMIT'; sectionId: AgentStructuredSectionId; newOps: readonly OtOp[] }
  /** Replaces one section with a full snapshot (undo/redo). */
  | {
      type: 'RESTORE_SECTION_SNAPSHOT';
      sectionId: AgentStructuredSectionId;
      slice: StructuredSectionRevisionSlice;
    };

function isPersistedV2(p: PersistedSectionSnapshot): p is PersistedSectionSnapshotV2 {
  return (p as PersistedSectionSnapshotV2).version === 2;
}

function emptySlice(base: string): StructuredSectionRevisionSlice {
  return {
    promptBaseText: base,
    deletedMask: new Array(Math.max(0, base.length)).fill(false),
    inserts: [],
    refinementOpLog: [],
    storageMode: 'linear',
    ot: null,
  };
}

function emptyOtSlice(base: string): StructuredSectionRevisionSlice {
  const ot = createOtDocument(base);
  return {
    promptBaseText: base,
    deletedMask: new Array(Math.max(0, base.length)).fill(false),
    inserts: [],
    refinementOpLog: [],
    storageMode: 'ot',
    ot,
  };
}

/**
 * Reformats operational_sequence with newlines between steps when safe (OT: recompute op log;
 * linear: only when there are no mask/insert edits).
 */
function normalizeOperationalSequenceSlice(slice: StructuredSectionRevisionSlice): StructuredSectionRevisionSlice {
  if (slice.storageMode === 'ot' && slice.ot) {
    const baseF = formatOperationalSequenceNewlines(slice.ot.revisionBase);
    const curF = formatOperationalSequenceNewlines(slice.ot.currentText);
    if (baseF === slice.ot.revisionBase && curF === slice.ot.currentText) {
      return slice;
    }
    const opLog = diffToOps(baseF, curF);
    return {
      ...slice,
      promptBaseText: baseF,
      deletedMask: new Array(Math.max(0, baseF.length)).fill(false),
      inserts: [],
      refinementOpLog: baseRelativeDiffToRefinementOps(baseF, curF),
      ot: {
        revisionBase: baseF,
        opLog,
        currentText: curF,
      },
    };
  }
  const hasEdits = slice.deletedMask.some(Boolean) || slice.inserts.length > 0;
  if (hasEdits) {
    return slice;
  }
  const baseF = formatOperationalSequenceNewlines(slice.promptBaseText);
  if (baseF === slice.promptBaseText) {
    return slice;
  }
  return {
    ...slice,
    promptBaseText: baseF,
    deletedMask: new Array(Math.max(0, baseF.length)).fill(false),
  };
}

function effectiveTextFromSlice(slice: StructuredSectionRevisionSlice): string {
  if (slice.storageMode === 'ot' && slice.ot) {
    return slice.ot.currentText;
  }
  return effectiveFromRevisionMask(slice.promptBaseText, slice.deletedMask, slice.inserts);
}

/**
 * Materializes the same effective section bodies as {@link RESET_FROM_PERSISTED} without dispatching.
 * Used to compare persisted `runtime_compact` vs deterministic Phase-2 output after repository load.
 */
export function effectiveBySectionFromPersistedStructured(
  persisted: PersistedStructuredSections
): Record<AgentStructuredSectionId, string> {
  const state = {} as StructuredSectionsRevisionState;
  for (const id of AGENT_STRUCTURED_SECTION_IDS) {
    const row = persisted[id];
    let slice = row ? sliceFromPersisted(row) : emptySlice('');
    if (id === 'operational_sequence') {
      slice = normalizeOperationalSequenceSlice(slice);
    }
    state[id] = slice;
  }
  const eff = {} as Record<AgentStructuredSectionId, string>;
  for (const id of AGENT_STRUCTURED_SECTION_IDS) {
    eff[id] = effectiveTextFromSlice(state[id]);
  }
  return eff;
}

function sliceFromPersisted(p: PersistedSectionSnapshot): StructuredSectionRevisionSlice {
  if (isPersistedV2(p)) {
    const ot = {
      revisionBase: p.revisionBase,
      opLog: p.opLog,
      currentText: p.currentText,
    };
    const base = ot.revisionBase;
    return {
      promptBaseText: base,
      deletedMask: new Array(Math.max(0, base.length)).fill(false),
      inserts: [],
      refinementOpLog: baseRelativeDiffToRefinementOps(base, ot.currentText),
      storageMode: 'ot',
      ot,
    };
  }
  const base = p.base;
  const dm = [...p.deletedMask];
  while (dm.length < base.length) dm.push(false);
  if (dm.length > base.length) dm.length = base.length;
  return {
    promptBaseText: base,
    deletedMask: dm,
    inserts: p.inserts.map((x) => ({ ...x })),
    refinementOpLog: [],
    storageMode: 'linear',
    ot: null,
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
      const useOt = action.structuredOt === true;
      for (const id of AGENT_STRUCTURED_SECTION_IDS) {
        let b = action.bases[id] ?? '';
        if (id === 'operational_sequence') {
          b = formatOperationalSequenceNewlines(b);
        }
        next[id] = useOt ? emptyOtSlice(b) : emptySlice(b);
      }
      return next;
    }
    case 'RESET_FROM_PERSISTED': {
      const next = {} as StructuredSectionsRevisionState;
      for (const id of AGENT_STRUCTURED_SECTION_IDS) {
        const row = action.persisted[id];
        let slice = row ? sliceFromPersisted(row) : emptySlice('');
        if (id === 'operational_sequence') {
          slice = normalizeOperationalSequenceSlice(slice);
        }
        next[id] = slice;
      }
      return next;
    }
    case 'DELETE_RANGE': {
      const { sectionId, start, end } = action;
      const slice = state[sectionId];
      if (slice.storageMode === 'ot') {
        return state;
      }
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
      if (slice.storageMode === 'ot') {
        return state;
      }
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
      if (slice.storageMode === 'ot') {
        return state;
      }
      const nextSlice = applyRevisionBatchToSlice(slice, ops);
      return {
        ...state,
        [sectionId]: nextSlice,
      };
    }
    case 'APPLY_OT_COMMIT': {
      const { sectionId, newOps } = action;
      if (!newOps.length) {
        return state;
      }
      const slice = state[sectionId];
      if (slice.storageMode !== 'ot' || !slice.ot) {
        return state;
      }
      const nextOt = commitOperations(slice.ot, newOps);
      const base = nextOt.revisionBase;
      return {
        ...state,
        [sectionId]: {
          ...slice,
          promptBaseText: base,
          deletedMask: new Array(Math.max(0, base.length)).fill(false),
          inserts: [],
          refinementOpLog: baseRelativeDiffToRefinementOps(base, nextOt.currentText),
          storageMode: 'ot',
          ot: nextOt,
        },
      };
    }
    case 'RESTORE_SECTION_SNAPSHOT': {
      const { sectionId, slice } = action;
      return {
        ...state,
        [sectionId]: slice,
      };
    }
    default:
      return state;
  }
}
