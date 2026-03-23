/**
 * Hook: per-section revision state for structured AI Agent design (textarea revision + refine patches).
 * Tracks undo/redo stacks (snapshot per commit) for APPLY_REVISION_OPS and APPLY_OT_COMMIT.
 */

import React from 'react';
import type { AgentStructuredSectionId } from './agentStructuredSectionIds';
import { AGENT_STRUCTURED_SECTION_IDS } from './agentStructuredSectionIds';
import { composeRuntimePromptMarkdown } from './composeRuntimePromptMarkdown';
import type { OtOp } from './otTypes';
import type { PersistedStructuredSections } from './structuredSectionPersist';
import { getStructuredSectionEffectiveText } from './structuredSectionEffective';
import {
  createInitialStructuredSectionsState,
  structuredSectionsRevisionReducer,
  type StructuredSectionRevisionSlice,
  type StructuredSectionsRevisionState,
} from './structuredSectionsRevisionReducer';
import type { StructuredRefinementOp } from './structuredRefinementOps';
import type { RevisionBatchOp } from './textRevisionLinear';
import { cloneStructuredSectionSlice } from './structuredSectionSliceClone';

const MAX_UNDO_DEPTH = 50;

export interface SectionRefinementBundle {
  sectionId: AgentStructuredSectionId;
  baseText: string;
  refinementPatch: StructuredRefinementOp[];
}

export interface UseStructuredAgentSectionsRevisionResult {
  sectionsState: StructuredSectionsRevisionState;
  effectiveBySection: Record<AgentStructuredSectionId, string>;
  composedRuntimeMarkdown: string;
  resetAllFromApiBases: (bases: Record<AgentStructuredSectionId, string>) => void;
  loadFromPersisted: (p: PersistedStructuredSections) => void;
  applyDeleteRange: (sectionId: AgentStructuredSectionId, start: number, end: number) => void;
  applyInsert: (sectionId: AgentStructuredSectionId, position: number, text: string) => void;
  applyRevisionOps: (sectionId: AgentStructuredSectionId, ops: readonly RevisionBatchOp[]) => void;
  applyOtCommit: (sectionId: AgentStructuredSectionId, newOps: readonly OtOp[]) => void;
  /** Restores previous snapshot for this section (Ctrl+Z). */
  undoSection: (sectionId: AgentStructuredSectionId) => void;
  /** Restores next snapshot after undo (Ctrl+Y). */
  redoSection: (sectionId: AgentStructuredSectionId) => void;
  collectRefinementBundles: () => SectionRefinementBundle[];
}

type SectionStackMap = Partial<Record<AgentStructuredSectionId, StructuredSectionRevisionSlice[]>>;

function pushPast(map: SectionStackMap, sectionId: AgentStructuredSectionId, snapshot: StructuredSectionRevisionSlice): void {
  const arr = map[sectionId] ?? [];
  const next = [...arr, snapshot];
  while (next.length > MAX_UNDO_DEPTH) {
    next.shift();
  }
  map[sectionId] = next;
}

export function useStructuredAgentSectionsRevision(
  structuredOtEnabled: boolean
): UseStructuredAgentSectionsRevisionResult {
  const [sectionsState, dispatch] = React.useReducer(
    structuredSectionsRevisionReducer,
    undefined,
    () =>
      createInitialStructuredSectionsState(
        Object.fromEntries(AGENT_STRUCTURED_SECTION_IDS.map((id) => [id, ''])) as Record<
          AgentStructuredSectionId,
          string
        >
      )
  );

  const sectionsStateRef = React.useRef(sectionsState);
  sectionsStateRef.current = sectionsState;

  const pastRef = React.useRef<SectionStackMap>({});
  const futureRef = React.useRef<SectionStackMap>({});

  const clearAllHistory = React.useCallback(() => {
    pastRef.current = {};
    futureRef.current = {};
  }, []);

  const effectiveBySection = React.useMemo(() => {
    const out = {} as Record<AgentStructuredSectionId, string>;
    for (const id of AGENT_STRUCTURED_SECTION_IDS) {
      const s = sectionsState[id];
      out[id] = getStructuredSectionEffectiveText(s);
    }
    return out;
  }, [sectionsState]);

  const composedRuntimeMarkdown = React.useMemo(
    () => composeRuntimePromptMarkdown(effectiveBySection),
    [effectiveBySection]
  );

  const resetAllFromApiBases = React.useCallback(
    (bases: Record<AgentStructuredSectionId, string>) => {
      clearAllHistory();
      dispatch({ type: 'RESET_ALL', bases, structuredOt: structuredOtEnabled });
    },
    [clearAllHistory, structuredOtEnabled]
  );

  const loadFromPersisted = React.useCallback(
    (p: PersistedStructuredSections) => {
      clearAllHistory();
      dispatch({ type: 'RESET_FROM_PERSISTED', persisted: p });
    },
    [clearAllHistory]
  );

  const applyDeleteRange = React.useCallback(
    (sectionId: AgentStructuredSectionId, start: number, end: number) => {
      dispatch({ type: 'DELETE_RANGE', sectionId, start, end });
    },
    []
  );

  const applyInsert = React.useCallback(
    (sectionId: AgentStructuredSectionId, position: number, text: string) => {
      dispatch({ type: 'INSERT', sectionId, position, text });
    },
    []
  );

  const applyRevisionOps = React.useCallback(
    (sectionId: AgentStructuredSectionId, ops: readonly RevisionBatchOp[]) => {
      if (!ops.length) {
        return;
      }
      const before = cloneStructuredSectionSlice(sectionsStateRef.current[sectionId]);
      pushPast(pastRef.current, sectionId, before);
      futureRef.current[sectionId] = [];
      dispatch({ type: 'APPLY_REVISION_OPS', sectionId, ops });
    },
    []
  );

  const applyOtCommit = React.useCallback(
    (sectionId: AgentStructuredSectionId, newOps: readonly OtOp[]) => {
      if (!newOps.length) {
        return;
      }
      const before = cloneStructuredSectionSlice(sectionsStateRef.current[sectionId]);
      pushPast(pastRef.current, sectionId, before);
      futureRef.current[sectionId] = [];
      dispatch({ type: 'APPLY_OT_COMMIT', sectionId, newOps });
    },
    []
  );

  const undoSection = React.useCallback((sectionId: AgentStructuredSectionId) => {
    const past = pastRef.current[sectionId];
    if (!past || past.length === 0) {
      return;
    }
    const target = past[past.length - 1];
    pastRef.current[sectionId] = past.slice(0, -1);
    const current = cloneStructuredSectionSlice(sectionsStateRef.current[sectionId]);
    const fut = futureRef.current[sectionId] ?? [];
    futureRef.current[sectionId] = [...fut, current];
    dispatch({ type: 'RESTORE_SECTION_SNAPSHOT', sectionId, slice: target });
  }, []);

  const redoSection = React.useCallback((sectionId: AgentStructuredSectionId) => {
    const fut = futureRef.current[sectionId];
    if (!fut || fut.length === 0) {
      return;
    }
    const target = fut[fut.length - 1];
    futureRef.current[sectionId] = fut.slice(0, -1);
    const current = cloneStructuredSectionSlice(sectionsStateRef.current[sectionId]);
    pushPast(pastRef.current, sectionId, current);
    dispatch({ type: 'RESTORE_SECTION_SNAPSHOT', sectionId, slice: target });
  }, []);

  const collectRefinementBundles = React.useCallback((): SectionRefinementBundle[] => {
    return AGENT_STRUCTURED_SECTION_IDS.map((sectionId) => {
      const s = sectionsState[sectionId];
      return {
        sectionId,
        baseText: s.promptBaseText,
        refinementPatch: s.refinementOpLog,
      };
    });
  }, [sectionsState]);

  return React.useMemo(
    () => ({
      sectionsState,
      effectiveBySection,
      composedRuntimeMarkdown,
      resetAllFromApiBases,
      loadFromPersisted,
      applyDeleteRange,
      applyInsert,
      applyRevisionOps,
      applyOtCommit,
      undoSection,
      redoSection,
      collectRefinementBundles,
    }),
    [
      sectionsState,
      effectiveBySection,
      composedRuntimeMarkdown,
      resetAllFromApiBases,
      loadFromPersisted,
      applyDeleteRange,
      applyInsert,
      applyRevisionOps,
      applyOtCommit,
      undoSection,
      redoSection,
      collectRefinementBundles,
    ]
  );
}
