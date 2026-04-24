/**
 * Calls Omnia ApiServer POST /elevenlabs/createAgent (proxies ElevenLabs ConvAI agents/create).
 * API key stays server-side via ELEVENLABS_API_KEY.
 */

export type CreateConvaiAgentViaOmniaParams = {
  /** Optional label for ElevenLabs agent display name */
  name?: string;
  /**
   * Partial ElevenLabs `conversation_config` merged into Omnia defaults on ApiServer
   * (voice, language, prompt/llm from IA Runtime).
   */
  conversation_config?: Record<string, unknown>;
};

export type CreateConvaiAgentViaOmniaResult = {
  agentId: string;
};

export async function createConvaiAgentViaOmniaServer(
  params?: CreateConvaiAgentViaOmniaParams
): Promise<CreateConvaiAgentViaOmniaResult> {
  const body: Record<string, unknown> = {};
  if (params?.name?.trim()) body.name = params.name.trim();
  if (params?.conversation_config && typeof params.conversation_config === 'object') {
    body.conversation_config = params.conversation_config;
  }

  const res = await fetch('/elevenlabs/createAgent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text.trim() ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new Error(`createAgent: invalid JSON (${res.status})`);
  }

  if (!res.ok) {
    const details = typeof data.details === 'string' ? data.details : JSON.stringify(data);
    const err = typeof data.error === 'string' ? data.error : `HTTP ${res.status}`;
    const apiBase =
      typeof data.elevenLabsApiBase === 'string' && data.elevenLabsApiBase.trim().length > 0
        ? data.elevenLabsApiBase.trim()
        : '';
    const baseHint = apiBase ? ` [ElevenLabs API base: ${apiBase}]` : '';
    throw new Error(`${err}${details ? ` — ${details.slice(0, 500)}` : ''}${baseHint}`);
  }

  const agentId = typeof data.agentId === 'string' ? data.agentId.trim() : '';
  if (!agentId) {
    throw new Error('createAgent: response missing agentId');
  }

  return { agentId };
}
