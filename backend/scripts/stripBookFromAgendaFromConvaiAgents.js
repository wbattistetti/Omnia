/**
 * Rimuove bookfromagenda dagli agenti ConvAI: `prompt.tool_ids` e voci inline in `prompt.tools`.
 * Il catalogo workspace può essere vuoto mentre gli agenti conservano ancora riferimenti.
 *
 * Uso:
 *   node backend/scripts/stripBookFromAgendaFromConvaiAgents.js --dry-run
 *   node backend/scripts/stripBookFromAgendaFromConvaiAgents.js
 *
 * Richiede ELEVENLABS_API_KEY in backend/.env
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { getElevenLabsBaseUrl } = require('../services/iaCatalog/elevenLabsEndpoint');

const NAME_PREFIXES = ['bookfromagenda', 'book_agenda', 'book-from-agenda', 'bookformagenda'];
const URL_SUBSTRINGS = ['bookfromagenda', 'bookformagenda'];

function parseArgs(argv) {
  let dryRun = false;
  for (const arg of argv) {
    if (arg === '--dry-run') dryRun = true;
  }
  return { dryRun };
}

function getApiKey() {
  return typeof process.env.ELEVENLABS_API_KEY === 'string'
    ? process.env.ELEVENLABS_API_KEY.trim()
    : '';
}

async function fetchElevenLabs(method, upstreamPath, body) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY non configurata in backend/.env');
  const apiBase = getElevenLabsBaseUrl().replace(/\/+$/, '');
  const url = `${apiBase}${upstreamPath}`;
  const init = {
    method,
    headers: { 'xi-api-key': apiKey },
  };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let parsed = {};
  if (text.trim()) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }
  }
  return { status: res.status, body: parsed, text };
}

function asRecord(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
}

function inlineToolName(row) {
  if (!row) return '';
  return String(row.name ?? row.tool_name ?? '').trim();
}

function inlineToolUrl(row) {
  if (!row) return '';
  const api = asRecord(row.api_schema) ?? asRecord(row.apiSchema);
  return api && typeof api.url === 'string' ? api.url.trim() : '';
}

function matchesBookFromAgenda({ name, url }) {
  const nl = name.toLowerCase();
  for (const p of NAME_PREFIXES) {
    if (nl.startsWith(p.toLowerCase())) return true;
  }
  const ul = url.toLowerCase();
  for (const u of URL_SUBSTRINGS) {
    if (ul.includes(u.toLowerCase())) return true;
  }
  return false;
}

function workspaceToolRowMatches(row) {
  const config = row.tool_config && typeof row.tool_config === 'object' ? row.tool_config : row;
  const name =
    typeof config.name === 'string'
      ? config.name.trim()
      : typeof row.name === 'string'
        ? row.name.trim()
        : '';
  const api = config.api_schema && typeof config.api_schema === 'object' ? config.api_schema : null;
  const url = api && typeof api.url === 'string' ? api.url.trim() : '';
  return matchesBookFromAgenda({ name, url });
}

async function listAllAgents() {
  const all = [];
  let cursor = null;
  let guard = 0;
  do {
    const q = new URLSearchParams();
    q.set('page_size', '100');
    if (cursor) q.set('cursor', cursor);
    const { status, body } = await fetchElevenLabs('GET', `/convai/agents?${q.toString()}`);
    if (status >= 400) {
      throw new Error(`List agents HTTP ${status}: ${JSON.stringify(body).slice(0, 400)}`);
    }
    const raw = body.agents;
    if (Array.isArray(raw)) {
      for (const row of raw) {
        const id =
          (typeof row.agent_id === 'string' && row.agent_id.trim()) ||
          (typeof row.agentId === 'string' && row.agentId.trim()) ||
          '';
        const name = typeof row.name === 'string' ? row.name.trim() : '';
        if (id) all.push({ agentId: id, name });
      }
    }
    const hasMore = body.has_more === true || body.hasMore === true;
    cursor =
      typeof body.next_cursor === 'string' && body.next_cursor.trim()
        ? body.next_cursor.trim()
        : null;
    guard += 1;
    if (!hasMore || !cursor) break;
  } while (guard < 50);
  return all;
}

async function getAgentDetail(agentId) {
  const { status, body } = await fetchElevenLabs(
    'GET',
    `/convai/agents/${encodeURIComponent(agentId)}`
  );
  if (status >= 400) {
    throw new Error(`GET agent ${agentId} HTTP ${status}`);
  }
  return body;
}

async function getWorkspaceTool(toolId) {
  const { status, body } = await fetchElevenLabs(
    'GET',
    `/convai/tools/${encodeURIComponent(toolId)}`
  );
  if (status === 404) return { missing: true };
  if (status >= 400) return { missing: false, error: status };
  return { missing: false, row: body };
}

function readPromptBlocks(conversationConfig) {
  const cc = asRecord(conversationConfig) ?? {};
  const agent = asRecord(cc.agent) ?? {};
  const prompt = asRecord(agent.prompt) ?? {};
  const toolIds = [];
  const idsRaw = prompt.tool_ids ?? prompt.toolIds;
  if (Array.isArray(idsRaw)) {
    for (const x of idsRaw) {
      const id = String(x).trim();
      if (id) toolIds.push(id);
    }
  }
  const inline = [];
  const toolsRaw = prompt.tools;
  if (Array.isArray(toolsRaw)) {
    for (const item of toolsRaw) {
      const row = asRecord(item);
      if (row) inline.push(row);
    }
  }
  return { agent, prompt, toolIds, inline };
}

async function filterToolIds(toolIds) {
  const kept = [];
  const removed = [];
  for (const tid of toolIds) {
    const res = await getWorkspaceTool(tid);
    if (res.missing) {
      removed.push({ tid, reason: '404' });
      continue;
    }
    const row = res.row;
    const wrapped =
      row && typeof row === 'object' && row.tool_config ? row : { tool_config: row };
    if (workspaceToolRowMatches(wrapped)) {
      removed.push({ tid, reason: 'bookfromagenda' });
    } else {
      kept.push(tid);
    }
    await new Promise((r) => setTimeout(r, 80));
  }
  return { kept, removed };
}

function filterInlineTools(inline) {
  const kept = [];
  const removed = [];
  for (const row of inline) {
    const name = inlineToolName(row);
    const url = inlineToolUrl(row);
    if (matchesBookFromAgenda({ name, url })) {
      removed.push({ name, url: url.slice(0, 80) });
    } else {
      kept.push(row);
    }
  }
  return { kept, removed };
}

async function patchAgentPrompt(agentId, agent, prompt, toolIds, inline) {
  return fetchElevenLabs('PATCH', `/convai/agents/${encodeURIComponent(agentId)}`, {
    conversation_config: {
      agent: {
        ...agent,
        prompt: {
          ...prompt,
          tool_ids: toolIds,
          tools: inline,
        },
      },
    },
  });
}

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2));

  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧹 Rimuove bookfromagenda da agenti ConvAI (tool_ids + inline)');
  console.log(`   dry-run: ${dryRun}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  const agents = await listAllAgents();
  console.log(`📋 Agenti totali: ${agents.length}\n`);

  let agentsTouched = 0;
  let idsRemoved = 0;
  let inlineRemoved = 0;

  for (const [idx, { agentId, name }] of agents.entries()) {
    const detail = await getAgentDetail(agentId);
    const cc =
      detail.conversation_config ??
      detail.conversationConfig ??
      detail;
    const { agent, prompt, toolIds, inline } = readPromptBlocks(cc);

    const { kept: keptIds, removed: removedIds } = await filterToolIds(toolIds);
    const { kept: keptInline, removed: removedInline } = filterInlineTools(inline);

    const changed =
      removedIds.length > 0 ||
      removedInline.length > 0 ||
      keptIds.length !== toolIds.length ||
      keptInline.length !== inline.length;

    if (!changed) continue;

    agentsTouched += 1;
    idsRemoved += removedIds.length;
    inlineRemoved += removedInline.length;

    console.log(`[${idx + 1}/${agents.length}] ${name || '(senza nome)'} (${agentId})`);
    if (removedIds.length) {
      console.log(`   tool_ids rimossi: ${removedIds.length}`);
      for (const r of removedIds.slice(0, 5)) {
        console.log(`      - ${r.tid} (${r.reason})`);
      }
      if (removedIds.length > 5) console.log(`      … +${removedIds.length - 5}`);
    }
    if (removedInline.length) {
      console.log(`   inline rimossi: ${removedInline.length}`);
      for (const r of removedInline.slice(0, 3)) {
        console.log(`      - ${r.name || '(no name)'} ${r.url ? r.url : ''}`);
      }
    }

    if (!dryRun) {
      const { status, body } = await patchAgentPrompt(
        agentId,
        agent,
        prompt,
        keptIds,
        keptInline
      );
      if (status >= 200 && status < 300) {
        console.log('   ✅ PATCH ok');
      } else {
        console.warn(`   ❌ PATCH HTTP ${status}`, JSON.stringify(body).slice(0, 200));
      }
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  console.log('\n───────────────────────────────────────────────────────────');
  if (agentsTouched === 0) {
    console.log('✅ Nessun agente con bookfromagenda (tool_ids o inline).\n');
  } else if (dryRun) {
    console.log(
      `⚠️  Dry-run: ${agentsTouched} agenti da aggiornare (${idsRemoved} tool_ids, ${inlineRemoved} inline).\n`
    );
  } else {
    console.log(
      `✅ Fine: ${agentsTouched} agenti aggiornati (${idsRemoved} tool_ids, ${inlineRemoved} inline rimossi).\n`
    );
  }
}

main().catch((err) => {
  console.error('❌', err instanceof Error ? err.message : err);
  process.exit(1);
});
