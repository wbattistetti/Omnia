/**
 * Converte sezioni strutturate dal documento review in snapshot v1 per il task Omnia.
 */

import type { AgentReviewStructuredSections } from '@domain/agentReviewChannel/reviewDocument';
import type { PersistedStructuredSections, PersistedSectionSnapshotV1 } from './structuredSectionPersist';
import { AGENT_STRUCTURED_SECTION_IDS } from './agentStructuredSectionIds';
import {
  DEFAULT_CONSTRAINTS_SECTION_TEXT,
  DEFAULT_PERSONALITY_SECTION_TEXT,
  DEFAULT_TONE_SECTION_TEXT,
} from './agentStructuredSectionDefaults';

function snapshotFromText(text: string): PersistedSectionSnapshotV1 {
  return {
    base: text,
    deletedMask: new Array(text.length).fill(false),
    inserts: [],
  };
}

const DEFAULT_SECTION_TEXT: Partial<Record<(typeof AGENT_STRUCTURED_SECTION_IDS)[number], string>> = {
  constraints: DEFAULT_CONSTRAINTS_SECTION_TEXT,
  personality: DEFAULT_PERSONALITY_SECTION_TEXT,
  tone: DEFAULT_TONE_SECTION_TEXT,
};

/** Builds persisted structured sections from review document fields (import round-trip). */
export function persistedSectionsFromReviewImport(
  reviewSections: AgentReviewStructuredSections | undefined
): PersistedStructuredSections {
  const out = {} as PersistedStructuredSections;
  for (const id of AGENT_STRUCTURED_SECTION_IDS) {
    const fromReview = reviewSections?.[id];
    const text =
      typeof fromReview === 'string'
        ? fromReview
        : DEFAULT_SECTION_TEXT[id] ?? '';
    out[id] = snapshotFromText(text);
  }
  return out;
}
