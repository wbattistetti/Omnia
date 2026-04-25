/**
 * Parse and normalize unknown JSON into a full {@link IAAgentConfig}.
 */

import type {
  IAAgentConfig,
  IAAgentPlatform,
  IAAgentVoiceEntry,
  ToolDefinition,
} from 'types/iaAgentRuntimeSetup';
import { getDefaultConfig } from './platformHelpers';

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

const PLATFORMS: IAAgentPlatform[] = ['elevenlabs', 'openai', 'anthropic', 'google', 'custom'];

function parseVoiceEntries(x: unknown): IAAgentVoiceEntry[] | undefined {
  if (!Array.isArray(x)) return undefined;
  const out: IAAgentVoiceEntry[] = [];
  for (const item of x) {
    if (!isRecord(item)) continue;
    const id = typeof item.id === 'string' ? item.id : '';
    const role = item.role === 'primary' || item.role === 'secondary' ? item.role : 'secondary';
    out.push({ id, role });
  }
  return out.length ? out : undefined;
}

function parseTools(x: unknown): ToolDefinition[] {
  if (!Array.isArray(x)) return [];
  const out: ToolDefinition[] = [];
  for (const item of x) {
    if (!isRecord(item)) continue;
    const name = typeof item.name === 'string' ? item.name : '';
    const description = typeof item.description === 'string' ? item.description : '';
    const schema = item.inputSchema;
    const inputSchema = isRecord(schema) ? schema : {};
    if (name) out.push({ name, description, inputSchema });
  }
  return out;
}

/**
 * Merge partial persisted JSON with defaults for the resolved platform.
 */
export function normalizeIAAgentConfig(raw: unknown): IAAgentConfig {
  const platform: IAAgentPlatform =
    isRecord(raw) && typeof raw.platform === 'string' && PLATFORMS.includes(raw.platform as IAAgentPlatform)
      ? (raw.platform as IAAgentPlatform)
      : 'openai';
  const base = getDefaultConfig(platform);
  if (!isRecord(raw)) return base;

  const model = typeof raw.model === 'string' ? raw.model : base.model;
  const temperature =
    typeof raw.temperature === 'number' && !Number.isNaN(raw.temperature)
      ? raw.temperature
      : base.temperature;
  const maxTokens =
    typeof raw.maxTokens === 'number' && raw.maxTokens > 0 ? Math.floor(raw.maxTokens) : base.maxTokens;
  const allowed: IAAgentConfig['reasoning'][] = ['none', 'low', 'medium', 'high'];
  const reasoning = allowed.includes(raw.reasoning as IAAgentConfig['reasoning'])
    ? (raw.reasoning as IAAgentConfig['reasoning'])
    : base.reasoning;
  const systemPrompt = typeof raw.systemPrompt === 'string' ? raw.systemPrompt : base.systemPrompt;
  const tools = Array.isArray(raw.tools) ? parseTools(raw.tools) : base.tools;
  let voice =
    raw.voice && isRecord(raw.voice)
      ? {
          id: typeof raw.voice.id === 'string' ? raw.voice.id : '',
          language: typeof raw.voice.language === 'string' ? raw.voice.language : 'en',
          languages: Array.isArray(raw.voice.languages)
            ? [...new Set(raw.voice.languages.filter((x): x is string => typeof x === 'string'))]
            : undefined,
          settings:
            raw.voice.settings && isRecord(raw.voice.settings) ? { ...raw.voice.settings } : undefined,
        }
      : base.voice;
  let voices = parseVoiceEntries(raw.voices);
  if (platform === 'elevenlabs' && !voices && voice?.id) {
    voices = [{ id: voice.id, role: 'primary' }];
  }
  if (platform === 'elevenlabs' && voices) {
    const pr = voices.find((e) => e.role === 'primary');
    if (pr?.id && voice) {
      voice = { ...voice, id: pr.id };
    }
  }
  const advanced =
    raw.advanced && isRecord(raw.advanced) ? { ...base.advanced, ...raw.advanced } : base.advanced;

  const ttsModelRaw = raw.ttsModel;
  const ttsModel =
    platform === 'elevenlabs'
      ? (typeof ttsModelRaw === 'string' ? ttsModelRaw : (base as IAAgentConfig).ttsModel ?? '').trim()
      : undefined;

  const convaiAgentIdRaw = raw.convaiAgentId;
  const elevenLabsBackendBaseUrlRaw = raw.elevenLabsBackendBaseUrl;
  const convaiAgentId =
    typeof convaiAgentIdRaw === 'string' && convaiAgentIdRaw.trim().length > 0
      ? convaiAgentIdRaw.trim()
      : undefined;
  const elevenLabsBackendBaseUrl =
    typeof elevenLabsBackendBaseUrlRaw === 'string' && elevenLabsBackendBaseUrlRaw.trim().length > 0
      ? elevenLabsBackendBaseUrlRaw.trim()
      : undefined;

  const elevenLabsNeedsReprovision =
    platform === 'elevenlabs' && raw.elevenLabsNeedsReprovision === true;

  return {
    platform,
    model,
    temperature,
    maxTokens,
    reasoning,
    systemPrompt,
    tools,
    voice: platform === 'elevenlabs' ? voice : undefined,
    voices: platform === 'elevenlabs' ? voices ?? base.voices : undefined,
    ...(platform === 'elevenlabs'
      ? {
          ttsModel: ttsModel ?? '',
          ...(elevenLabsNeedsReprovision ? { elevenLabsNeedsReprovision: true as const } : {}),
        }
      : {}),
    convaiAgentId,
    elevenLabsBackendBaseUrl,
    advanced,
  };
}

/**
 * ConvAI `agent_id` non viene più ereditato dai default globali sul task: resta solo in sessione tab
 * dopo provisioning. Mantiene la firma per i call site esistenti.
 */
export function mergeConvaiAgentIdFromGlobalDefaults(
  taskOverride: IAAgentConfig,
  _globalDefaults: IAAgentConfig
): IAAgentConfig {
  return taskOverride;
}

/**
 * Serializza override IA per `agentIaRuntimeOverrideJson` senza `convaiAgentId` (mai persistito).
 */
export function serializeIaAgentConfigForTaskPersistence(cfg: IAAgentConfig): string {
  const n = normalizeIAAgentConfig(cfg);
  const plain = { ...(n as Record<string, unknown>) };
  delete plain.convaiAgentId;
  return JSON.stringify(plain);
}

/**
 * Parses persisted `agentIaRuntimeOverrideJson`; returns null if missing or invalid JSON.
 */
export function parseOptionalIaRuntimeJson(raw: string | undefined | null): unknown | null {
  const t = typeof raw === 'string' ? raw.trim() : '';
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}
