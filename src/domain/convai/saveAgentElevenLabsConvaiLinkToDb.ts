/**
 * Direct HTTP persist for ElevenLabs ConvAI agent link on AI Agent task.
 *
 * Writes `agentElevenLabsConvaiLinkJson` to Mongo via PUT task so KB purge ids
 * survive reload without an explicit project save.
 */

import type { AgentElevenLabsConvaiLink } from './agentElevenLabsConvaiLink';
import { serializeAgentElevenLabsConvaiLink } from './agentElevenLabsConvaiLink';

export type SaveAgentElevenLabsLinkResult =
  | { ok: true }
  | { ok: false; error: string };

/** Sends only `agentElevenLabsConvaiLinkJson` to the backend. */
export async function saveAgentElevenLabsConvaiLinkToDb(
  projectId: string,
  taskId: string,
  link: AgentElevenLabsConvaiLink
): Promise<SaveAgentElevenLabsLinkResult> {
  if (!projectId?.trim() || !taskId?.trim()) {
    return { ok: false, error: 'projectId o taskId mancanti' };
  }
  const linkJson = serializeAgentElevenLabsConvaiLink(link);
  try {
    const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentElevenLabsConvaiLinkJson: linkJson }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => String(res.status));
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
