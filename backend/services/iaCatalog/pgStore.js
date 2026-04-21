/**
 * Optional Postgres persistence for IA catalog (voices, languages, LLM models).
 */

let pool = null;

/** True se URL Postgres è definito (il pool può comunque fallire al connect). */
function isDbConfigured() {
  return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);
}

function getPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) return null;
  try {
    // eslint-disable-next-line global-require
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString,
      max: 8,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 8000,
    });
    return pool;
  } catch (e) {
    console.warn('[iaCatalog] pg module missing or invalid:', e.message);
    return null;
  }
}

async function ensureTables(p) {
  await p.query(`
    CREATE TABLE IF NOT EXISTS ia_catalog_voice (
      voice_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      preview_url TEXT,
      language TEXT,
      gender TEXT,
      category TEXT,
      tags JSONB DEFAULT '[]'::jsonb,
      tts_family TEXT,
      expressive_tags JSONB DEFAULT '[]'::jsonb,
      raw JSONB DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS ia_catalog_language (
      locale TEXT PRIMARY KEY,
      label TEXT,
      sources JSONB DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS ia_catalog_model (
      provider TEXT NOT NULL,
      model_id TEXT NOT NULL,
      name TEXT,
      latency_ms INT,
      cost_hint TEXT,
      capabilities JSONB DEFAULT '{}'::jsonb,
      tags JSONB DEFAULT '[]'::jsonb,
      notes TEXT,
      raw JSONB DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (provider, model_id)
    );
  `);
}

async function upsertVoices(rows) {
  const p = getPool();
  if (!p || !rows.length) return;
  await ensureTables(p);
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    for (const r of rows) {
      await client.query(
        `INSERT INTO ia_catalog_voice (
          voice_id, name, preview_url, language, gender, category, tags, tts_family, expressive_tags, raw, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb,$10::jsonb,NOW())
        ON CONFLICT (voice_id) DO UPDATE SET
          name=EXCLUDED.name,
          preview_url=EXCLUDED.preview_url,
          language=EXCLUDED.language,
          gender=EXCLUDED.gender,
          category=EXCLUDED.category,
          tags=EXCLUDED.tags,
          tts_family=EXCLUDED.tts_family,
          expressive_tags=EXCLUDED.expressive_tags,
          raw=EXCLUDED.raw,
          updated_at=NOW()`,
        [
          r.voice_id,
          r.name,
          r.preview_url ?? null,
          r.language ?? null,
          r.gender ?? null,
          r.category ?? null,
          JSON.stringify(r.tags ?? []),
          r.tts_family ?? null,
          JSON.stringify(r.expressive_tags ?? []),
          JSON.stringify(r.raw ?? {}),
        ]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function upsertLanguages(rows) {
  const p = getPool();
  if (!p || !rows.length) return;
  await ensureTables(p);
  for (const r of rows) {
    await p.query(
      `INSERT INTO ia_catalog_language (locale, label, sources, updated_at)
       VALUES ($1,$2,$3::jsonb,NOW())
       ON CONFLICT (locale) DO UPDATE SET
         label = COALESCE(EXCLUDED.label, ia_catalog_language.label),
         sources = EXCLUDED.sources,
         updated_at = NOW()`,
      [r.locale, r.label ?? null, JSON.stringify(r.sources ?? ['derived'])]
    );
  }
}

async function upsertModels(provider, rows) {
  const p = getPool();
  if (!p || !rows.length) return;
  await ensureTables(p);
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    for (const r of rows) {
      await client.query(
        `INSERT INTO ia_catalog_model (
          provider, model_id, name, latency_ms, cost_hint, capabilities, tags, notes, raw, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9::jsonb,NOW())
        ON CONFLICT (provider, model_id) DO UPDATE SET
          name=EXCLUDED.name,
          latency_ms=EXCLUDED.latency_ms,
          cost_hint=EXCLUDED.cost_hint,
          capabilities=EXCLUDED.capabilities,
          tags=EXCLUDED.tags,
          notes=EXCLUDED.notes,
          raw=EXCLUDED.raw,
          updated_at=NOW()`,
        [
          provider,
          r.model_id,
          r.name ?? r.model_id,
          r.latency_ms ?? null,
          r.cost_hint ?? null,
          JSON.stringify(r.capabilities ?? {}),
          JSON.stringify(r.tags ?? []),
          r.notes ?? null,
          JSON.stringify(r.raw ?? {}),
        ]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function readVoicesFromDb() {
  const p = getPool();
  if (!p) return [];
  await ensureTables(p);
  const { rows } = await p.query(
    `SELECT voice_id, name, preview_url, language, gender, category, tags, tts_family, expressive_tags, raw
     FROM ia_catalog_voice ORDER BY name`
  );
  return rows.map((row) => ({
    voice_id: row.voice_id,
    name: row.name,
    preview_url: row.preview_url,
    language: row.language,
    gender: row.gender,
    category: row.category,
    tags: row.tags || [],
    tts_family: row.tts_family,
    expressive_tags: row.expressive_tags || [],
    raw: row.raw || {},
  }));
}

async function readLanguagesFromDb() {
  const p = getPool();
  if (!p) return [];
  await ensureTables(p);
  const { rows } = await p.query(`SELECT locale, label, sources FROM ia_catalog_language ORDER BY locale`);
  return rows.map((r) => ({
    locale: r.locale,
    label: r.label,
    sources: r.sources || [],
  }));
}

async function readModelsFromDb(provider) {
  const p = getPool();
  if (!p) return [];
  await ensureTables(p);
  const { rows } = await p.query(
    `SELECT provider, model_id, name, latency_ms, cost_hint, capabilities, tags, notes, raw
     FROM ia_catalog_model WHERE provider = $1 ORDER BY name NULLS LAST, model_id`,
    [provider]
  );
  return rows.map((row) => ({
    model_id: row.model_id,
    name: row.name,
    provider: row.provider,
    latency_ms: row.latency_ms,
    cost_hint: row.cost_hint,
    capabilities: row.capabilities || {},
    tags: row.tags || [],
    notes: row.notes,
    raw: row.raw || {},
  }));
}

module.exports = {
  getPool,
  isDbConfigured,
  ensureTables,
  upsertVoices,
  upsertLanguages,
  upsertModels,
  readVoicesFromDb,
  readLanguagesFromDb,
  readModelsFromDb,
};
