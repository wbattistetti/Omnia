/**
 * Destinatari del canale review (pubblicazione per task agente).
 */

export const AGENT_REVIEW_AUDIENCES = ['customer', 'internal', 'auditing'] as const;

export type AgentReviewAudience = (typeof AGENT_REVIEW_AUDIENCES)[number];

/** Audience mostrate nel menu «Pubblica for review» (customer + internal auditing team). */
export const REVIEW_PUBLISH_AUDIENCES = ['customer', 'internal'] as const;

export type ReviewPublishAudience = (typeof REVIEW_PUBLISH_AUDIENCES)[number];

export function isReviewPublishAudience(value: unknown): value is ReviewPublishAudience {
  return (
    typeof value === 'string' &&
    (REVIEW_PUBLISH_AUDIENCES as readonly string[]).includes(value)
  );
}

export function isAgentReviewAudience(value: unknown): value is AgentReviewAudience {
  return (
    typeof value === 'string' &&
    (AGENT_REVIEW_AUDIENCES as readonly string[]).includes(value)
  );
}

export function normalizeReviewAudience(value: unknown): AgentReviewAudience {
  return isAgentReviewAudience(value) ? value : 'customer';
}

export const REVIEW_AUDIENCE_LABELS: Record<AgentReviewAudience, string> = {
  customer: 'Customer',
  internal: 'Internal',
  auditing: 'Auditing team',
};
