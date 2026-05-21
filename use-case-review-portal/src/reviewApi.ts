/**
 * Client HTTP per il canale review (proxy Vite → Express :3100).
 */

import type { AgentReviewChannelDocument } from '@domain/agentReviewChannel/reviewDocument';
import { parseAgentReviewDocument } from '@domain/agentReviewChannel/reviewDocument';
import { reviewApiBase, reviewAuthToken } from './reviewConfig';

export interface ReviewChannelListItem {
  projectId: string;
  projectLabel: string;
  taskInstanceId: string;
  taskLabel: string;
  updatedAt: string | null;
  useCaseCount: number;
}

function headers(): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = reviewAuthToken();
  if (token) h['X-Review-Token'] = token;
  return h;
}

function apiUrl(path: string): string {
  const base = reviewApiBase();
  return base ? `${base}${path}` : path;
}

export async function listReviewChannels(): Promise<ReviewChannelListItem[]> {
  const res = await fetch(apiUrl('/api/agent-review-channels'), { headers: headers() });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const data = (await res.json()) as { items?: ReviewChannelListItem[] };
  return Array.isArray(data.items) ? data.items : [];
}

export async function loadReviewChannel(
  projectId: string,
  taskId: string
): Promise<AgentReviewChannelDocument | null> {
  const path = `/api/projects/${encodeURIComponent(projectId)}/agent-tasks/${encodeURIComponent(taskId)}/review-channel`;
  const res = await fetch(apiUrl(path), { headers: headers() });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const data = (await res.json()) as { document?: unknown };
  return data.document ? parseAgentReviewDocument(data.document) : null;
}

export async function saveReviewChannel(
  projectId: string,
  taskId: string,
  document: AgentReviewChannelDocument
): Promise<void> {
  const path = `/api/projects/${encodeURIComponent(projectId)}/agent-tasks/${encodeURIComponent(taskId)}/review-channel`;
  const res = await fetch(apiUrl(path), {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ document }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
}
