/**
 * Express routes: /api/ia-catalog/sync/*, /api/ia-catalog/ui/*
 * Catalogo vuoto dopo sync → HTTP 200 + items [] + catalogEmpty/message (no mock data).
 */

const { readCache, CACHE_PATH } = require('./fileCache');
const pg = require('./pgStore');
const sync = require('./catalogSync');
const { diag } = require('./catalogLog');
const {
  getElevenLabsBaseUrl,
  logElevenLabsEndpointConfig,
  keyLooksResidencyScoped,
  isResidencyHost,
} = require('./elevenLabsEndpoint');

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;

const EMPTY_VOICES = {
  code: 'EMPTY_VOICE_CATALOG',
  message:
    'Catalogo voci vuoto sul server (nessun dato dopo sync). Imposta ELEVENLABS_API_KEY nel processo Node, riavvia Express e POST /api/ia-catalog/refresh. Per account EU data residency usa anche ELEVENLABS_API_BASE (es. https://api.eu.residency.elevenlabs.io/v1) allineato alla chiave.',
};
const EMPTY_LANG = {
  code: 'EMPTY_LANGUAGE_CATALOG',
  message:
    'Catalogo lingue vuoto: dopo aver sincronizzato le voci ElevenLabs, eseguire POST /api/ia-catalog/sync/languages oppure POST /api/ia-catalog/refresh.',
};
const EMPTY_MODELS = {
  code: 'EMPTY_MODEL_CATALOG',
  message:
    'Catalogo modelli vuoto per questo provider: imposta OPENAI_API_KEY / ANTHROPIC_API_KEY / GOOGLE_API_KEY nell’ambiente Node, riavvia e poi POST /api/ia-catalog/sync/models.',
};

function dedupeLocales(items) {
  const m = new Map();
  for (const it of items) {
    const locale = it.locale || it.language || '';
    if (!locale || m.has(locale)) continue;
    m.set(locale, {
      locale,
      label: typeof it.label === 'string' ? it.label : locale,
      sources: Array.isArray(it.sources) ? it.sources : [],
    });
  }
  return [...m.values()].sort((a, b) => a.locale.localeCompare(b.locale));
}

async function loadVoicesFromStores() {
  let rows = [];
  try {
    rows = await pg.readVoicesFromDb();
  } catch (e) {
    console.warn('[iaCatalog] readVoicesFromDb:', e.message);
    diag('loadVoices:postgres_read_error', { message: String(e.message || e) });
  }
  if (rows.length) {
    diag('loadVoices:source', { source: 'postgres', count: rows.length });
    return { items: rows, source: 'postgres' };
  }
  const disk = readCache().voices || [];
  if (disk.length) {
    diag('loadVoices:source', { source: 'file_cache', count: disk.length, cachePath: CACHE_PATH });
    return { items: disk, source: 'file_cache' };
  }
  diag('loadVoices:empty', {
    postgresConfigured: pg.isDbConfigured(),
    postgresRowCount: 0,
    fileCacheVoiceCount: disk.length,
    cachePath: CACHE_PATH,
    hint: 'Nessun dato dopo sync o sync fallito / API voci vuota. Cerca [iaCatalog:syncVoices:*] nei log.',
  });
  return null;
}

async function loadLanguagesFromStores() {
  let rows = [];
  try {
    rows = await pg.readLanguagesFromDb();
  } catch (e) {
    console.warn('[iaCatalog] readLanguagesFromDb:', e.message);
  }
  rows = dedupeLocales(rows.map((r) => ({ locale: r.locale, label: r.label, sources: r.sources || [] })));
  if (rows.length) return { items: rows, source: 'postgres' };
  const disk = readCache().languages || [];
  const deduped = dedupeLocales(disk);
  if (deduped.length) return { items: deduped, source: 'file_cache' };
  return null;
}

/**
 * Messaggio UI quando il catalogo voci è vuoto: residency vs sync vs libreria vuota.
 */
function resolveVoiceCatalogEmptyMessage() {
  const rawKey = process.env.ELEVENLABS_API_KEY;
  const key = typeof rawKey === 'string' ? rawKey.trim() : '';
  const baseUrl = getElevenLabsBaseUrl();
  if (key && keyLooksResidencyScoped(key) && !isResidencyHost(baseUrl)) {
    return 'Mismatch residency: usa ELEVENLABS_API_BASE EU';
  }
  const state = readCache().meta?.voicesSyncState;
  if (state?.ok === false) {
    return 'Sync fallito: controlla chiave o endpoint';
  }
  if (state?.ok === true && state.emptyApiList) {
    return 'Nessuna voce disponibile nel tuo workspace ElevenLabs EU';
  }
  if (key) {
    return 'Sync fallito: controlla chiave o endpoint';
  }
  return EMPTY_VOICES.message;
}

async function loadModelsFromStores(provider) {
  let rows = [];
  try {
    rows = await pg.readModelsFromDb(provider);
  } catch (e) {
    console.warn('[iaCatalog] readModelsFromDb:', e.message);
  }
  if (rows.length) return { items: rows, source: 'postgres' };
  const disk = readCache().modelsByProvider?.[provider] || [];
  if (disk.length) return { items: disk, source: 'file_cache' };
  return null;
}

function mountIaCatalog(app) {
  logElevenLabsEndpointConfig();

  /**
   * Voci TTS ElevenLabs. Query obbligatoria: platform=(elevenlabs|openai|anthropic|google|custom).
   * Solo elevenlabs ha catalogo voci; le altre piattaforme ricevono applicable:false senza errore.
   */
  app.get('/api/ia-catalog/ui/voices', async (req, res) => {
    try {
      const platform = typeof req.query.platform === 'string' ? req.query.platform.trim() : '';
      if (!platform) {
        return res.status(400).json({
          ok: false,
          code: 'MISSING_PLATFORM',
          message: 'Parametro query obbligatorio: platform (es. elevenlabs).',
        });
      }
      if (platform !== 'elevenlabs') {
        const q = typeof req.query.q === 'string' ? req.query.q : '';
        return res.json({
          ok: true,
          applicable: false,
          platform,
          source: 'n/a',
          items: [],
          message:
            'Il catalogo voci ElevenLabs si usa solo con platform=elevenlabs. Questa piattaforma non espone voci TTS nel catalogo.',
          filteredCount: 0,
          q,
        });
      }

      const q = typeof req.query.q === 'string' ? req.query.q : '';

      const filterKeys = ['language', 'accent', 'category', 'gender', 'age_group', 'style'];

      const loaded = await loadVoicesFromStores();
      if (!loaded) {
        diag('ui_voices:empty_catalog', {
          platform,
          elevenLabsKeyPresent: Boolean(
            process.env.ELEVENLABS_API_KEY && String(process.env.ELEVENLABS_API_KEY).trim()
          ),
          httpStatus: 200,
        });
        return res.json({
          ok: true,
          applicable: true,
          catalogEmpty: true,
          platform: 'elevenlabs',
          source: 'none',
          code: EMPTY_VOICES.code,
          message: resolveVoiceCatalogEmptyMessage(),
          items: [],
          filteredCount: 0,
          q,
        });
      }
      let items = sync.filterList(loaded.items, q);

      const langQ = typeof req.query.language === 'string' ? req.query.language.trim() : '';
      if (langQ) {
        items = items.filter((v) => {
          const vl = v.language && String(v.language).trim().toLowerCase();
          if (!vl || vl === 'und') return false;
          const prefix = langQ.toLowerCase().split('-')[0];
          return vl === langQ.toLowerCase() || vl.startsWith(`${prefix}-`) || vl === prefix;
        });
      }

      for (const key of filterKeys) {
        if (key === 'language') continue;
        const raw = req.query[key];
        if (typeof raw !== 'string' || !raw.trim()) continue;
        const val = raw.trim();
        items = items.filter((v) => v[key] != null && String(v[key]) === val);
      }

      res.json({
        ok: true,
        applicable: true,
        platform: 'elevenlabs',
        source: loaded.source,
        items,
        filteredCount: items.length,
        q,
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });

  app.get('/api/ia-catalog/ui/languages', async (req, res) => {
    try {
      const platform = typeof req.query.platform === 'string' ? req.query.platform.trim() : '';
      if (!platform) {
        return res.status(400).json({
          ok: false,
          code: 'MISSING_PLATFORM',
          message: 'Parametro query obbligatorio: platform (es. elevenlabs).',
        });
      }
      if (platform !== 'elevenlabs') {
        const q = typeof req.query.q === 'string' ? req.query.q : '';
        return res.json({
          ok: true,
          applicable: false,
          platform,
          source: 'n/a',
          items: [],
          message:
            'Le lingue per ConvAI sono lette dal catalogo sincronizzato con ElevenLabs; usa platform=elevenlabs.',
          filteredCount: 0,
          q,
        });
      }

      const qLang = typeof req.query.q === 'string' ? req.query.q : '';

      const loaded = await loadLanguagesFromStores();
      if (!loaded) {
        return res.json({
          ok: true,
          applicable: true,
          catalogEmpty: true,
          platform: 'elevenlabs',
          source: 'none',
          code: EMPTY_LANG.code,
          message: EMPTY_LANG.message,
          items: [],
          filteredCount: 0,
          q: qLang,
        });
      }
      const flat = loaded.items.map((x) => ({
        locale: x.locale,
        label: x.label || x.locale,
        sources: x.sources || [],
      }));
      const items = sync.filterList(flat, qLang);
      res.json({
        ok: true,
        applicable: true,
        platform: 'elevenlabs',
        source: loaded.source,
        items,
        filteredCount: items.length,
        q: qLang,
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });

  /**
   * Modelli LLM per provider (openai | anthropic | google). Obbligatorio: provider=...
   */
  app.get('/api/ia-catalog/ui/models', async (req, res) => {
    try {
      const provider =
        typeof req.query.provider === 'string' ? req.query.provider.trim() : '';
      const allowed = ['openai', 'anthropic', 'google'];
      if (!provider) {
        return res.status(400).json({
          ok: false,
          code: 'MISSING_PROVIDER',
          message: 'Parametro query obbligatorio: provider (openai | anthropic | google).',
        });
      }
      if (!allowed.includes(provider)) {
        return res.status(400).json({
          ok: false,
          code: 'INVALID_PROVIDER',
          message: `provider deve essere uno di: ${allowed.join(', ')} (ElevenLabs non espone catalogo LLM qui).`,
        });
      }

      const qModels = typeof req.query.q === 'string' ? req.query.q : '';

      const loaded = await loadModelsFromStores(provider);
      if (!loaded) {
        return res.json({
          ok: true,
          catalogEmpty: true,
          provider,
          code: EMPTY_MODELS.code,
          message: EMPTY_MODELS.message,
          source: 'none',
          items: [],
          filteredCount: 0,
          q: qModels,
        });
      }
      const items = sync.filterList(loaded.items, qModels);
      res.json({
        ok: true,
        provider,
        source: loaded.source,
        items,
        filteredCount: items.length,
        q: qModels,
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });

  app.post('/api/ia-catalog/sync/voices', async (req, res) => {
    try {
      const r = await sync.syncVoicesElevenLabs();
      res.json({ ok: true, ...r });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });

  app.post('/api/ia-catalog/sync/languages', async (req, res) => {
    try {
      const r = await sync.syncLanguages();
      res.json({ ok: true, ...r });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });

  app.post('/api/ia-catalog/sync/models', async (req, res) => {
    try {
      const r = await sync.syncModelsLLM();
      res.json({ ok: true, ...r });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });

  app.post('/api/ia-catalog/sync/all', async (req, res) => {
    try {
      const r = await sync.syncAll();
      res.json({ ok: true, results: r });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });

  app.post('/api/ia-catalog/refresh', async (req, res) => {
    try {
      const r = await sync.syncAll();
      res.json({ ok: true, results: r });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });

  diag('catalog_boot_env', {
    elevenLabsApiBase: getElevenLabsBaseUrl(),
    elevenLabsKeyPresent: Boolean(
      process.env.ELEVENLABS_API_KEY && String(process.env.ELEVENLABS_API_KEY).trim()
    ),
    elevenLabsKeyCharCount: process.env.ELEVENLABS_API_KEY
      ? String(process.env.ELEVENLABS_API_KEY).trim().length
      : 0,
    postgresUrlConfigured: pg.isDbConfigured(),
    cacheFilePath: CACHE_PATH,
    note: 'Variabili da backend/.env caricate all’avvio via dotenv; altrimenti impostale nel sistema. Cercare [iaCatalog:…] al riavvio e durante /refresh.',
  });
}

let intervalId = null;

function scheduleIaCatalogSync() {
  if (intervalId) return;
  intervalId = setInterval(() => {
    sync.syncAll().catch((e) => console.warn('[iaCatalog] scheduled sync failed:', e.message));
  }, SYNC_INTERVAL_MS);
}

async function runStartupIaCatalogSync() {
  try {
    const r = await sync.syncAll();
    console.log('[iaCatalog] startup sync:', JSON.stringify(r));
    diag('startup_sync_result', { results: r });
  } catch (e) {
    const msg = String(e?.message || e);
    console.warn('[iaCatalog] startup sync failed:', msg);
    diag('startup_sync_failed', { message: msg });
  }
  scheduleIaCatalogSync();
}

module.exports = {
  mountIaCatalog,
  runStartupIaCatalogSync,
  scheduleIaCatalogSync,
};
