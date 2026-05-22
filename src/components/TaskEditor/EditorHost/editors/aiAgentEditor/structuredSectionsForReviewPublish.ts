/**
 * Estrae le sezioni strutturate effettive da persistere nel documento review.
 */

import type { AgentReviewStructuredSections } from '@domain/agentReviewChannel/reviewDocument';
import { pickReviewStructuredSections } from '@domain/agentReviewChannel/reviewDocument';
import { parsePersistedStructuredSectionsJson } from './structuredSectionPersist';
import { effectiveBySectionFromPersistedStructured } from './structuredSectionsRevisionReducer';

export function structuredSectionsForReviewPublish(
  agentStructuredSectionsJson: string,
  agentPrompt: string
): AgentReviewStructuredSections | undefined {
  const parsed = parsePersistedStructuredSectionsJson(agentStructuredSectionsJson, agentPrompt);
  const effective = effectiveBySectionFromPersistedStructured(parsed.sections);
  return pickReviewStructuredSections(effective);
}
