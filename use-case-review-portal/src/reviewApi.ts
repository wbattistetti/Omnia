/**
 * Re-export del client HTTP unificato (@services/agentReviewChannelApi).
 */

export {
  fetchAgentReviewChannel,
  listReviewChannels,
  saveAgentReviewChannel,
  type ReviewChannelListItem,
} from '@services/agentReviewChannelApi';

export type { AgentReviewChannelDocument } from '@domain/agentReviewChannel/reviewDocument';

import { fetchAgentReviewChannel, saveAgentReviewChannel } from '@services/agentReviewChannelApi';
import { reviewApiBase } from './reviewConfig';
import { reviewAuthToken } from './reviewAuth';

function portalApiBase(): string {
  return reviewApiBase();
}

/** @deprecated Prefer `fetchAgentReviewChannel` from `@services/agentReviewChannelApi`. */
export async function loadReviewChannel(projectId: string, taskId: string) {
  const { document } = await fetchAgentReviewChannel({
    projectId,
    taskInstanceId: taskId,
    token: reviewAuthToken(),
    apiBase: portalApiBase(),
  });
  return document;
}

/** @deprecated Prefer `saveAgentReviewChannel` from `@services/agentReviewChannelApi`. */
export async function saveReviewChannel(
  projectId: string,
  taskId: string,
  document: import('@domain/agentReviewChannel/reviewDocument').AgentReviewChannelDocument
): Promise<void> {
  await saveAgentReviewChannel({
    projectId,
    taskInstanceId: taskId,
    document,
    token: reviewAuthToken(),
    apiBase: portalApiBase(),
    source: 'portal',
  });
}
