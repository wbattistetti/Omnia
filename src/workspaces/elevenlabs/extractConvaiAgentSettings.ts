/**
 * Maps ConvAI `conversation_config` (+ workflow flags) to Omnia-neutral agent settings.
 */

import type { WorkspaceAgentSettings } from '../core/types';

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function readString(obj: Record<string, unknown> | null, ...keys: string[]): string {
  if (!obj) return '';
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

/**
 * Builds read-only agent settings for the «Agente» tab.
 */
export function extractConvaiAgentSettings(
  conversationConfig: unknown,
  workflowRoot?: unknown
): WorkspaceAgentSettings {
  const cc = asRecord(conversationConfig);
  const agent = asRecord(cc?.agent);
  const promptObj = asRecord(agent?.prompt);
  const globalPrompt = readString(promptObj, 'prompt');

  const firstMessage = readString(agent, 'first_message', 'firstMessage');
  const language = readString(agent, 'language');

  const llmBlock = asRecord(agent?.llm) ?? asRecord(cc?.llm);
  const llm =
    readString(llmBlock, 'model') ||
    readString(agent, 'llm_model', 'llmModel') ||
    readString(cc, 'llm_model', 'llmModel');

  const tts = asRecord(agent?.tts) ?? asRecord(cc?.tts);
  const voiceId =
    readString(tts, 'voice_id', 'voiceId') || readString(agent, 'voice_id', 'voiceId');
  const ttsModel = readString(tts, 'model') || readString(agent, 'tts_model', 'ttsModel');

  const wf = asRecord(workflowRoot) ?? asRecord(cc?.workflow);
  const preventSubagentLoops = wf?.prevent_subagent_loops === true || wf?.preventSubagentLoops === true;

  return {
    globalPrompt,
    firstMessage,
    language,
    llm,
    voiceId,
    ttsModel,
    preventSubagentLoops,
  };
}
