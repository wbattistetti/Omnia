/**
 * Client for design-time AI Agent generation (Node backend /design/ai-agent-generate).
 */

import type { AIAgentDesignApiError, AIAgentDesignApiSuccess, AIAgentDesignPayload } from '@types/aiAgentDesign';

export interface GenerateAIAgentDesignParams {
  userDesc: string;
  provider: string;
  model: string;
}

const DEFAULT_TIMEOUT_MS = 120000;

export async function generateAIAgentDesign(
  params: GenerateAIAgentDesignParams
): Promise<AIAgentDesignPayload> {
  const { userDesc, provider, model } = params;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch('/design/ai-agent-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userDesc,
        provider: provider.toLowerCase(),
        model,
      }),
      signal: controller.signal,
    });
    const body = (await res.json()) as AIAgentDesignApiSuccess | AIAgentDesignApiError;
    if (!res.ok || !body.success) {
      const err = body as AIAgentDesignApiError;
      const msg = err.error || `HTTP ${res.status}`;
      const extra = err.rawSnippet ? ` — snippet: ${err.rawSnippet.slice(0, 200)}` : '';
      throw new Error(msg + extra);
    }
    return body.design;
  } finally {
    clearTimeout(timeout);
  }
}
