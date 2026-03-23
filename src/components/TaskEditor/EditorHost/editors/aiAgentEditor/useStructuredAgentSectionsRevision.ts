/**
 * Hook: per-section revision state for structured AI Agent design (textarea revision + refine patches).
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
  type StructuredSectionsRevisionState,
} from './structuredSectionsRevisionReducer';
import type { StructuredRefinementOp } from './structuredRefinementOps';
import type { RevisionBatchOp } from './textRevisionLinear';

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
  collectRefinementBundles: () => SectionRefinementBundle[];
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
      dispatch({ type: 'RESET_ALL', bases, structuredOt: structuredOtEnabled });
    },
    [structuredOtEnabled]
  );

  const loadFromPersisted = React.useCallback((p: PersistedStructuredSections) => {
    dispatch({ type: 'RESET_FROM_PERSISTED', persisted: p });
  }, []);

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
      dispatch({ type: 'APPLY_REVISION_OPS', sectionId, ops });
    },
    []
  );

  const applyOtCommit = React.useCallback(
    (sectionId: AgentStructuredSectionId, newOps: readonly OtOp[]) => {
      dispatch({ type: 'APPLY_OT_COMMIT', sectionId, newOps });
    },
    []
  );

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
      collectRefinementBundles,
    ]
  );
}
