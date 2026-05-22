/**
 * Tab order for the review portal workspace (distinct from Omnia wizard order).
 */

export const REVIEW_PORTAL_STEP_IDS = [
  'task',
  'knowledge_base',
  'backend',
  'prompts',
  'conversation',
] as const;

export type ReviewPortalStepId = (typeof REVIEW_PORTAL_STEP_IDS)[number];

export const REVIEW_PORTAL_STEP_LABELS: Record<ReviewPortalStepId, string> = {
  task: 'Task',
  knowledge_base: 'Knowledge Base',
  backend: 'Backend',
  prompts: 'Prompts',
  conversation: 'Conversation',
};
