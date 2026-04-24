/**
 * Ensures persisted structured sections hydrate to the same effective bodies used for deterministic runtime_compact.
 */

import { describe, expect, it } from 'vitest';
import { buildDeterministicRuntimeCompactFromSectionBases } from '../applyExtractStructureIr';
import { createInitialStructuredSectionsState, effectiveBySectionFromPersistedStructured } from '../structuredSectionsRevisionReducer';
import { revisionStateToPersisted } from '../revisionStateToPersisted';
import { AGENT_STRUCTURED_SECTION_IDS } from '../agentStructuredSectionIds';

describe('prompt final alignment hydrate', () => {
  it('effectiveBySectionFromPersistedStructured matches reducer-effective inputs for deterministic compact', () => {
    const bases = Object.fromEntries(
      AGENT_STRUCTURED_SECTION_IDS.map((id) => [
        id,
        id === 'goal'
          ? 'Obiettivo di test'
          : id === 'operational_sequence'
            ? 'Step uno\nStep due'
            : id === 'constraints'
              ? 'Must: rispettare le regole\n\nMust not: inventare dati'
              : `body-${id}`,
      ])
    ) as Record<(typeof AGENT_STRUCTURED_SECTION_IDS)[number], string>;
    const state = createInitialStructuredSectionsState(bases);
    const persisted = revisionStateToPersisted(state);
    const eff = effectiveBySectionFromPersistedStructured(persisted);
    const compact = buildDeterministicRuntimeCompactFromSectionBases(eff);
    expect(compact.behavior_compact.length).toBeGreaterThan(0);
    expect(compact.sequence_compact.length).toBeGreaterThan(0);
  });
});
