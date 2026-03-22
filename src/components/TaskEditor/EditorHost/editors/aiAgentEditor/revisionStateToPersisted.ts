/**
 * Maps in-memory structured section revision state to a persistable JSON shape.
 */

import type { AgentStructuredSectionId } from './agentStructuredSectionIds';
import { AGENT_STRUCTURED_SECTION_IDS } from './agentStructuredSectionIds';
import type { PersistedStructuredSections } from './structuredSectionPersist';
import type { StructuredSectionsRevisionState } from './structuredSectionsRevisionReducer';

export function revisionStateToPersisted(state: StructuredSectionsRevisionState): PersistedStructuredSections {
  const out = {} as PersistedStructuredSections;
  for (const id of AGENT_STRUCTURED_SECTION_IDS) {
    const s = state[id];
    out[id as AgentStructuredSectionId] = {
      base: s.promptBaseText,
      deletedMask: [...s.deletedMask],
      inserts: s.inserts.map((x) => ({ ...x })),
    };
  }
  return out;
}
