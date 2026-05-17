/**
 * HTTP client for ElevenLabs ConvAI workspace tools (list + resolve by id).
 */

import type { WorkspaceResolvedTool, WorkspaceToolKind } from '../../core/types';

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

function toolFromWorkspaceApiRow(
  toolId: string,
  row: Record<string, unknown>,
  scope: WorkspaceResolvedTool['scope'],
  nodeMeta?: { nodeId: string; nodeLabel: string }
): WorkspaceResolvedTool | null {
  const config = asRecord(row.tool_config) ?? row;
  const type = String(config.type ?? row.type ?? '').trim();
  const name =
    typeof config.name === 'string'
      ? config.name.trim()
      : typeof row.name === 'string'
        ? row.name.trim()
        : toolId;
  const kind = normalizeKind(type);
  const description =
    typeof config.description === 'string' && config.description.trim()
      ? config.description.trim()
      : undefined;
  const apiSchema = asRecord(config.api_schema) ?? asRecord(config.apiSchema);
  const url = apiSchema && typeof apiSchema.url === 'string' ? apiSchema.url.trim() : '';
  const httpMethod =
    apiSchema && typeof apiSchema.method === 'string'
      ? apiSchema.method.trim().toUpperCase()
      : '';

  return {
    id: toolId,
    name: name || toolId,
    kind,
    description,
    ...(url ? { url } : {}),
    ...(httpMethod ? { httpMethod } : {}),
    enabled: true,
    scope,
    ...(nodeMeta ?? {}),
  };
}

async function readJson(res: Response, url: string): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      text.trim()
        ? `HTTP ${res.status} — ${text.trim().slice(0, 400)}`
        : `HTTP ${res.status} (${url})`
    );
  }
  if (!text.trim()) return {};
  return JSON.parse(text) as Record<string, unknown>;
}

/** GET /elevenlabs/tools — workspace tool catalog (paginated). */
export async function listConvaiToolsForWorkspace(params?: {
  pageSize?: number;
  types?: string;
}): Promise<{ tools: Record<string, unknown>[]; hasMore: boolean; nextCursor: string | null }> {
  const q = new URLSearchParams();
  q.set('page_size', String(Math.min(100, Math.max(1, params?.pageSize ?? 100))));
  if (params?.types?.trim()) q.set('types', params.types.trim());
  const url = `/elevenlabs/tools?${q.toString()}`;
  const res = await fetch(url, { method: 'GET' });
  const data = await readJson(res, url);
  const tools: Record<string, unknown>[] = [];
  const raw = data.tools;
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (row && typeof row === 'object') tools.push(row as Record<string, unknown>);
    }
  }
  const nextCursor =
    typeof data.next_cursor === 'string' && data.next_cursor.trim()
      ? data.next_cursor.trim()
      : null;
  const hasMore = data.has_more === true || data.hasMore === true;
  return { tools, hasMore, nextCursor };
}

/** GET /elevenlabs/tools/{toolId} */
export async function getConvaiToolDetail(toolId: string): Promise<Record<string, unknown>> {
  const id = String(toolId || '').trim();
  if (!id) throw new Error('getTool: toolId mancante');
  const url = `/elevenlabs/tools/${encodeURIComponent(id)}`;
  const res = await fetch(url, { method: 'GET' });
  return readJson(res, url);
}

/**
 * Resolves tool ids via list (one page) + per-id GET for misses.
 */
export async function resolveConvaiToolIds(
  ids: readonly string[],
  scope: WorkspaceResolvedTool['scope'],
  nodeMeta?: { nodeId: string; nodeLabel: string }
): Promise<WorkspaceResolvedTool[]> {
  const unique = [...new Set(ids.map((x) => String(x).trim()).filter(Boolean))];
  if (unique.length === 0) return [];

  const byId = new Map<string, Record<string, unknown>>();
  try {
    let cursor: string | null = null;
    let guard = 0;
    do {
      const q = new URLSearchParams();
      q.set('page_size', '100');
      if (cursor) q.set('cursor', cursor);
      const url = `/elevenlabs/tools?${q.toString()}`;
      const res = await fetch(url, { method: 'GET' });
      const data = await readJson(res, url);
      const raw = data.tools;
      if (Array.isArray(raw)) {
        for (const row of raw) {
          if (!row || typeof row !== 'object') continue;
          const o = row as Record<string, unknown>;
          const tid =
            typeof o.id === 'string'
              ? o.id.trim()
              : typeof o.tool_id === 'string'
                ? o.tool_id.trim()
                : '';
          if (tid) byId.set(tid, o);
        }
      }
      const hasMore = data.has_more === true || data.hasMore === true;
      cursor =
        typeof data.next_cursor === 'string' && data.next_cursor.trim()
          ? data.next_cursor.trim()
          : null;
      guard += 1;
      if (!hasMore || !cursor) break;
    } while (guard < 5);
  } catch {
    /* list optional; fall back to per-id GET */
  }

  const out: WorkspaceResolvedTool[] = [];
  for (const id of unique) {
    let row = byId.get(id);
    if (!row) {
      try {
        row = await getConvaiToolDetail(id);
      } catch {
        out.push({
          id,
          name: id,
          kind: 'unknown',
          enabled: true,
          scope,
          ...(nodeMeta ?? {}),
        });
        continue;
      }
    }
    const parsed = toolFromWorkspaceApiRow(id, row, scope, nodeMeta);
    if (parsed) out.push(parsed);
  }
  return out;
}
