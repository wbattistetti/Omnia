/**
 * Elimina tool ConvAI nel workspace ElevenLabs il cui nome inizia con un prefisso.
 *
 * Uso:
 *   node backend/scripts/deleteConvaiToolsByNamePrefix.js
 *   node backend/scripts/deleteConvaiToolsByNamePrefix.js --dry-run
 *   node backend/scripts/deleteConvaiToolsByNamePrefix.js --prefix=next_window --force
 *   node backend/scripts/deleteConvaiToolsByNamePrefix.js --prefixes=bookfromagenda,book_agenda --url-contains=bookfromagenda
 *
 * Richiede ELEVENLABS_API_KEY in backend/.env
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { getElevenLabsBaseUrl } = require('../services/iaCatalog/elevenLabsEndpoint');

const BOOK_FROM_AGENDA_PREFIXES = [
  'bookfromagenda',
  'bookformagenda',
  'book_agenda',
  'book-from-agenda',
];
const BOOK_FROM_AGENDA_URL_SUBSTRINGS = ['bookfromagenda', 'bookformagenda'];

function parseArgs(argv) {
  let prefixes = ['next_window'];
  let urlContains = [];
  let dryRun = false;
  let force = true;
  for (const arg of argv) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--no-force') force = false;
    else if (arg === '--bookfromagenda') {
      prefixes = [...BOOK_FROM_AGENDA_PREFIXES];
      urlContains = [...BOOK_FROM_AGENDA_URL_SUBSTRINGS];
    } else if (arg.startsWith('--prefixes=')) {
      prefixes = arg
        .slice('--prefixes='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (arg.startsWith('--prefix=')) {
      const one = arg.slice('--prefix='.length).trim();
      if (one) prefixes = [one];
    } else if (arg.startsWith('--url-contains=')) {
      const part = arg.slice('--url-contains='.length).trim();
      if (part) urlContains.push(part);
    }
  }
  return { prefixes, urlContains, dryRun, force };
}

function getApiKey() {
  return typeof process.env.ELEVENLABS_API_KEY === 'string'
    ? process.env.ELEVENLABS_API_KEY.trim()
    : '';
}

async function fetchElevenLabs(method, upstreamPath) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY non configurata in backend/.env');
  }
  const apiBase = getElevenLabsBaseUrl().replace(/\/+$/, '');
  const url = `${apiBase}${upstreamPath}`;
  const res = await fetch(url, {
    method,
    headers: { 'xi-api-key': apiKey },
  });
  const text = await res.text();
  let body = {};
  if (text.trim()) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }
  return { status: res.status, body, text };
}

function toolNameFromRow(row) {
  if (!row || typeof row !== 'object') return '';
  const config = row.tool_config && typeof row.tool_config === 'object' ? row.tool_config : row;
  const name =
    typeof config.name === 'string'
      ? config.name.trim()
      : typeof row.name === 'string'
        ? row.name.trim()
        : '';
  return name;
}

function toolIdFromRow(row) {
  if (!row || typeof row !== 'object') return '';
  return (
    (typeof row.id === 'string' && row.id.trim()) ||
    (typeof row.tool_id === 'string' && row.tool_id.trim()) ||
    ''
  );
}

function toolUrlFromRow(row) {
  if (!row || typeof row !== 'object') return '';
  const config = row.tool_config && typeof row.tool_config === 'object' ? row.tool_config : row;
  const api = config.api_schema && typeof config.api_schema === 'object' ? config.api_schema : null;
  return api && typeof api.url === 'string' ? api.url.trim() : '';
}

function toolMatchesFilters(row, prefixes, urlContains) {
  const name = toolNameFromRow(row).toLowerCase();
  for (const p of prefixes) {
    const pl = String(p).trim().toLowerCase();
    if (pl && name.startsWith(pl)) return true;
  }
  const url = toolUrlFromRow(row).toLowerCase();
  for (const u of urlContains) {
    const ul = String(u).trim().toLowerCase();
    if (ul && url.includes(ul)) return true;
  }
  return false;
}

async function listAllConvaiTools() {
  const all = [];
  let cursor = null;
  let guard = 0;
  do {
    const q = new URLSearchParams();
    q.set('page_size', '100');
    if (cursor) q.set('cursor', cursor);
    const { status, body } = await fetchElevenLabs('GET', `/convai/tools?${q.toString()}`);
    if (status >= 400) {
      throw new Error(`List tools HTTP ${status}: ${JSON.stringify(body).slice(0, 400)}`);
    }
    const raw = body.tools;
    if (Array.isArray(raw)) {
      for (const row of raw) {
        if (row && typeof row === 'object') all.push(row);
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

async function deleteConvaiTool(toolId, force) {
  const q = force ? '?force=true' : '';
  return fetchElevenLabs('DELETE', `/convai/tools/${encodeURIComponent(toolId)}${q}`);
}

async function main() {
  const { prefixes, urlContains, dryRun, force } = parseArgs(process.argv.slice(2));

  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧹 Elimina tool ConvAI workspace (prefisso nome / URL)');
  console.log(`   Prefissi nome: ${prefixes.map((p) => `"${p}"`).join(', ')}`);
  if (urlContains.length) console.log(`   URL contiene: ${urlContains.map((u) => `"${u}"`).join(', ')}`);
  console.log(`   dry-run: ${dryRun} | force: ${force}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  const rows = await listAllConvaiTools();
  console.log(`📋 Tool totali in workspace: ${rows.length}`);

  const targets = rows.filter((row) => toolMatchesFilters(row, prefixes, urlContains));

  console.log(`🎯 Da eliminare: ${targets.length}\n`);

  if (targets.length === 0) {
    console.log('✅ Nessun tool da eliminare.\n');
    return;
  }

  for (const [idx, row] of targets.entries()) {
    const id = toolIdFromRow(row);
    const name = toolNameFromRow(row);
    const url = toolUrlFromRow(row);
    console.log(`[${idx + 1}/${targets.length}] ${name} (${id})`);
    if (url) console.log(`    ${url.slice(0, 120)}${url.length > 120 ? '…' : ''}`);
  }

  if (dryRun) {
    console.log('\n⚠️  Dry-run: nessuna DELETE eseguita.\n');
    return;
  }

  console.log('\n🗑️  Eliminazione in corso…\n');
  let ok = 0;
  let fail = 0;
  for (const row of targets) {
    const id = toolIdFromRow(row);
    const name = toolNameFromRow(row);
    if (!id) {
      console.warn(`   ⚠️  Salto riga senza id: ${name}`);
      fail += 1;
      continue;
    }
    const { status, body } = await deleteConvaiTool(id, force);
    if (status >= 200 && status < 300) {
      console.log(`   ✅ ${name} (${id})`);
      ok += 1;
    } else {
      console.warn(`   ❌ ${name} (${id}) HTTP ${status}`, JSON.stringify(body).slice(0, 200));
      fail += 1;
    }
    await new Promise((r) => setTimeout(r, 120));
  }

  console.log(`\n✅ Fine: ${ok} eliminati, ${fail} errori.\n`);
}

main().catch((err) => {
  console.error('❌', err instanceof Error ? err.message : err);
  process.exit(1);
});
