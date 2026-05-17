/**
 * Parses inline ConvAI tools from `conversation_config.agent.prompt` (legacy tools[] array).
 */

import type { WorkspaceResolvedTool, WorkspaceToolKind } from '../core/types';

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function normalizeKind(raw: string): WorkspaceToolKind {
  const t = raw.trim().toLowerCase();
  if (t === 'webhook') return 'webhook';
  if (t === 'client') return 'client';
  if (t === 'system') return 'system';
  if (t === 'api_integration_webhook') return 'api_integration_webhook';
  return 'unknown';
}

function readUrlFromApiSchema(schema: Record<string, unknown> | null): {
  url?: string;
  httpMethod?: string;
} {
  if (!schema) return {};
  const url = typeof schema.url === 'string' ? schema.url.trim() : '';
  const method =
    typeof schema.method === 'string'
      ? schema.method.trim().toUpperCase()
      : typeof schema.http_method === 'string'
        ? schema.http_method.trim().toUpperCase()
        : '';
  return {
    ...(url ? { url } : {}),
    ...(method ? { httpMethod: method } : {}),
  };
}

/**
 * Maps one inline tool object from agent prompt to a resolved row (agent scope).
 */
export function parseConvaiInlineTool(
  raw: Record<string, unknown>,
  fallbackId: string
): WorkspaceResolvedTool | null {
  const type = String(raw.type ?? '').trim();
  const name =
    typeof raw.name === 'string'
      ? raw.name.trim()
      : typeof raw.tool_name === 'string'
        ? raw.tool_name.trim()
        : '';
  if (!name && type !== 'system') return null;

  const kind = normalizeKind(type);
  const id = name || fallbackId;
  const description =
    typeof raw.description === 'string' && raw.description.trim()
      ? raw.description.trim()
      : undefined;
  const disabled = raw.disabled === true || raw.enabled === false;
  const apiSchema = asRecord(raw.api_schema) ?? asRecord(raw.apiSchema);
  const { url, httpMethod } = readUrlFromApiSchema(apiSchema);

  return {
    id,
    name: name || id,
    kind,
    description,
    ...(url ? { url } : {}),
    ...(httpMethod ? { httpMethod } : {}),
    enabled: !disabled,
    scope: 'agent',
  };
}

/** Extracts inline `prompt.tools` and `prompt.tool_ids` placeholder rows (ids only). */
export function extractPromptToolIdsAndInline(
  conversationConfig: unknown
): { toolIds: string[]; inline: WorkspaceResolvedTool[] } {
  const cc = asRecord(conversationConfig);
  const agent = asRecord(cc?.agent);
  const prompt = asRecord(agent?.prompt);
  if (!prompt) return { toolIds: [], inline: [] };

  const toolIds: string[] = [];
  const idsRaw = prompt.tool_ids ?? prompt.toolIds;
  if (Array.isArray(idsRaw)) {
    for (const x of idsRaw) {
      const id = String(x).trim();
      if (id) toolIds.push(id);
    }
  }

  const inline: WorkspaceResolvedTool[] = [];
  const toolsRaw = prompt.tools;
  if (Array.isArray(toolsRaw)) {
    toolsRaw.forEach((item, i) => {
      const raw = asRecord(item);
      if (!raw) return;
      const row = parseConvaiInlineTool(raw, `inline_${i}`);
      if (row) inline.push(row);
    });
  }

  return { toolIds, inline };
}
