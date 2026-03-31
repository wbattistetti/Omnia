/**
 * Resolves which template id to use with DialogueTaskService / catalogue cache for a tree node.
 */

import type { TaskTreeNode } from '@types/taskTypes';

/** Prefer `catalogTemplateId` when the node splits graph id vs catalogue id. */
export function catalogueLookupTemplateId(node: TaskTreeNode): string {
  const raw = node.catalogTemplateId ?? node.templateId;
  return typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim();
}
