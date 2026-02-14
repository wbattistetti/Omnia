

const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');

// ✅ ENTERPRISE AI SERVICES
const AIProviderService = require('./services/AIProviderService');
const { TemplateIntelligenceOrchestrator } = require('./services/ddt-intelligence');

// ✅ ENTERPRISE MIDDLEWARE
const CircuitBreakerManager = require('./middleware/CircuitBreakerManager');
const RateLimiter = require('./middleware/RateLimiter');
const AIHealthChecker = require('./health/AIHealthChecker');

console.log('>>> SERVER.JS AVVIATO <<<');

const app = express();

// -----------------------------
// Minimal structured logger (low-noise)
// -----------------------------
function logInfo(tag, meta) {
  try { console.log(`[${new Date().toISOString()}][INFO][${tag}]`, JSON.stringify(meta)); }
  catch { console.log(`[INFO][${tag}]`, meta); }
}
function logWarn(tag, meta) {
  try { console.warn(`[${new Date().toISOString()}][WARN][${tag}]`, JSON.stringify(meta)); }
  catch { console.warn(`[WARN][${tag}]`, meta); }
}
function logError(tag, err, meta) {
  const base = { message: String(err?.message || err), stack: err?.stack };
  const out = Object.assign(base, meta || {});
  try { console.error(`[${new Date().toISOString()}][ERROR][${tag}]`, JSON.stringify(out)); }
  catch { console.error(`[ERROR][${tag}]`, out); }
}
app.use(cors());
// Increase body size limits to allow large DDT payloads
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));

// ✅ Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  console.log(`[REQUEST] ${req.method} ${req.path}`, {
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    bodySize: req.body ? JSON.stringify(req.body).length : 0
  });

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`[RESPONSE] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });

  next();
});

const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const fs = require('fs');
const path = require('path');
const dbFactory = 'factory';
const dbProjects = 'Projects';

// ✅ OPTIMIZATION: MongoDB Connection Pool (reuse connections instead of creating new ones)
// This reduces connection overhead from ~3s to ~0ms for subsequent operations
let mongoClientPool = null;
let mongoClientPoolPromise = null;

async function getMongoClient() {
  if (mongoClientPool) {
    // ✅ Verifica che il client sia ancora connesso
    try {
      await mongoClientPool.db('admin').admin().ping();
      return mongoClientPool;
    } catch (error) {
      console.warn('[MongoDB] Pool client disconnected, resetting...', error);
      mongoClientPool = null;
      // Continua per ricreare il pool
    }
  }

  if (mongoClientPoolPromise) {
    return mongoClientPoolPromise;
  }

  mongoClientPoolPromise = (async () => {
    const client = new MongoClient(uri, {
      maxPoolSize: 50, // Maximum number of connections in the pool
      minPoolSize: 2,  // Minimum number of connections in the pool
      maxIdleTimeMS: 120000, // Close connections after 2 minutes of inactivity
      serverSelectionTimeoutMS: 30000, // ✅ Increased to 30s
      connectTimeoutMS: 30000, // ✅ Increased to 30s
      // ✅ Retry options
      retryWrites: true,
      retryReads: true,
      // ✅ Heartbeat per mantenere connessione viva
      heartbeatFrequencyMS: 10000,
    });

    try {
      await client.connect();
      console.log('[MongoDB] ✅ Connection pool initialized');
      mongoClientPool = client;
      mongoClientPoolPromise = null;
      return client;
    } catch (error) {
      mongoClientPoolPromise = null;
      console.error('[MongoDB] ❌ Failed to initialize connection pool', error);
      throw error;
    }
  })();

  return mongoClientPoolPromise;
}

// Helper function to use MongoDB connection pool (replaces new MongoClient + connect + close pattern)
async function withMongoClient(callback) {
  const client = await getMongoClient();
  try {
    return await callback(client);
  } catch (error) {
    // Don't close the pool on error - let it be reused
    throw error;
  }
  // Don't close the client - it's a pool that should be reused!
}

// ✅ Create indexes for projects_catalog collection
async function ensureCatalogIndexes() {
  try {
    const client = await getMongoClient();
    const db = client.db(dbProjects);
    const coll = db.collection('projects_catalog');

    const indexes = [
      { key: { updatedAt: -1 }, name: 'idx_updatedAt' },
      { key: { clientName: 1 }, name: 'idx_clientName' },
      { key: { projectName: 1 }, name: 'idx_projectName' },
      { key: { industry: 1 }, name: 'idx_industry' },
      { key: { status: 1, updatedAt: -1 }, name: 'idx_status_updatedAt' },
    ];

    for (const idx of indexes) {
      try {
        await coll.createIndex(idx.key, { name: idx.name });
      } catch (e) {
        const msg = String(e?.message || e);
        if (!msg.includes('already exists')) {
          logWarn('MongoDB.Index', { index: idx.name, error: msg });
        }
      }
    }

    // Verify collection size
    const count = await coll.countDocuments({});
    if (count > 10000) {
      logWarn('MongoDB.Collection', {
        collection: 'projects_catalog',
        size: count,
        message: 'Large collection detected, using aggregation'
      });
    }
    if (count > 100000) {
      logWarn('MongoDB.Collection', {
        collection: 'projects_catalog',
        size: count,
        message: 'Very large collection, consider pagination'
      });
    }

    logInfo('MongoDB.Index', { message: 'Catalog indexes ensured', collectionSize: count });
  } catch (e) {
    logError('MongoDB.Index', e, { message: 'Failed to ensure catalog indexes' });
    // Non bloccare l'avvio se gli indici falliscono
  }
}

// -----------------------------
// Template Cache Management
// -----------------------------
let templateCache = null;
let cacheLoaded = false;

// -----------------------------
// Task Heuristics Cache Management
// -----------------------------
let taskHeuristicsCache = null;
let taskHeuristicsCacheLoaded = false;

async function loadTaskHeuristicsFromDB() {
  if (taskHeuristicsCacheLoaded) {
    return taskHeuristicsCache;
  }

  try {
    console.log('[TASK_HEURISTICS_CACHE] Caricando pattern da Heuristics...');
    const client = await getMongoClient();
    const db = client.db(dbFactory);
    // Pattern sono ora in Heuristics (rinominata da Task_Types)
    const collection = db.collection('Heuristics');

    const taskTypes = await collection.find({ patterns: { $exists: true, $ne: null } }).toArray();
    console.log(`[TASK_HEURISTICS_CACHE] Trovati ${taskTypes.length} documenti con pattern`);
    taskTypes.forEach(doc => {
      console.log(`[TASK_HEURISTICS_CACHE] Documento: ${doc._id}, pattern keys: ${Object.keys(doc.patterns || {}).join(', ')}`);
    });
    // ✅ NON chiudere la connessione qui - serve ancora per CategoryExtraction

    // Mapping da Heuristics._id a HeuristicType (per compatibilità con frontend)
    const typeMapping = {
      'AIAgent': 'AI_AGENT',
      'Message': 'MESSAGE',
      'DataRequest': 'REQUEST_DATA',
      'ProblemClassification': 'PROBLEM_SPEC_DIRECT', // Usa PROBLEM_SPEC_DIRECT come default
      'Summary': 'SUMMARY',
      'BackendCall': 'BACKEND_CALL',
      'Negotiation': 'NEGOTIATION'
    };

    // Raggruppa per lingua
    const rulesByLang = {};

    taskTypes.forEach(taskType => {
      const taskTypeId = taskType._id;
      const heuristicType = typeMapping[taskTypeId];

      if (!heuristicType || !taskType.patterns) {
        return; // Skip se non c'è mapping o non ci sono pattern
      }

      // I pattern in Heuristics sono strutturati come: { IT: [...], EN: [...], PT: [...] }
      Object.keys(taskType.patterns).forEach(lang => {
        const langUpper = lang.toUpperCase();

        if (!rulesByLang[langUpper]) {
          rulesByLang[langUpper] = {
            AI_AGENT: [],
            MESSAGE: [],
            REQUEST_DATA: [],
            PROBLEM_SPEC_DIRECT: [],
            PROBLEM_REASON: [],
            PROBLEM: null,
            SUMMARY: [],
            BACKEND_CALL: [],
            NEGOTIATION: []
          };
        }

        const patterns = taskType.patterns[lang];
        if (Array.isArray(patterns) && patterns.length > 0) {
          // PROBLEM è una singola regex, gli altri sono array
          if (heuristicType === 'PROBLEM') {
            rulesByLang[langUpper].PROBLEM = patterns[0];
          } else if (rulesByLang[langUpper][heuristicType]) {
            // Aggiungi i pattern all'array esistente
            rulesByLang[langUpper][heuristicType].push(...patterns);
          }
        }
      });

      // Gestione speciale per ProblemClassification: può mappare a PROBLEM_SPEC_DIRECT, PROBLEM_REASON, o PROBLEM
      if (taskTypeId === 'ProblemClassification' && taskType.patterns) {
        // Gestisci pattern normali (IT, EN, PT) → PROBLEM_SPEC_DIRECT
        Object.keys(taskType.patterns).forEach(lang => {
          const langUpper = lang.toUpperCase();

          // Se è una lingua (IT, EN, PT), gestiscila come PROBLEM_SPEC_DIRECT
          if (['IT', 'EN', 'PT'].includes(langUpper)) {
            const patterns = taskType.patterns[lang];
            if (Array.isArray(patterns) && patterns.length > 0) {
              // Se ci sono pattern specifici per PROBLEM, usali
              // Altrimenti usa PROBLEM_SPEC_DIRECT come default
              if (!rulesByLang[langUpper].PROBLEM_SPEC_DIRECT || rulesByLang[langUpper].PROBLEM_SPEC_DIRECT.length === 0) {
                rulesByLang[langUpper].PROBLEM_SPEC_DIRECT = [...patterns];
              }
            }
          }
          // ✅ Gestisci PROBLEM_REASON come campo annidato
          else if (lang === 'PROBLEM_REASON' && taskType.patterns.PROBLEM_REASON) {
            Object.keys(taskType.patterns.PROBLEM_REASON).forEach(problemLang => {
              const problemLangUpper = problemLang.toUpperCase();
              if (!rulesByLang[problemLangUpper]) {
                rulesByLang[problemLangUpper] = {
                  AI_AGENT: [],
                  MESSAGE: [],
                  REQUEST_DATA: [],
                  PROBLEM_SPEC_DIRECT: [],
                  PROBLEM_REASON: [],
                  PROBLEM: null,
                  SUMMARY: [],
                  BACKEND_CALL: [],
                  NEGOTIATION: []
                };
              }
              const problemReasonPatterns = taskType.patterns.PROBLEM_REASON[problemLang];
              if (Array.isArray(problemReasonPatterns) && problemReasonPatterns.length > 0) {
                rulesByLang[problemLangUpper].PROBLEM_REASON = [...problemReasonPatterns];
              }
            });
          }
        });
      }
    });

    // ✅ Carica pattern per inferenza categoria (CategoryExtraction)
    const categoryExtraction = await collection.findOne({ _id: 'CategoryExtraction' });
    if (categoryExtraction && categoryExtraction.patterns) {
      Object.keys(categoryExtraction.patterns).forEach(lang => {
        const langUpper = lang.toUpperCase();
        if (!rulesByLang[langUpper]) {
          rulesByLang[langUpper] = {
            AI_AGENT: [],
            MESSAGE: [],
            REQUEST_DATA: [],
            PROBLEM_SPEC_DIRECT: [],
            PROBLEM_REASON: [],
            PROBLEM: null,
            SUMMARY: [],
            BACKEND_CALL: [],
            NEGOTIATION: []
          };
        }
        // Aggiungi CATEGORY_PATTERNS per inferenza categoria
        rulesByLang[langUpper].CATEGORY_PATTERNS = categoryExtraction.patterns[lang] || [];
      });
      console.log(`[TASK_HEURISTICS_CACHE] Caricati pattern CategoryExtraction per lingue: ${Object.keys(categoryExtraction.patterns).join(', ')}`);
    }

    taskHeuristicsCache = rulesByLang;
    taskHeuristicsCacheLoaded = true;
    const langCount = Object.keys(rulesByLang).length;
    const totalPatterns = Object.values(rulesByLang).reduce((sum, lang) => {
      return sum + Object.values(lang).reduce((langSum, patterns) => {
        if (Array.isArray(patterns)) return langSum + patterns.length;
        if (patterns !== null) return langSum + 1;
        return langSum;
      }, 0);
    }, 0);
    console.log(`[TASK_HEURISTICS_CACHE] ✅ Caricati pattern da Heuristics: ${langCount} lingue, ${totalPatterns} pattern totali`);
    if (langCount === 0) {
      console.warn('[TASK_HEURISTICS_CACHE] ⚠️ ATTENZIONE: Nessun pattern caricato! Verifica il database.');
    }

    // ✅ Chiudi la connessione DOPO aver caricato tutto (incluso CategoryExtraction)
  // ✅ NON chiudere la connessione se usi il pool
    return taskHeuristicsCache;

  } catch (error) {
    console.error('[TASK_HEURISTICS_CACHE] Errore nel caricamento:', error);
    // ✅ NON chiudere la connessione se usi il pool
    return {};
  }
}

async function loadTemplatesFromDB() {
  if (cacheLoaded) {
    return templateCache;
  }

  try {
    console.log('[TEMPLATE_CACHE] Caricando template dal database Factory...');
    const client = await getMongoClient();
    const db = client.db('factory');

    // ✅ Carica dialogue templates da tasks collection
    const query = {
      $or: [
        { type: 3 },                              // ✅ Enum numeric (TaskType.GetData = 3)
        { type: { $regex: /^datarequest$/i } },   // ✅ String type
        { type: { $regex: /^data$/i } },          // ✅ Legacy
        { name: { $regex: /^(datarequest|getdata|data)$/i } }
      ]
    };

    // ✅ Collection tasks (lowercase)
    const templates1 = await db.collection('tasks').find(query).toArray();  // ✅ Collection tasks (lowercase)
  // ✅ NON chiudere la connessione se usi il pool
    // Converti in oggetto per accesso rapido
    const allTemplates = [...templates1];
    templateCache = {};
    allTemplates.forEach(template => {
      const key = template.name || template.label || template.id || template._id?.toString();
      if (key) {
        // Crea una copia senza _id per compatibilità
        const templateCopy = { ...template };
        if (templateCopy._id) {
          delete templateCopy._id;
        }
        templateCache[key] = templateCopy;
      }
    });

    cacheLoaded = true;
    console.log(`[TEMPLATE_CACHE] Caricati ${Object.keys(templateCache).length} template dal database`);
    return templateCache;

  } catch (error) {
    console.error('[TEMPLATE_CACHE] Errore nel caricamento:', error);
    return {};
  }
}

// Risolvi templateRef espandendo i riferimenti ai template (ESTESO PER 3 LIVELLI)
async function resolveTemplateRefs(subTasks, templates, level = 0) {
  const resolved = [];

  // Limite di sicurezza per evitare ricorsioni infinite
  if (level > 10) {
    console.warn(`[TEMPLATE_RESOLUTION] Livello massimo raggiunto (${level}), interrompendo ricorsione`);
    return resolved;
  }

  for (const item of subTasks) {
    if (item.templateRef && templates[item.templateRef]) {
      // Espandi il template referenziato
      const referencedTemplate = templates[item.templateRef];

      if (referencedTemplate.subTasks && referencedTemplate.subTasks.length > 0) {
        // Se il template referenziato ha subTasks, espandili ricorsivamente
        const expandedSubTasks = await resolveTemplateRefs(referencedTemplate.subTasks, templates, level + 1);
        resolved.push(...expandedSubTasks);
      } else {
        // Se è un template atomico, aggiungilo direttamente
        resolved.push({
          label: item.label || referencedTemplate.label,
          type: referencedTemplate.type,
          icon: referencedTemplate.icon,
          constraints: referencedTemplate.constraints || [],
          level: level // ✅ NUOVO: Tracciamo il livello
        });
      }
    } else {
      // Se non ha templateRef, aggiungi direttamente
      resolved.push({
        label: item.label,
        type: item.type,
        icon: item.icon,
        constraints: item.constraints || [],
        level: level // ✅ NUOVO: Tracciamo il livello
      });
    }
  }

  return resolved;
}

// ✅ NUOVO: Funzione per gestire template con 3 livelli
async function resolveTemplateRefsWithLevels(subTasks, templates) {
  return await resolveTemplateRefs(subTasks, templates, 0);
}

// Template cache verrà precaricata da preloadAllServerCaches()

// ✅ ENTERPRISE AI SERVICES INITIALIZATION
const aiProviderService = new AIProviderService();
const templateIntelligenceOrchestrator = new TemplateIntelligenceOrchestrator(aiProviderService);

// ✅ ENTERPRISE MIDDLEWARE INITIALIZATION
const circuitBreakerManager = new CircuitBreakerManager();
const rateLimiter = new RateLimiter();
const healthChecker = new AIHealthChecker(aiProviderService, circuitBreakerManager, rateLimiter);

console.log('>>> ENTERPRISE AI SERVICES INITIALIZED <<<');

// -----------------------------
// Helpers: naming & catalog
// -----------------------------
function slugifyName(str) {
  try {
    return String(str || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  } catch {
    return '';
  }
}

function abbreviateSlug(str, maxLen = 6) {
  const words = slugifyName(str).split('-').filter(Boolean);
  let abbr = words.slice(0, 4).map(w => w.slice(0, 1)).join('');
  if (abbr.length < 3) abbr = words.join('').slice(0, maxLen);
  const safe = (abbr || 'app').slice(0, maxLen);
  return safe || 'app';
}

function randomId(len = 8) {
  const base = (global.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Math.random().toString(36) + Math.random().toString(36));
  return base.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, len);
}

function makeProjectDbName(clientName, projectName) {
  const c = clientName ? abbreviateSlug(clientName, 6) : 'no-client';
  const p = abbreviateSlug(projectName, 6);
  let name = `t_${c}__p_${p}__${randomId(8)}`;
  if (name.length > 63) name = name.slice(0, 63);
  return name;
}

function makeProjectId() {
  return `proj_${randomId(10)}`;
}

async function getProjectCatalogRecord(mongoClient, projectId) {
  const db = mongoClient.db(dbProjects);
  const rec = await db.collection('projects_catalog').findOne({ $or: [{ _id: projectId }, { projectId }] });
  return rec || null;
}

async function getProjectDb(mongoClient, projectId) {
  const rec = await getProjectCatalogRecord(mongoClient, projectId);
  if (!rec || !rec.dbName) throw new Error('project_not_found_or_missing_dbName');
  logInfo('ProjectDB.resolve', { projectId, dbName: rec.dbName });
  return mongoClient.db(rec.dbName);
}

// -----------------------------
// Endpoints: DB name preview & catalog (non-distruttivi)
// -----------------------------
app.get('/api/projects/dbname/preview', async (req, res) => {
  try {
    const clientName = String(req.query.client || 'client');
    const projectName = String(req.query.project || 'project');
    const dbName = makeProjectDbName(clientName, projectName);
    res.json({
      dbName,
      clientSlug: slugifyName(clientName),
      projectSlug: slugifyName(projectName),
      clientAbbr: abbreviateSlug(clientName, 6),
      projectAbbr: abbreviateSlug(projectName, 6)
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.get('/api/projects/catalog', async (req, res) => {
  const startTime = Date.now();
  try {
    const client = await getMongoClient();
    const db = client.db(dbProjects);
    const queryStart = Date.now();
    // ✅ OPTIMIZATION: Sort by updatedAt (index should exist, but don't force hint if it doesn't)
    // Sort semplice: prima updatedAt, poi createdAt come fallback
    const list = await db.collection('projects_catalog')
      .find({})
      .sort({ updatedAt: -1, createdAt: -1 })
      .toArray();
    const queryDuration = Date.now() - queryStart;
    const duration = Date.now() - startTime;
    console.log('[Catalog.list] Found', list.length, 'projects in catalog');
    if (list.length > 0) {
      console.log('[Catalog.list] First project:', {
        _id: list[0]._id,
        projectName: list[0].projectName,
        updatedAt: list[0].updatedAt,
        createdAt: list[0].createdAt
      });
    }
    logInfo('Catalog.list', { count: Array.isArray(list) ? list.length : 0, duration: `${duration}ms`, queryDuration: `${queryDuration}ms` });
    res.json(list);
  } catch (e) {
    const duration = Date.now() - startTime;
    console.error('[Catalog.list] Error details:', {
      message: e?.message,
      stack: e?.stack,
      name: e?.name,
      duration: `${duration}ms`
    });
    logError('Catalog.list', e, { duration: `${duration}ms` });
    res.status(500).json({
      error: String(e?.message || e),
      details: process.env.NODE_ENV === 'development' ? e?.stack : undefined
    });
  }
});

// Endpoint: Get unique clients from catalog
// ✅ Test endpoints
app.get('/api/ping', (req, res) => {
  res.json({
    ok: true,
    express: 'running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/api/mongodb/ping', async (req, res) => {
  try {
    const client = await getMongoClient();
    const db = client.db('admin');
    const start = Date.now();
    await db.admin().ping();
    const latency = Date.now() - start;

    // Pool metrics (if available, otherwise 'unknown')
    let poolSize = 'unknown';
    let availableConnections = 'unknown';
    try {
      // Access to internal properties (fragile, but useful for debugging)
      const topology = client.topology;
      if (topology?.s?.pool) {
        poolSize = topology.s.pool.totalConnectionCount ?? 'unknown';
        availableConnections = topology.s.pool.availableConnectionCount ?? 'unknown';
      }
    } catch (e) {
      // Ignore errors accessing internal properties
    }

    res.json({
      ok: true,
      mongodb: 'connected',
      latency: `${latency}ms`,
      poolSize,
      availableConnections,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      mongodb: 'disconnected',
      error: String(e?.message || e),
      stack: process.env.NODE_ENV === 'development' ? e.stack : undefined,
    });
  }
});

// ✅ DIAGNOSTIC ENDPOINTS - Test colli di bottiglia
app.get('/api/test/catalog-structure', async (req, res) => {
  const startTime = Date.now();
  const client = await getMongoClient();
  try {
    const db = client.db(dbProjects);
    const coll = db.collection('projects_catalog');

    // Test 1: Conta documenti
    const countStart = Date.now();
    const count = await coll.countDocuments({});
    const countDuration = Date.now() - countStart;

    // Test 2: Prendi un documento di esempio
    const sampleStart = Date.now();
    const sample = await coll.findOne({});
    const sampleDuration = Date.now() - sampleStart;

    // Test 3: Verifica campi presenti
    const fields = sample ? Object.keys(sample) : [];

    // Test 4: Query semplice senza aggregation
    const simpleStart = Date.now();
    const simpleQuery = await coll.find({}).project({ clientName: 1 }).limit(5).toArray();
    const simpleDuration = Date.now() - simpleStart;

    // Test 5: Query aggregation (quella che potrebbe fallire)
    let aggregationResult = null;
    let aggregationError = null;
    let aggregationDuration = 0;
    try {
      const aggStart = Date.now();
      aggregationResult = await coll.aggregate([
        { $match: { clientName: { $exists: true, $ne: null } } },
        { $group: { _id: '$clientName' } },
        { $limit: 5 }
      ]).toArray();
      aggregationDuration = Date.now() - aggStart;
    } catch (e) {
      aggregationError = e.message;
      aggregationDuration = Date.now() - aggStart;
    }

    const totalDuration = Date.now() - startTime;

    res.json({
      success: true,
      timings: {
        total: `${totalDuration}ms`,
        countDocuments: `${countDuration}ms`,
        findOne: `${sampleDuration}ms`,
        simpleQuery: `${simpleDuration}ms`,
        aggregation: aggregationError ? `ERROR: ${aggregationDuration}ms` : `${aggregationDuration}ms`
      },
      data: {
        collectionSize: count,
        sampleFields: fields,
        sampleDocument: sample ? { _id: sample._id, clientName: sample.clientName, projectName: sample.projectName } : null,
        simpleQueryResult: simpleQuery,
        aggregationResult: aggregationResult,
        aggregationError: aggregationError
      },
      message: 'Database structure check completed'
    });
  } catch (e) {
    const totalDuration = Date.now() - startTime;
    res.status(500).json({
      success: false,
      error: e.message,
      stack: e.stack,
      duration: `${totalDuration}ms`,
      message: 'Database check failed'
    });
  }
});

// ✅ DNS diagnostic endpoint
app.get('/api/test/dns', async (req, res) => {
  const dns = require('dns').promises;
  const results = {
    srvLookup: { ok: false, error: null, duration: 0 },
    directLookup: { ok: false, error: null, duration: 0 }
  };

  // Test 1: SRV lookup (quello che fallisce)
  try {
    const srvStart = Date.now();
    const srvRecords = await dns.resolveSrv('_mongodb._tcp.omnia-db.a5j05mj.mongodb.net');
    results.srvLookup.duration = Date.now() - srvStart;
    results.srvLookup.ok = true;
    results.srvLookup.records = srvRecords;
  } catch (e) {
    results.srvLookup.error = e.message;
    results.srvLookup.duration = 0;
  }

  // Test 2: Direct hostname lookup
  try {
    const directStart = Date.now();
    const directRecords = await dns.resolve4('omnia-db.a5j05mj.mongodb.net');
    results.directLookup.duration = Date.now() - directStart;
    results.directLookup.ok = true;
    results.directLookup.records = directRecords;
  } catch (e) {
    results.directLookup.error = e.message;
    results.directLookup.duration = 0;
  }

  res.json({
    timestamp: new Date().toISOString(),
    results,
    recommendation: results.srvLookup.ok ? 'SRV lookup OK' : 'SRV lookup failed - check DNS/firewall'
  });
});

// ✅ Performance test endpoint
app.get('/api/test/performance', async (req, res) => {
  const results = {
    express: { ok: true, latency: 0 },
    mongodb: { ok: false, latency: 0, error: null },
    catalogQueries: { ok: false, timings: {}, errors: [] }
  };

  // Test 1: Express response time
  const expressStart = Date.now();
  results.express.latency = Date.now() - expressStart;

  // Test 2: MongoDB ping
  try {
    const client = await getMongoClient();
    const db = client.db('admin');
    const mongoStart = Date.now();
    await db.admin().ping();
    results.mongodb.latency = Date.now() - mongoStart;
    results.mongodb.ok = true;
  } catch (e) {
    results.mongodb.error = e.message;
  }

  // Test 3: Catalog queries
  try {
    const client = await getMongoClient();
    const db = client.db(dbProjects);
    const coll = db.collection('projects_catalog');

    // Test 3a: countDocuments
    const countStart = Date.now();
    await coll.countDocuments({});
    results.catalogQueries.timings.countDocuments = Date.now() - countStart;

    // Test 3b: find with projection
    const findStart = Date.now();
    await coll.find({}).project({ clientName: 1 }).limit(10).toArray();
    results.catalogQueries.timings.findProjection = Date.now() - findStart;

    // Test 3c: aggregation (simple)
    const aggStart = Date.now();
    try {
      await coll.aggregate([
        { $match: { clientName: { $exists: true, $ne: null } } },
        { $group: { _id: '$clientName' } },
        { $limit: 10 }
      ]).toArray();
      results.catalogQueries.timings.aggregation = Date.now() - aggStart;
    } catch (e) {
      results.catalogQueries.errors.push(`Aggregation failed: ${e.message}`);
    }

    results.catalogQueries.ok = true;
  } catch (e) {
    results.catalogQueries.errors.push(`Catalog query failed: ${e.message}`);
  }

  res.json({
    timestamp: new Date().toISOString(),
    results
  });
});

app.get('/api/projects/catalog/clients', async (req, res) => {
  const startTime = Date.now();
  const client = await getMongoClient(); // ✅ Usa pool invece di nuova connessione
  try {
    const db = client.db(dbProjects);
    const coll = db.collection('projects_catalog');

    // ✅ Optimized aggregation pipeline (rimosso $type per compatibilità)
    const clients = await coll.aggregate([
      { $match: { clientName: { $exists: true, $ne: null } } },
      { $group: { _id: '$clientName' } },
      { $match: { _id: { $ne: '', $regex: /^\s*\S/ } } }, // at least one non-whitespace char
      { $sort: { _id: 1 } },
      { $project: { _id: 0, clientName: '$_id' } },
    ]).toArray();

    // Trim e filtra stringhe lato JavaScript (più compatibile)
    const clientNames = clients
      .map(c => (c.clientName || '').trim())
      .filter(name => typeof name === 'string' && name.length > 0)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    const duration = Date.now() - startTime;
    logInfo('Catalog.clients', { count: clientNames.length, duration: `${duration}ms` });
    res.json(clientNames);
  } catch (e) {
    const duration = Date.now() - startTime;
    logError('Catalog.clients', e, { duration: `${duration}ms` });
    res.status(500).json({ error: String(e?.message || e) });
  }
  // ✅ NON chiudere la connessione se usi il pool
});

// Endpoint: Get unique project names from catalog
app.get('/api/projects/catalog/project-names', async (req, res) => {
  const startTime = Date.now();
  const client = await getMongoClient(); // ✅ Usa pool invece di nuova connessione
  try {
    const db = client.db(dbProjects);
    const coll = db.collection('projects_catalog');

    // ✅ Optimized aggregation pipeline
    const projects = await coll.aggregate([
      {
        $match: {
          $or: [
            { projectName: { $exists: true, $ne: null, $type: 'string' } },
            { name: { $exists: true, $ne: null, $type: 'string' } }
          ]
        }
      },
      {
        $project: {
          projectName: { $ifNull: ['$projectName', '$name'] }
        }
      },
      { $group: { _id: '$projectName' } },
      { $match: { _id: { $ne: '', $regex: /^\s*\S/ } } }, // at least one non-whitespace char
      { $sort: { _id: 1 } },
      { $project: { _id: 0, projectName: '$_id' } },
    ]).toArray();

    // Trim lato JavaScript (più compatibile con versioni MongoDB)
    const projectNames = projects
      .map(p => (p.projectName || '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    const duration = Date.now() - startTime;
    logInfo('Catalog.projectNames', { count: projectNames.length, duration: `${duration}ms` });
    res.json(projectNames);
  } catch (e) {
    const duration = Date.now() - startTime;
    logError('Catalog.projectNames', e, { duration: `${duration}ms` });
    res.status(500).json({ error: String(e?.message || e) });
  }
  // ✅ NON chiudere la connessione se usi il pool
});

app.post('/api/projects/catalog', async (req, res) => {
  const payload = req.body || {};
  const clientName = payload.clientName || null; // Permette null/vuoto
  const projectName = payload.projectName;
  if (!projectName) {
    return res.status(400).json({ error: 'projectName_required' });
  }
  const client = await getMongoClient();
  try {
    const db = client.db(dbProjects);
    const coll = db.collection('projects_catalog');
    const projectId = makeProjectId();
    const dbName = makeProjectDbName(clientName, projectName);
    const now = new Date();
    const doc = {
      _id: projectId,
      projectId,
      tenantId: payload.tenantId || null,
      clientName: clientName || null,
      projectName,
      clientSlug: clientName ? slugifyName(clientName) : null,
      projectSlug: slugifyName(projectName),
      industry: payload.industry || null,
      ownerCompany: payload.ownerCompany || null,
      ownerClient: payload.ownerClient || null,
      dbName,
      status: 'draft',
      createdAt: now,
      updatedAt: now
    };
    await coll.insertOne(doc);
    res.json(doc);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
  // ✅ NON chiudere la connessione se usi il pool
});

// DELETE catalog by id
app.delete('/api/projects/catalog/:id', async (req, res) => {
  const id = req.params.id;
  const client = await getMongoClient();
  try {
    const db = client.db(dbProjects);
    const coll = db.collection('projects_catalog');

    // ✅ Trova il progetto PRIMA di cancellarlo per ottenere il nome del database
    const project = await coll.findOne({ $or: [{ _id: id }, { projectId: id }] });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // ✅ REGOLA: 1 progetto = 1 database, sempre insieme
    // Elimina SEMPRE il database quando elimini il progetto, senza controlli
    let databaseDeleted = false;
    if (project.dbName) {
      try {
        const projectDb = client.db(project.dbName);
        // ✅ Elimina SEMPRE il database, senza controlli su collezioni
        await projectDb.dropDatabase();
        databaseDeleted = true;
        logInfo('Projects.delete', { projectId: id, dbName: project.dbName, deleted: true });
      } catch (dbError) {
        // ✅ Se il database non esiste, è OK (non è un errore critico)
        if (dbError.message?.includes('not found') || dbError.code === 26 || dbError.message?.includes('ns not found')) {
          logInfo('Projects.delete', { projectId: id, dbName: project.dbName, skipped: 'database does not exist' });
        } else {
          // ✅ Solo errori reali sono problemi - logga ma continua
          logWarn('Projects.delete', { projectId: id, dbName: project.dbName, error: dbError.message });
        }
      }
    } else {
      // Se dbName non è presente, prova pattern legacy come fallback
      const possibleDbNames = [
        `project_${id}`,
        `project_${project.projectId || id}`
      ].filter(Boolean);

      for (const dbName of possibleDbNames) {
        try {
          const projectDb = client.db(dbName);
          // ✅ Elimina SEMPRE il database, senza controlli
          await projectDb.dropDatabase();
          databaseDeleted = true;
          logInfo('Projects.delete', { projectId: id, dbName, deleted: true, fallback: true });
          break; // Trovato e eliminato, esci dal loop
        } catch (dbError) {
          // ✅ Se il database non esiste, continua con il prossimo pattern
          if (dbError.message?.includes('not found') || dbError.code === 26 || dbError.message?.includes('ns not found')) {
            // Database non esiste con questo pattern, continua
            continue;
          } else {
            logWarn('Projects.delete', { projectId: id, dbName, error: dbError.message, fallback: true });
          }
        }
      }
    }

    // ✅ Elimina dal catalogo (dopo aver eliminato il database)
    const result = await coll.deleteOne({ $or: [{ _id: id }, { projectId: id }] });

    if (result?.deletedCount === 0) {
      return res.status(404).json({ error: 'Project not found in catalog' });
    }

    res.json({
      ok: true,
      catalogDeleted: result?.deletedCount || 0,
      databaseDeleted
    });
  } catch (e) {
    logError('Projects.delete', e, { projectId: id });
    res.status(500).json({ error: String(e?.message || e) });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

// DELETE all catalog
app.delete('/api/projects/catalog', async (req, res) => {
  const client = await getMongoClient();
  try {
    const db = client.db(dbProjects);
    const coll = db.collection('projects_catalog');

    // ✅ Leggi tutti i progetti PRIMA di eliminarli per ottenere i dbName
    const allProjects = await coll.find({}).toArray();

    // ✅ Elimina i database di tutti i progetti
    let databasesDeleted = 0;
    let databasesErrors = 0;

    for (const project of allProjects) {
      if (project.dbName) {
        try {
          const projectDb = client.db(project.dbName);
          // ✅ REGOLA: Elimina SEMPRE il database, senza controlli
          await projectDb.dropDatabase();
          databasesDeleted++;
          logInfo('Projects.deleteAll', { dbName: project.dbName, deleted: true });
        } catch (dbError) {
          // ✅ Se il database non esiste, è OK (non è un errore critico)
          if (dbError.message?.includes('not found') || dbError.code === 26 || dbError.message?.includes('ns not found')) {
            logInfo('Projects.deleteAll', { dbName: project.dbName, skipped: 'database does not exist' });
          } else {
            databasesErrors++;
            logError('Projects.deleteAll', dbError, { dbName: project.dbName });
          }
        }
      }
    }

    // ✅ Elimina dal catalogo (dopo aver eliminato i database)
    const result = await coll.deleteMany({});

    logInfo('Projects.deleteAll', {
      catalogDeleted: result.deletedCount,
      databasesDeleted,
      databasesErrors
    });

    res.json({
      ok: true,
      catalogDeleted: result.deletedCount || 0,
      databasesDeleted,
      databasesErrors
    });
  } catch (e) {
    logError('Projects.deleteAll', e);
    res.status(500).json({ error: String(e?.message || e) });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

// -----------------------------
// DEPRECATED: AgentActs endpoints removed - use /api/factory/tasks instead

// -----------------------------
// Endpoint: Bootstrap progetto (crea DB e clona acts)
// -----------------------------
app.post('/api/projects/bootstrap', async (req, res) => {
  const payload = req.body || {};
  const clientName = payload.clientName || null; // Permette null/vuoto
  const projectName = payload.projectName;
  const industry = payload.industry || null;
  const language = payload.language || 'pt';
  const ownerCompany = payload.ownerCompany || null; // Owner del progetto lato azienda (obbligatorio)
  const ownerClient = payload.ownerClient || null; // Owner del progetto lato cliente (opzionale)
  const version = payload.version || '1.0';
  const versionQualifier = payload.versionQualifier || 'alpha';
  if (!projectName) {
    return res.status(400).json({ error: 'projectName_required' });
  }

  console.log('[Bootstrap] 🚀 START - Creating project:', { projectName, clientName, industry, language });
  const client = await getMongoClient();
  try {
    logInfo('Bootstrap', { message: 'Connecting to MongoDB...' });
    logInfo('Bootstrap', { message: 'Connected to MongoDB' });

    // 1) Catalogo: crea record se non esiste
    console.log('[Bootstrap] 📋 Step 1: Creating catalog entry...');
    const catalogDb = client.db(dbProjects);
    const cat = catalogDb.collection('projects_catalog');
    const now = new Date();
    const projectId = payload.projectId || makeProjectId();
    const dbName = payload.dbName || makeProjectDbName(clientName, projectName);
    console.log('[Bootstrap] 📋 Generated projectId:', projectId, 'dbName:', dbName);

    const catalogDoc = {
      _id: projectId,
      projectId,
      tenantId: payload.tenantId || null,
      clientName: clientName || null,
      projectName,
      clientSlug: clientName ? slugifyName(clientName) : null,
      projectSlug: slugifyName(projectName),
      industry,
      language,
      ownerCompany: ownerCompany || null,
      ownerClient: ownerClient || null,
      version,
      versionQualifier,
      dbName,
      status: 'active',
      createdAt: now,
      updatedAt: now
    };
    try {
      await cat.insertOne(catalogDoc);
      console.log('[Bootstrap] ✅ Catalog entry created');
    } catch (e) {
      // if already exists, update metadata (idempotent)
      console.log('[Bootstrap] ⚠️ Catalog entry already exists, updating...');
      await cat.updateOne({ _id: projectId }, { $set: { ...catalogDoc, createdAt: undefined, updatedAt: now } }, { upsert: true });
      console.log('[Bootstrap] ✅ Catalog entry updated');
    }

    // 2) Project DB handle
    console.log('[Bootstrap] 📦 Step 2: Setting up project database...');
    const projDb = client.db(dbName);
    const factoryDb = client.db(dbFactory);
    console.log('[Bootstrap] ✅ Project DB handle created');

    // 3) Scrivi metadati locali
    console.log('[Bootstrap] 📝 Step 3: Writing project metadata...');
    await projDb.collection('project_meta').updateOne(
      { _id: 'meta' },
      {
        $set: {
          projectId,
          tenantId: payload.tenantId || null,
          clientName: clientName || null,
          projectName,
          clientSlug: clientName ? slugifyName(clientName) : null,
          projectSlug: slugifyName(projectName),
          industry,
          language,
          ownerCompany: ownerCompany || null,
          ownerClient: ownerClient || null,
          version,
          versionQualifier,
          updatedAt: now
        },
        $setOnInsert: { createdAt: now }
      },
      { upsert: true }
    );
    console.log('[Bootstrap] ✅ Project metadata written');

    // 4) ✅ RIMOSSO: Non copiare template del Factory nel progetto
    // I template del Factory devono essere caricati solo in memoria quando servono
    // Il progetto contiene solo:
    // - Task Instances (con templateId che referenzia Factory o progetto)
    // - Template creati dall'utente (templateId: null = nuovo template locale)
    console.log('[Bootstrap] ✅ Template Factory non vengono copiati nel progetto (caricati solo in memoria quando servono)');
    const templatesInserted = 0; // ✅ Template non vengono più copiati, sempre 0

    // 5) Clona task_heuristics dalla factory al progetto
    console.log('[Bootstrap] 🔍 Step 5: Cloning task_heuristics from factory...');
    const heuristicsColl = factoryDb.collection('task_heuristics');
    const heuristics = await heuristicsColl.find({}).toArray();
    console.log('[Bootstrap] 🔍 Found', heuristics.length, 'heuristics in factory');

    let heuristicsInserted = 0;
    if (heuristics && heuristics.length > 0) {
      // Remove _id from MongoDB document (will be auto-generated)
      const mappedHeuristics = heuristics.map(h => {
        const doc = { ...h };
        delete doc._id; // Remove MongoDB _id, let MongoDB generate new one
        doc.createdAt = now;
        doc.updatedAt = now;
        return doc;
      });

      try {
        console.log('[Bootstrap] 💾 Inserting', mappedHeuristics.length, 'heuristics into project...');
        const result = await projDb.collection('task_heuristics').insertMany(mappedHeuristics, { ordered: false });
        heuristicsInserted = result.insertedCount || Object.keys(result.insertedIds || {}).length || 0;
        console.log('[Bootstrap] ✅ Inserted', heuristicsInserted, 'heuristics');
      } catch (insertError) {
        console.error('[Bootstrap] ⚠️ Error inserting task_heuristics:', insertError.message);
        console.error('[Bootstrap] ⚠️ Stack:', insertError.stack);
        // Continue even if insert fails (collection might already exist)
        heuristicsInserted = 0;
      }
    }

    // 6) Collezioni vuote necessarie e indici per performance
    console.log('[Bootstrap] 📊 Step 6: Creating indexes...');
    await projDb.collection('tasks').createIndex({ updatedAt: -1 }).catch(() => { });
    await projDb.collection('flow_nodes').createIndex({ updatedAt: -1 }).catch(() => { });
    await projDb.collection('flow_edges').createIndex({ updatedAt: -1 }).catch(() => { });

    // Indici per Translations collection (ottimizzazione caricamento)
    const translationsColl = projDb.collection('Translations');
    await translationsColl.createIndex({ language: 1, type: 1 }).catch(() => { });
    await translationsColl.createIndex({ guid: 1, language: 1 }).catch(() => { });
    console.log('[Bootstrap] ✅ Indexes created');

    console.log('[Bootstrap] ✅ SUCCESS - Project created:', { projectId, dbName, templatesInserted, heuristicsInserted });
    logInfo('Projects.bootstrap', {
      projectId,
      dbName,
      templatesInserted,
      heuristicsInserted
    });
    res.json({
      ok: true,
      projectId,
      dbName,
      counts: {
        tasks: templatesInserted,
        task_heuristics: heuristicsInserted
      }
    });
  } catch (e) {
    console.error('[Bootstrap] ❌ ERROR:', e.message);
    console.error('[Bootstrap] ❌ Stack:', e.stack);
    logError('Projects.bootstrap', e);
    res.status(500).json({ ok: false, error: String(e?.message || e), stack: e?.stack });
  } finally {
    console.log('[Bootstrap] 🔌 Closing MongoDB connection...');
  // ✅ NON chiudere la connessione se usi il pool
    console.log('[Bootstrap] 🔌 MongoDB connection closed');
  }
});

// -----------------------------
// Endpoints: Tasks per progetto
// -----------------------------
// GET /api/projects/:pid/tasks - Load project tasks
app.get('/api/projects/:pid/tasks', async (req, res) => {
  const projectId = req.params.pid;
  const client = await getMongoClient();
  try {
    const projDb = await getProjectDb(client, projectId);
    const factoryDb = client.db(dbFactory);

    // ✅ Carica task dal progetto
    const coll = projDb.collection('tasks');
    const projectTasks = await coll.find({}).toArray();

    // ✅ Raccogli tutti i templateId referenziati (ricorsivamente)
    const referencedTemplateIds = new Set();

    // Funzione per raccogliere templateId da un task
    const collectTemplateIds = (tasks) => {
      for (const task of tasks) {
        // Aggiungi templateId del task stesso se presente
        if (task.templateId) {
          referencedTemplateIds.add(task.templateId);
        }
        // Aggiungi subTasksIds (sono già templateId)
        if (task.subTasksIds && Array.isArray(task.subTasksIds)) {
          task.subTasksIds.forEach(id => {
            if (id) referencedTemplateIds.add(id);
          });
        }
        // Supporto legacy: subDataIds
        if (task.subDataIds && Array.isArray(task.subDataIds)) {
          task.subDataIds.forEach(id => {
            if (id) referencedTemplateIds.add(id);
          });
        }
      }
    };

    // Raccogli templateId dai task del progetto
    collectTemplateIds(projectTasks);

    // ✅ Carica ricorsivamente tutti i template referenziati dal factory
    const loadReferencedTemplatesRecursively = async (templateIds) => {
      if (templateIds.length === 0) return [];

      // Carica i template dal factory
      const factoryTemplates = await factoryDb.collection('tasks')
        .find({
          $or: [
            { id: { $in: templateIds } },
            { _id: { $in: templateIds } }
          ]
        })
        .toArray();

      // Normalizza gli ID (usa id o _id)
      const loadedTemplateIds = new Set();
      factoryTemplates.forEach(t => {
        const templateId = t.id || t._id?.toString();
        if (templateId) loadedTemplateIds.add(templateId);
      });

      // Raccogli nuovi templateId dai sub-template appena caricati
      const newTemplateIds = new Set();
      factoryTemplates.forEach(template => {
        if (template.subTasksIds && Array.isArray(template.subTasksIds)) {
          template.subTasksIds.forEach(id => {
            if (id && !referencedTemplateIds.has(id) && !loadedTemplateIds.has(id)) {
              newTemplateIds.add(id);
              referencedTemplateIds.add(id);
            }
          });
        }
        // Supporto legacy: subDataIds
        if (template.subDataIds && Array.isArray(template.subDataIds)) {
          template.subDataIds.forEach(id => {
            if (id && !referencedTemplateIds.has(id) && !loadedTemplateIds.has(id)) {
              newTemplateIds.add(id);
              referencedTemplateIds.add(id);
            }
          });
        }
      });

      // Carica ricorsivamente i sub-template
      if (newTemplateIds.size > 0) {
        const deeperTemplates = await loadReferencedTemplatesRecursively(Array.from(newTemplateIds));
        factoryTemplates.push(...deeperTemplates);
      }

      return factoryTemplates;
    };

    // Carica tutti i template referenziati dal factory
    const factoryTemplateIds = Array.from(referencedTemplateIds);
    const factoryTemplates = await loadReferencedTemplatesRecursively(factoryTemplateIds);

    // ✅ Rimuovi duplicati (usa id o _id come chiave)
    const templateMap = new Map();

    // Aggiungi prima i task del progetto (hanno priorità)
    projectTasks.forEach(task => {
      const taskId = task.id || task._id?.toString();
      if (taskId) {
        templateMap.set(taskId, task);
      }
    });

    // Aggiungi i template del factory (solo se non già presenti)
    factoryTemplates.forEach(template => {
      const templateId = template.id || template._id?.toString();
      if (templateId && !templateMap.has(templateId)) {
        templateMap.set(templateId, template);
      }
    });

    const allTasks = Array.from(templateMap.values());

    logInfo('TaskTemplates.get', {
      projectId,
      projectTasksCount: projectTasks.length,
      factoryTemplatesCount: factoryTemplates.length,
      totalCount: allTasks.length,
      referencedTemplateIdsCount: referencedTemplateIds.size
    });

    res.json({ items: allTasks });
  } catch (e) {
    logError('TaskTemplates.get', e, { projectId });
    res.status(500).json({ error: String(e?.message || e) });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

// ❌ RIMOSSO: Vecchio endpoint duplicato che richiedeva valueSchema
// ✅ Il nuovo endpoint alla riga 1533 gestisce correttamente i task senza valueSchema obbligatorio
// POST /api/projects/:pid/tasks - Create/update task in project (LEGACY - RIMOSSO)
// Questo endpoint è stato rimosso perché duplicato e obsoleto.
// Usa il nuovo endpoint alla riga 1533 che supporta il nuovo modello Task.

// -----------------------------
// Endpoints: Task Heuristics per progetto
// -----------------------------
// GET /api/projects/:pid/task-heuristics - Load project heuristics
// Ora carica da Task_Types del progetto (o factory come fallback)
app.get('/api/projects/:pid/task-heuristics', async (req, res) => {
  const projectId = req.params.pid;
  const client = await getMongoClient();
  try {
    const projDb = await getProjectDb(client, projectId);
    // Pattern sono ora in Heuristics (rinominata da Task_Types)
    const coll = projDb.collection('Heuristics');
    const taskTypes = await coll.find({ patterns: { $exists: true, $ne: null } }).toArray();

    // Se il progetto non ha Heuristics con pattern, usa quelli di factory
    if (taskTypes.length === 0) {
      console.log(`[TaskHeuristics] Project ${projectId} has no Heuristics with patterns, using factory patterns`);
      const factoryPatterns = await loadTaskHeuristicsFromDB();
      logInfo('TaskHeuristics.get', { projectId, source: 'factory', languages: Object.keys(factoryPatterns) });
      return res.json(factoryPatterns);
    }

    // Mapping da Heuristics._id a HeuristicType (per compatibilità con frontend)
    const typeMapping = {
      'AIAgent': 'AI_AGENT',
      'Message': 'MESSAGE',
      'DataRequest': 'REQUEST_DATA',
      'ProblemClassification': 'PROBLEM_SPEC_DIRECT',
      'Summary': 'SUMMARY',
      'BackendCall': 'BACKEND_CALL',
      'Negotiation': 'NEGOTIATION'
    };

    // Group by language (same format as Factory endpoint)
    const rulesByLang = {};
    taskTypes.forEach(taskType => {
      const taskTypeId = taskType._id;
      const heuristicType = typeMapping[taskTypeId];

      if (!heuristicType || !taskType.patterns) {
        return;
      }

      // I pattern in Heuristics sono strutturati come: { IT: [...], EN: [...], PT: [...] }
      Object.keys(taskType.patterns).forEach(lang => {
        const langUpper = lang.toUpperCase();

        if (!rulesByLang[langUpper]) {
          rulesByLang[langUpper] = {
            AI_AGENT: [],
            MESSAGE: [],
            REQUEST_DATA: [],
            PROBLEM_SPEC_DIRECT: [],
            PROBLEM_REASON: [],
            PROBLEM: null,
            SUMMARY: [],
            BACKEND_CALL: [],
            NEGOTIATION: []
          };
        }

        const patterns = taskType.patterns[lang];
        if (Array.isArray(patterns) && patterns.length > 0) {
          if (heuristicType === 'PROBLEM') {
            rulesByLang[langUpper].PROBLEM = patterns[0];
          } else if (rulesByLang[langUpper][heuristicType]) {
            rulesByLang[langUpper][heuristicType].push(...patterns);
          }
        }
      });
    });

    logInfo('TaskHeuristics.get', { projectId, source: 'project', languages: Object.keys(rulesByLang) });
    res.json(rulesByLang);
  } catch (e) {
    logError('TaskHeuristics.get', e, { projectId });
    res.status(500).json({ error: String(e?.message || e) });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

// -----------------------------
// Endpoints: Flow (nodi/edge) per progetto
// -----------------------------
app.get('/api/projects/:pid/flow', async (req, res) => {
  const pid = req.params.pid;
  const flowId = String(req.query.flowId || 'main');
  const startTime = Date.now();
  const client = await getMongoClient();
  try {
    const db = await getProjectDb(client, pid);
    const queryStart = Date.now();
    const [nodes, edges] = await Promise.all([
      db.collection('flow_nodes').find({ flowId }).toArray(),
      db.collection('flow_edges').find({ flowId }).toArray()
    ]);
    const queryDuration = Date.now() - queryStart;
    const duration = Date.now() - startTime;

    // ✅ LOG: Traccia cosa viene letto dal DB
    console.log(`[LOAD][backend] 📥 Reading from DB`, {
      projectId: pid,
      flowId,
      nodesCount: nodes?.length || 0,
      edgesCount: edges?.length || 0,
      duration: `${duration}ms`,
      queryDuration: `${queryDuration}ms`,
      nodes: nodes?.map((n) => ({
        id: n.id,
        label: n.label,
        rowsCount: n.rows?.length || 0,
        rows: n.rows?.map((r) => ({
          id: r.id,
          text: r.text,
          taskId: r.taskId,
          hasTaskId: !!r.taskId
        })) || []
      })) || []
    });

    logInfo('Flow.get', { projectId: pid, flowId, nodesCount: nodes?.length || 0, edgesCount: edges?.length || 0, duration: `${duration}ms`, queryDuration: `${queryDuration}ms` });
    res.json({ nodes, edges });
  } catch (e) {
    const duration = Date.now() - startTime;
    logError('Flow.get', e, { projectId: pid, flowId, duration: `${duration}ms` });
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.put('/api/projects/:pid/flow', async (req, res) => {
  const pid = req.params.pid;
  const flowId = String(req.query.flowId || 'main');
  const payload = req.body || {};
  const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
  const edges = Array.isArray(payload.edges) ? payload.edges : [];

  // ✅ LOG: Traccia cosa viene ricevuto dal frontend
  console.log(`[SAVE][backend] 📥 Received from frontend`, {
    projectId: pid,
    flowId,
    nodesCount: nodes.length,
    edgesCount: edges.length,
    nodes: nodes.map((n) => ({
      id: n.id,
      label: n.label,
      rowsCount: n.rows?.length || 0,
      rows: n.rows?.map((r) => ({
        id: r.id,
        text: r.text,
        hasHeuristics: !!(r.heuristics),
        heuristicsType: r.heuristics?.type
      })) || []
    }))
  });

  try {
    await withMongoClient(async (client) => {
      const db = await getProjectDb(client, pid);
    const ncoll = db.collection('flow_nodes');
    const ecoll = db.collection('flow_edges');
    // Diff-only upsert per flowId: assume nodes/edges carry stable id fields
    const now = new Date();
    let nUpserts = 0, nDeletes = 0, eUpserts = 0, eDeletes = 0;
    const existingNodes = await ncoll.find({ flowId }, { projection: { _id: 0, id: 1 } }).toArray();
    const existingEdges = await ecoll.find({ flowId }, { projection: { _id: 0, id: 1 } }).toArray();
    const existingNodeIds = new Set(existingNodes.map(d => d.id));
    const existingEdgeIds = new Set(existingEdges.map(d => d.id));

    // ✅ OPTIMIZATION: Use bulkWrite instead of sequential loops (much faster!)
    // Prepare bulk operations for nodes
    const nodeOps = [];
    for (const n of nodes) {
      if (!n || !n.id) continue;
      const { _id: _nid, ...nset } = n || {};
      nodeOps.push({
        updateOne: {
          filter: { id: n.id, flowId },
          update: { $set: { ...nset, flowId, updatedAt: now } },
          upsert: true
        }
      });
      nUpserts++;
      if (n.id) existingNodeIds.delete(n.id);
    }
    // Add delete operations for removed nodes
    if (existingNodeIds.size) {
      nodeOps.push({
        deleteMany: {
          filter: { id: { $in: Array.from(existingNodeIds) }, flowId }
        }
      });
      nDeletes = existingNodeIds.size;
    }

    // Execute bulk write for nodes
    if (nodeOps.length > 0) {
      await ncoll.bulkWrite(nodeOps, { ordered: false });
    }

    // Prepare bulk operations for edges
    const edgeOps = [];
    for (const e of edges) {
      if (!e || !e.id) continue;
      const { _id: _eid, ...eset } = e || {};
      edgeOps.push({
        updateOne: {
          filter: { id: e.id, flowId },
          update: { $set: { ...eset, flowId, updatedAt: now } },
          upsert: true
        }
      });
      eUpserts++;
      if (e.id) existingEdgeIds.delete(e.id);
    }
    // Add delete operations for removed edges
    if (existingEdgeIds.size) {
      edgeOps.push({
        deleteMany: {
          filter: { id: { $in: Array.from(existingEdgeIds) }, flowId }
        }
      });
      eDeletes = existingEdgeIds.size;
    }

    // Execute bulk write for edges
    if (edgeOps.length > 0) {
      await ecoll.bulkWrite(edgeOps, { ordered: false });
    }

      // ✅ LOG: Traccia cosa viene salvato nel DB
      console.log(`[SAVE][backend] 💾 Saving to DB`, {
        projectId: pid,
        flowId,
        nodesUpserts: nUpserts,
        nodesDeletes: nDeletes,
        edgesUpserts: eUpserts,
        edgesDeletes: eDeletes,
        nodes: nodes.map((n) => ({
          id: n.id,
          label: n.label,
          rowsCount: n.rows?.length || 0,
          rows: n.rows?.map((r) => ({
            id: r.id,
            text: r.text,
            taskId: r.taskId,
            hasTaskId: !!r.taskId
          })) || []
        }))
      });

      logInfo('Flow.put', {
        projectId: pid,
        flowId,
        payload: { nodes: nodes.length, edges: edges.length },
        result: { upserts: { nodes: nUpserts, edges: eUpserts }, deletes: { nodes: nDeletes, edges: eDeletes } }
      });
      res.json({ ok: true, nodes: nodes.length, edges: edges.length });
    });
  } catch (e) {
    logError('Flow.put', e, { projectId: pid, flowId, payloadNodes: nodes.length, payloadEdges: edges.length });
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// List flows (by distinct flowId in flow_nodes)
app.get('/api/projects/:pid/flows', async (req, res) => {
  const pid = req.params.pid;
  const client = await getMongoClient();
  try {
    const db = await getProjectDb(client, pid);
    const ncoll = db.collection('flow_nodes');
    const list = await ncoll.aggregate([
      { $group: { _id: '$flowId', updatedAt: { $max: '$updatedAt' } } },
      { $project: { _id: 0, id: '$_id', updatedAt: 1 } },
      { $sort: { updatedAt: -1 } }
    ]).toArray();
    res.json({ items: list });
  } catch (e) {
    logError('Flows.list', e, { projectId: pid });
    res.status(500).json({ error: String(e?.message || e) });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

// ✅ REMOVED: Endpoints /api/projects/:pid/acts (GET, POST, bulk) - acts migrati a tasks
// ✅ Tasks sono caricati/salvati via /api/projects/:pid/tasks

// -----------------------------
// Endpoint: Project Conditions (create/upsert)
// -----------------------------
app.post('/api/projects/:pid/conditions', async (req, res) => {
  const pid = req.params.pid;
  const payload = req.body || {};
  if (!payload || !payload._id || !payload.name) {
    return res.status(400).json({ error: 'id_and_name_required' });
  }
  const client = await getMongoClient();
  try {
    const db = await getProjectDb(client, pid);
    const coll = db.collection('project_conditions');
    const now = new Date();
    const doc = {
      _id: payload._id,
      name: payload.name,
      label: payload.label || payload.name,
      description: payload.description || '',
      data: payload.data || {},
      updatedAt: now
    };
    const setDoc = { ...doc };
    delete setDoc.createdAt;
    setDoc.updatedAt = now;
    await coll.updateOne(
      { _id: doc._id },
      { $set: setDoc, $setOnInsert: { createdAt: now } },
      { upsert: true }
    );
    const saved = await coll.findOne({ _id: doc._id });
    logInfo('Conditions.post', { projectId: pid, id: doc._id, name: doc.name });
    res.json(saved);
  } catch (e) {
    logError('Conditions.post', e, { projectId: pid, id: payload?._id });
    res.status(500).json({ error: String(e?.message || e) });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

// -----------------------------
// Endpoint: Project Conditions bulk upsert
// -----------------------------
app.post('/api/projects/:pid/conditions/bulk', async (req, res) => {
  const pid = req.params.pid;
  const payload = req.body || {};
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) {
    return res.json({ inserted: 0, updated: 0, total: 0 });
  }
  await withMongoClient(async (client) => {
    const db = await getProjectDb(client, pid);
    const coll = db.collection('project_conditions');
    const now = new Date();
    const bulkOps = items.map(item => ({
      updateOne: {
        filter: { _id: item._id || item.id },
        update: {
          $set: {
            name: item.name || item.label,
            label: item.label || item.name,
            description: item.description || '',
            data: item.data || {},
            updatedAt: now
          },
          $setOnInsert: { createdAt: now }
        },
        upsert: true
      }
    }));
    const result = await coll.bulkWrite(bulkOps);
    logInfo('Conditions.bulk', { projectId: pid, inserted: result.upsertedCount, updated: result.modifiedCount, total: items.length });
    res.json({ inserted: result.upsertedCount, updated: result.modifiedCount, total: items.length });
  }).catch((e) => {
    logError('Conditions.bulk', e, { projectId: pid });
    res.status(500).json({ error: String(e?.message || e) });
  });
});

// -----------------------------
// Endpoint: Get Project Conditions
// -----------------------------
app.get('/api/projects/:pid/conditions', async (req, res) => {
  const pid = req.params.pid;
  const startTime = Date.now();
  const client = await getMongoClient();
  try {
    const db = await getProjectDb(client, pid);
    const coll = db.collection('project_conditions');
    const queryStart = Date.now();
    const items = await coll.find({}).toArray();
    const queryDuration = Date.now() - queryStart;
    const duration = Date.now() - startTime;
    logInfo('Conditions.get', { projectId: pid, count: items.length, duration: `${duration}ms`, queryDuration: `${queryDuration}ms` });
    res.json({ items });
  } catch (e) {
    const duration = Date.now() - startTime;
    logError('Conditions.get', e, { projectId: pid, duration: `${duration}ms` });
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// ✅ REMOVED: Endpoints /api/projects/:pid/instances (POST, PUT, GET, bulk) - legacy act_instances
// ✅ Use /api/projects/:pid/tasks instead - unified model saves to tasks collection

// -----------------------------
// Endpoints: Tasks (new model)
// -----------------------------

// GET /api/projects/:pid/tasks - Load all tasks
app.get('/api/projects/:pid/tasks', async (req, res) => {
  const projectId = req.params.pid;
  const startTime = Date.now();
  const client = await getMongoClient();
  try {
    const projDb = await getProjectDb(client, projectId);
    const coll = projDb.collection('tasks');
    const queryStart = Date.now();
    // ✅ OPTIMIZATION: Sort by projectId and updatedAt (index should exist)
    const items = await coll
      .find({ projectId })
      .sort({ updatedAt: -1 })
      .toArray();
    const queryDuration = Date.now() - queryStart;
    const duration = Date.now() - startTime;
    logInfo('Tasks.get', { projectId, count: items.length, duration: `${duration}ms`, queryDuration: `${queryDuration}ms` });
    res.json({ count: items.length, items });
  } catch (e) {
    const duration = Date.now() - startTime;
    logError('Tasks.get', e, { projectId, duration: `${duration}ms` });
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// ✅ Helper: Validate GUID format
function isValidGuid(str) {
  if (!str || typeof str !== 'string') return false;
  const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return guidRegex.test(str);
}

// ✅ Helper: Validate TaskType enum (0-19 or -1 for UNDEFINED)
function isValidTaskType(type) {
  return typeof type === 'number' && type >= -1 && type <= 19;
}

/**
 * Determina gli allowedContexts di un task in base al suo type
 * @param {number} type - TaskType enum (0-19 o -1)
 * @returns {string[]} - Array di contesti dove il task può essere usato (es. ['escalation'])
 */
function getAllowedContexts(type) {
  if (typeof type !== 'number') return [];

  // Task types che possono essere in escalation
  const ESCALATION_TYPES = [
    0,  // SayMessage
    1,  // CloseSession
    2,  // Transfer
    4,  // BackendCall
    6,  // SendSMS
    7,  // SendEmail
    8,  // EscalateToHuman
    9,  // EscalateToGuardVR
    10, // ReadFromBackend
    11, // WriteToBackend
    12, // LogData
    13, // LogLabel
    14, // PlayJingle
    15, // Jump
    16, // HangUp
    17, // Assign
    18, // Clear
    19  // WaitForAgent
  ];

  // Se il type è in ESCALATION_TYPES, può essere usato in escalation
  if (ESCALATION_TYPES.includes(type)) {
    return ['escalation'];
  }

  // Altrimenti, nessun contesto (default safe)
  return [];
}

// ============================================================================
// Task Classification Functions
// ============================================================================
/**
 * Determines if a document is a task instance
 * Instance: has templateId !== null (references a template)
 */
function isInstance(doc) {
  return doc.templateId !== null && doc.templateId !== undefined;
}

/**
 * Determines if a document is a Factory template
 * Factory Template: templateId === null AND has Factory-specific fields
 */
function isFactoryTemplate(doc) {
  if (doc.templateId !== null && doc.templateId !== undefined) {
    return false; // Instances are not Factory templates
  }

  // Check for Factory-specific fields
  return (
    doc.version !== undefined ||
    doc.versionNote !== undefined ||
    doc.dataContract !== undefined ||
    doc.dataContracts !== undefined ||
    doc.patterns !== undefined ||
    doc.valueSchema !== undefined ||
    doc.subTasksIds !== undefined
  );
}

/**
 * Determines if a document is a local project template
 * Local Template: templateId === null AND NOT a Factory template
 */
function isLocalTemplate(doc) {
  return doc.templateId === null && !isFactoryTemplate(doc);
}

/**
 * Removes Factory-specific fields from a document
 * Used when saving Local Templates to ensure they don't have Factory fields
 */
function removeFactoryFields(doc) {
  const cleaned = { ...doc };
  delete cleaned.version;
  delete cleaned.versionNote;
  delete cleaned.dataContract;
  delete cleaned.dataContracts;
  delete cleaned.patterns;
  delete cleaned.valueSchema;
  // Note: subTasksIds is allowed in Local Templates (they can reference other templates)
  return cleaned;
}

// POST /api/projects/:pid/tasks - Create or update task (upsert)
app.post('/api/projects/:pid/tasks', async (req, res) => {
  const projectId = req.params.pid;
  const payload = req.body || {};
  const templateId = payload.templateId;
  const type = payload.type;

  // ✅ Validate id is present
  if (!payload.id) {
    return res.status(400).json({ error: 'id_required' });
  }

  // ✅ Validate type is present and valid
  if (type === undefined || type === null) {
    return res.status(400).json({ error: 'type_required', message: 'Task type (enum 0-19) is required' });
  }
  if (!isValidTaskType(type)) {
    return res.status(400).json({ error: 'invalid_type', message: `Task type must be a number between -1 and 19, got: ${type}` });
  }

  // ✅ Validate templateId: must be null (standalone) or a valid GUID (reference)
  if (templateId !== null && templateId !== undefined) {
    if (typeof templateId !== 'string') {
      return res.status(400).json({ error: 'invalid_templateId', message: 'templateId must be null (standalone) or a GUID string (reference)' });
    }
    if (!isValidGuid(templateId)) {
      // ✅ Reject semantic strings like "GetData", "SayMessage", "UNDEFINED"
      return res.status(400).json({
        error: 'invalid_templateId',
        message: `templateId must be null (standalone) or a valid GUID (reference). Got semantic string: "${templateId}". Use type field for task behavior.`
      });
    }
  }

  const client = await getMongoClient();
  try {
    const projDb = await getProjectDb(client, projectId);
    const now = new Date();

    // ✅ Extract all fields except id, templateId, createdAt, updatedAt, and legacy fields
    // ✅ NUOVO MODELLO: Rimuovi data, steps, constraints dalle istanze (non dai template)
    const { id, templateId: _templateId, createdAt, updatedAt, data, steps, constraints, ...fields } = payload;

    // ✅ Determina allowedContexts in base al type (se non è già specificato nel payload)
    const allowedContextsValue = payload.allowedContexts !== undefined
      ? payload.allowedContexts
      : getAllowedContexts(type);

    // ✅ CLASSIFICAZIONE: Determina il tipo di documento usando le funzioni di classificazione
    let task;
    if (isInstance(payload)) {
      // ✅ ISTANZA: Salva SOLO campi permessi (id, type, templateId, templateVersion, labelKey, steps, createdAt, updatedAt)
      // ✅ type è OBBLIGATORIO anche per istanze (necessario per il caricamento)
      // ❌ NON salvare: nodes, subNodes, icon, constraints, dataContract, examples, nlpProfile, patterns, valueSchema, allowedContexts
      task = {
        projectId,
        id: payload.id,
        type: type,  // ✅ OBBLIGATORIO: type è necessario per il caricamento (TaskRepository lo richiede)
        templateId: templateId,  // ✅ OBBLIGATORIO per istanze (non può essere null)
        templateVersion: payload.templateVersion || 1,  // ✅ Versione del template
        labelKey: payload.labelKey,  // ✅ Chiave di traduzione
        steps: payload.steps,  // ✅ Array MaterializedStep[] (DEVE essere salvato!)
        updatedAt: now
      };

      // ✅ Rimuovi esplicitamente campi del template se presenti (per sicurezza)
      // ❌ NON rimuovere type - è necessario per il caricamento
      delete task.nodes;
      delete task.subNodes;
      delete task.icon;
      delete task.constraints;
      delete task.dataContract;
      delete task.examples;
      delete task.nlpProfile;
      delete task.patterns;
      delete task.valueSchema;
      delete task.allowedContexts;
      delete task.data;
      delete task.introduction;
    } else if (isLocalTemplate(payload)) {
      // ✅ LOCAL TEMPLATE: Salva nel progetto, ma rimuovi campi da Factory
      const cleanedFields = removeFactoryFields(fields);
      task = {
        projectId,
        id: payload.id,
        type: type,              // ✅ type: enum numerico (0-19) - REQUIRED
        templateId: null,        // ✅ Local Template ha sempre templateId = null
        allowedContexts: allowedContextsValue,
        ...cleanedFields,  // ✅ Save fields without Factory-specific ones
        updatedAt: now
      };
    } else {
      // ❌ CASO NON VALIDO: templateId === null ma non è né Factory né Local Template
      // (Questo caso non dovrebbe mai verificarsi se isFactoryTemplate è implementato correttamente)
      logError('Tasks.post', new Error('Invalid task classification'), {
        projectId,
        taskId: payload.id,
        templateId: payload.templateId,
        hasVersion: payload.version !== undefined,
        hasVersionNote: payload.versionNote !== undefined
      });
      return res.status(400).json({
        error: 'invalid_task_classification',
        message: 'Task cannot be classified as instance, Factory template, or local template'
      });
    }

    // Upsert: create if not exists, update if exists
    const result = await projDb.collection('tasks').updateOne(
      { projectId, id: payload.id },
      {
        $set: task,
        $setOnInsert: { createdAt: now }
      },
      { upsert: true }
    );

    const saved = await projDb.collection('tasks').findOne({ projectId, id: payload.id });
    logInfo('Tasks.post', {
      projectId,
      taskId: payload.id,
      templateId: templateId,
      upserted: result.upsertedCount > 0,
      modified: result.modifiedCount > 0,
      hasMainData: !!saved?.mainData,
      mainDataLength: saved?.mainData?.length || 0,
      payloadKeys: Object.keys(payload),
      hasMainDataInPayload: !!payload.mainData,
      mainDataLengthInPayload: payload.mainData?.length || 0
    });
    res.json(saved);
  } catch (e) {
    logError('Tasks.post', e, {
      projectId,
      taskId: payload?.id,
      errorMessage: e?.message,
      errorStack: e?.stack?.substring(0, 500),
      payloadKeys: payload ? Object.keys(payload) : [],
      hasMainData: !!payload?.mainData,
      mainDataType: typeof payload?.mainData,
      mainDataLength: Array.isArray(payload?.mainData) ? payload.mainData.length : 'not array'
    });
    res.status(500).json({ error: String(e?.message || e) });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

// PUT /api/projects/:pid/tasks/:taskId - Update task
app.put('/api/projects/:pid/tasks/:taskId', async (req, res) => {
  const projectId = req.params.pid;
  const taskId = req.params.taskId;
  const payload = req.body || {};
  const client = await getMongoClient();
  try {
    const projDb = await getProjectDb(client, projectId);

    // Find by id field (not _id)
    const existing = await projDb.collection('tasks').findOne({ projectId, id: taskId });
    if (!existing) {
      return res.status(404).json({ error: 'task_not_found' });
    }

    // ✅ Validate type if provided
    if (payload.type !== undefined && payload.type !== null) {
      if (!isValidTaskType(payload.type)) {
        return res.status(400).json({ error: 'invalid_type', message: `Task type must be a number between -1 and 19, got: ${payload.type}` });
      }
    }

    // ✅ Validate templateId if provided
    if (payload.templateId !== undefined && payload.templateId !== null) {
      if (typeof payload.templateId !== 'string') {
        return res.status(400).json({ error: 'invalid_templateId', message: 'templateId must be null (standalone) or a GUID string (reference)' });
      }
      if (!isValidGuid(payload.templateId)) {
        return res.status(400).json({
          error: 'invalid_templateId',
          message: `templateId must be null (standalone) or a valid GUID (reference). Got semantic string: "${payload.templateId}". Use type field for task behavior.`
        });
      }
    }

    // ✅ Extract all fields except id, createdAt, updatedAt
    // ✅ Update fields directly (no value wrapper)
    const { id, createdAt, updatedAt, ...fields } = payload;

    const update = {
      ...fields,  // ✅ Update all fields directly (mainData, label, steps, ecc.)
      updatedAt: new Date()
    };

    // ✅ Normalize templateId: if provided, ensure it's null or valid GUID
    if (payload.templateId !== undefined) {
      update.templateId = payload.templateId ?? null;
    }

    // ✅ CLASSIFICAZIONE: Blocca Factory Template dopo merge con existing
    const mergedDoc = { ...existing, ...update };
    if (isFactoryTemplate(mergedDoc)) {
      logError('Tasks.put', new Error('Factory template cannot be saved to project database'), {
        projectId,
        taskId,
        reason: 'Factory templates must remain in Factory database only'
      });
      return res.status(400).json({
        error: 'factory_template_not_allowed',
        message: 'Factory templates cannot be saved to project database. They must remain in Factory database only.'
      });
    }

    // ✅ Se è Local Template, rimuovi campi Factory
    if (isLocalTemplate(mergedDoc)) {
      const cleanedUpdate = removeFactoryFields(update);
      Object.assign(update, cleanedUpdate);
    }

    // ✅ Se è Instance, filtra solo campi permessi
    if (isInstance(mergedDoc)) {
      // Mantieni solo campi permessi per istanze (incluso type che è necessario per il caricamento)
      const allowedFields = ['type', 'templateId', 'templateVersion', 'labelKey', 'steps', 'updatedAt'];
      const filteredUpdate = {};
      for (const key of allowedFields) {
        if (update[key] !== undefined) {
          filteredUpdate[key] = update[key];
        }
      }
      // ✅ type NON viene rimosso - è necessario per il caricamento
      delete filteredUpdate.nodes;
      delete filteredUpdate.subNodes;
      delete filteredUpdate.icon;
      delete filteredUpdate.constraints;
      delete filteredUpdate.dataContract;
      delete filteredUpdate.examples;
      delete filteredUpdate.nlpProfile;
      delete filteredUpdate.patterns;
      delete filteredUpdate.valueSchema;
      delete filteredUpdate.allowedContexts;
      delete filteredUpdate.data;
      delete filteredUpdate.introduction;
      Object.assign(update, filteredUpdate);
    }

    await projDb.collection('tasks').updateOne(
      { projectId, id: taskId },
      { $set: update }
    );

    const updated = await projDb.collection('tasks').findOne({ projectId, id: taskId });
    logInfo('Tasks.put', {
      projectId,
      taskId,
      updatedFields: Object.keys(update),
      hasMainData: !!updated?.mainData,
      mainDataLength: updated?.mainData?.length || 0
    });
    res.json(updated);
  } catch (e) {
    logError('Tasks.put', e, { projectId, taskId });
    res.status(500).json({ error: String(e?.message || e) });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

// DELETE /api/projects/:pid/tasks/:taskId - Delete task
app.delete('/api/projects/:pid/tasks/:taskId', async (req, res) => {
  const projectId = req.params.pid;
  const taskId = req.params.taskId;
  const client = await getMongoClient();
  try {
    const projDb = await getProjectDb(client, projectId);
    const result = await projDb.collection('tasks').deleteOne({ projectId, id: taskId });
    logInfo('Tasks.delete', { projectId, taskId, deleted: result.deletedCount > 0 });
    res.json({ deleted: result.deletedCount > 0 });
  } catch (e) {
    logError('Tasks.delete', e, { projectId, taskId });
    res.status(500).json({ error: String(e?.message || e) });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

// POST /api/projects/:pid/tasks/bulk - Bulk save tasks
app.post('/api/projects/:pid/tasks/bulk', async (req, res) => {
  const projectId = req.params.pid;
  const payload = req.body || {};
  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (!items.length) return res.json({ ok: true, inserted: 0, updated: 0 });

  const tStart = Date.now();
  try {
    await withMongoClient(async (client) => {
      const projDb = await getProjectDb(client, projectId);
      const coll = projDb.collection('tasks');
      const now = new Date();

      // ✅ OPTIMIZATION: Use bulkWrite instead of sequential findOne + updateOne/insertOne
      // This reduces 2*N database calls to just 1 bulk operation!
      const bulkOps = items
        .filter(item => {
          // ✅ Validate: id is required
          if (!item.id) {
            console.error('[💾 BACKEND_BULK] Missing id', { item: JSON.stringify(item).substring(0, 200) });
            logWarn('Tasks.bulk', { error: 'missing_id', item });
            return false;
          }
          // ✅ Validate: type is required and valid
          if (item.type === undefined || item.type === null || !isValidTaskType(item.type)) {
            console.error('[💾 BACKEND_BULK] Invalid type', {
              itemId: item.id,
              type: item.type,
              typeOf: typeof item.type
            });
            logWarn('Tasks.bulk', { error: 'missing_or_invalid_type', itemId: item.id, type: item.type });
            return false;
          }
          // ✅ Validate: templateId must be null or valid GUID (reject semantic strings)
          if (item.templateId !== null && item.templateId !== undefined) {
            if (typeof item.templateId !== 'string' || !isValidGuid(item.templateId)) {
              console.error('[💾 BACKEND_BULK] Invalid templateId', {
                itemId: item.id,
                templateId: item.templateId,
                type: item.type,
                isGuid: isValidGuid(item.templateId)
              });
              logWarn('Tasks.bulk', { error: 'invalid_templateId', itemId: item.id, templateId: item.templateId });
              return false;
            }
          }
          return true;
        })
        .map(item => {
          // ✅ Extract all fields except id, templateId, createdAt, updatedAt, and legacy fields
          const { id, templateId, createdAt, updatedAt, data, steps, constraints, ...fields } = item;

          // ✅ CLASSIFICAZIONE: Determina il tipo di documento usando le funzioni di classificazione
          let task;
          if (isInstance(item)) {
            // ✅ ISTANZA: Salva SOLO campi permessi (id, type, templateId, templateVersion, labelKey, steps, createdAt, updatedAt)
            // ✅ type è OBBLIGATORIO anche per istanze (necessario per il caricamento)
            // ❌ NON salvare: nodes, subNodes, icon, constraints, dataContract, examples, nlpProfile, patterns, valueSchema, allowedContexts
            task = {
              projectId,
              id: item.id,
              type: item.type,  // ✅ OBBLIGATORIO: type è necessario per il caricamento (TaskRepository lo richiede)
              templateId: templateId,  // ✅ OBBLIGATORIO per istanze (non può essere null)
              templateVersion: item.templateVersion || 1,  // ✅ Versione del template
              labelKey: item.labelKey,  // ✅ Chiave di traduzione
              steps: item.steps,  // ✅ Array MaterializedStep[] (DEVE essere salvato!)
              updatedAt: now
            };

            // ✅ Rimuovi esplicitamente campi del template se presenti (per sicurezza)
            // ❌ NON rimuovere type - è necessario per il caricamento
            delete task.nodes;
            delete task.subNodes;
            delete task.icon;
            delete task.constraints;
            delete task.dataContract;
            delete task.examples;
            delete task.nlpProfile;
            delete task.patterns;
            delete task.valueSchema;
            delete task.allowedContexts;
            delete task.data;
            delete task.introduction;
          } else if (isLocalTemplate(item)) {
            // ✅ LOCAL TEMPLATE: Salva nel progetto, ma rimuovi campi da Factory
            const cleanedFields = removeFactoryFields(fields);
            task = {
              projectId,
              id: item.id,
              type: item.type,              // ✅ type: enum numerico (0-19) - REQUIRED
              templateId: null,        // ✅ Local Template ha sempre templateId = null
              allowedContexts: item.allowedContexts || getAllowedContexts(item.type),
              ...cleanedFields,  // ✅ Save fields without Factory-specific ones
              updatedAt: now
            };
          } else {
            // ❌ CASO NON VALIDO: templateId === null ma non è né Factory né Local Template
            // (Questo caso non dovrebbe mai verificarsi se isFactoryTemplate è implementato correttamente)
            console.error('[💾 BACKEND_BULK] Invalid task classification', {
              itemId: item.id,
              templateId: item.templateId,
              hasVersion: item.version !== undefined,
              hasVersionNote: item.versionNote !== undefined
            });
            logWarn('Tasks.bulk', {
              error: 'invalid_task_classification',
              itemId: item.id
            });
            return null; // Return null to skip this item
          }

          // ✅ Return null se task non è valido (verrà filtrato dopo)
          if (!task) return null;

          return {
            updateOne: {
              filter: { projectId, id: item.id },
              update: {
                $set: task,
                $setOnInsert: { createdAt: now }
              },
              upsert: true
            }
          };
        })
        .filter(op => op !== null); // ✅ Rimuovi operazioni null (item saltati)

      let inserted = 0;
      let updated = 0;

      if (bulkOps.length > 0) {
        console.log('[💾 BACKEND_BULK] Executing bulkWrite', {
          opsCount: bulkOps.length,
          totalItems: items.length,
          filteredOut: items.length - bulkOps.length
        });

        const tBulk = Date.now();
        try {
          const result = await coll.bulkWrite(bulkOps, { ordered: false });
          const tBulkEnd = Date.now();
          console.log('[💾 BACKEND_BULK] bulkWrite success', {
            duration: `${tBulkEnd - tBulk}ms`,
            inserted: result.upsertedCount,
            updated: result.modifiedCount,
            matched: result.matchedCount
          });
          inserted = result.upsertedCount;
          updated = result.modifiedCount;
        } catch (bulkError) {
          console.error('[💾 BACKEND_BULK] bulkWrite failed', {
            error: bulkError?.message || bulkError,
            opsCount: bulkOps.length
          });
          throw bulkError;
        }
      } else {
        console.warn('[💾 BACKEND_BULK] No valid operations after filtering', {
          totalItems: items.length
        });
      }

      const tEnd = Date.now();
      console.log('[💾 BACKEND_BULK] Complete', {
        duration: `${tEnd - tStart}ms`,
        inserted,
        updated,
        total: items.length
      });
      logInfo('Tasks.bulk', { projectId, inserted, updated, total: items.length });
      res.json({ ok: true, inserted, updated });
    });
  } catch (e) {
    const tEnd = Date.now();
    console.error('[💾 BACKEND_BULK] ERROR', {
      duration: `${tEnd - tStart}ms`,
      error: e?.message || e,
      stack: e?.stack,
      projectId,
      itemsCount: items.length
    });
    logError('Tasks.bulk', e, { projectId, itemsCount: items.length });
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// GET /api/projects/:pid/variable-mappings - Get variable mappings for project
app.get('/api/projects/:pid/variable-mappings', async (req, res) => {
  const projectId = req.params.pid;
  const startTime = Date.now();
  const client = await getMongoClient();
  try {
    const projDb = await getProjectDb(client, projectId);
    const queryStart = Date.now();
    const doc = await projDb.collection('variable_mappings').findOne({ projectId });
    const queryDuration = Date.now() - queryStart;

    if (!doc) {
      const duration = Date.now() - startTime;
      logInfo('VariableMappings.get', { projectId, found: false, duration: `${duration}ms` });
      return res.status(404).json({ error: 'not_found' });
    }

    const duration = Date.now() - startTime;
    const mappingsCount = (doc.mappings || []).length;
    logInfo('VariableMappings.get', { projectId, found: true, mappingsCount, duration: `${duration}ms`, queryDuration: `${queryDuration}ms` });
    res.json({
      version: doc.version || '1.0',
      mappings: doc.mappings || [],
      nodeIdToReadableName: doc.nodeIdToReadableName || [],
      taskIdToReadableNames: doc.taskIdToReadableNames || [],
      taskIdToSnapshot: doc.taskIdToSnapshot || []
    });
  } catch (e) {
    const duration = Date.now() - startTime;
    logError('VariableMappings.get', e, { projectId, duration: `${duration}ms` });
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// POST /api/projects/:pid/variable-mappings - Save variable mappings for project
app.post('/api/projects/:pid/variable-mappings', async (req, res) => {
  const projectId = req.params.pid;
  const payload = req.body || {};
  const client = await getMongoClient();
  try {
    const projDb = await getProjectDb(client, projectId);
    const now = new Date();

    const doc = {
      projectId,
      version: payload.version || '1.0',
      mappings: payload.mappings || [],
      nodeIdToReadableName: payload.nodeIdToReadableName || [],
      taskIdToReadableNames: payload.taskIdToReadableNames || [],
      taskIdToSnapshot: payload.taskIdToSnapshot || [],
      updatedAt: now
    };

    const result = await projDb.collection('variable_mappings').updateOne(
      { projectId },
      {
        $set: doc,
        $setOnInsert: { createdAt: now }
      },
      { upsert: true }
    );

    logInfo('VariableMappings.post', {
      projectId,
      upserted: result.upsertedCount > 0,
      modified: result.modifiedCount > 0,
      mappingsCount: doc.mappings.length
    });

    res.json({ ok: true, upserted: result.upsertedCount > 0, modified: result.modifiedCount > 0 });
  } catch (e) {
    logError('VariableMappings.post', e, { projectId });
    res.status(500).json({ error: String(e?.message || e) });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

// Helper functions for mode/isInteractive migration
function deriveModeFromDoc(doc) {
  if (doc.mode) {
    console.log(`>>> deriveModeFromDoc: ${doc._id} has existing mode: ${doc.mode}`);
    return doc.mode;
  }
  if (doc.isInteractive === true) {
    console.log(`>>> deriveModeFromDoc: ${doc._id} isInteractive=true -> DataRequest`);
    return 'DataRequest';
  }
  if (doc.isInteractive === false) {
    console.log(`>>> deriveModeFromDoc: ${doc._id} isInteractive=false -> Message`);
    return 'Message';
  }
  console.log(`>>> deriveModeFromDoc: ${doc._id} fallback -> Message`);
  return 'Message'; // fallback
}

function deriveIsInteractiveFromMode(mode) {
  const result = mode === 'DataRequest' || mode === 'DataConfirmation';
  console.log(`>>> deriveIsInteractiveFromMode: ${mode} -> ${result}`);
  return result;
}

// --- FACTORY ENDPOINTS ---
// DEPRECATED: Legacy AgentActs endpoints removed - use /api/factory/task-templates-v2 instead

// -----------------------------
// ✅ STEP 4: Factory Tasks
// Endpoint per caricare Tasks con scope filtering
// -----------------------------
app.get('/api/factory/tasks', async (req, res) => {
  const client = await getMongoClient();
  try {
    const db = client.db(dbFactory);

    // Parametri query per scope filtering e taskType
    const { scopes, context, projectId, industry, taskType } = req.query;

    // ✅ NUOVO: Gestisci taskType query parameter (es. taskType=Action)
    // Se taskType è fornito, filtra per tipo di task
    // Action types sono enum 6-19 (SendSMS=6, SendEmail=7, EscalateToHuman=8, ecc.)
    if (taskType === 'Action') {
      try {
        // ✅ Query per Action tasks (type enum 6-19)
        const actionTasks = await db.collection('tasks').find({
          type: { $gte: 6, $lte: 19 }  // ✅ Action types: enum 6-19
        }).toArray();

        // Convert to old format for backward compatibility
        const formattedActions = actionTasks.map(action => ({
          id: action.id?.replace('-template', '') || action._id?.replace('-template', ''),
          label: action.label || '',
          description: action.description || '',
          icon: action.icon || 'Circle',
          color: action.color || 'text-gray-500',
          params: action.structure || action.params || {},
          type: action.type
        }));

        console.log(`[FactoryTasks] Found ${formattedActions.length} Action tasks`);
        return res.json(formattedActions);
      } catch (actionError) {
        console.error('[FactoryTasks] Error querying Action tasks:', {
          message: actionError.message,
          stack: actionError.stack,
          taskType
        });
        return res.status(500).json({
          error: 'Failed to query Action tasks',
          message: actionError.message,
          stack: process.env.NODE_ENV === 'development' ? actionError.stack : undefined
        });
      }
    }

    // Costruisci array di scope da cercare
    const scopeArray = [];
    if (scopes) {
      // Se scopes è una stringa, splitta per virgola
      const scopesList = typeof scopes === 'string' ? scopes.split(',') : scopes;
      scopeArray.push(...scopesList);
    } else {
      // Default: general
      scopeArray.push('general');
    }

    // Aggiungi scope client se projectId è fornito
    if (projectId) {
      scopeArray.push(`client:${projectId}`);
    }

    // Aggiungi scope industry se industry è fornito
    if (industry) {
      scopeArray.push(`industry:${industry}`);
    }

    // ✅ Query per Tasks
    // IMPORTANTE: Include anche template senza campo contexts (backward compatibility)
    let query = {};
    if (context) {
      // Se context è fornito, cerca template con scope corretto E (contexts match O contexts mancante)
      query = {
        scope: { $in: scopeArray },
        $or: [
          { contexts: { $in: [context] } },
          { contexts: { $exists: false } },  // Template senza contexts (migrati)
          { contexts: null }                 // Template con contexts null
        ]
      };
    } else {
      // Se context non è fornito, cerca solo per scope
      query = {
        scope: { $in: scopeArray }
      };
    }

    console.log(`[TaskTemplatesV2] Query:`, JSON.stringify(query, null, 2));

    // ✅ Carica da Tasks
    const templates = await db.collection('tasks')
      .find(query)
      .toArray();

    console.log(`[TaskTemplatesV2] Found ${templates.length} templates`);

    // No fallback - return empty array if no templates found

    // Converti template al formato compatibile con frontend
    const formatted = templates.map(tmpl => ({
      id: tmpl.id,
      label: tmpl.label,
      description: tmpl.description || '',
      scope: tmpl.scope,
      type: tmpl.type,
      templateId: tmpl.templateId || tmpl.type,
      defaultValue: tmpl.defaultValue || {},
      category: tmpl.category,
      isBuiltIn: tmpl.isBuiltIn || false,
      contexts: tmpl.contexts || ['NodeRow'],
      icon: tmpl.icon,
      color: tmpl.color
    }));

    res.json(formatted);

  } catch (error) {
    console.error('[TaskTemplatesV2] Error:', error);
    res.status(500).json({ error: 'Failed to fetch task templates', details: error.message });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

// Helper per mappare mode a built-in templateId (CASE-INSENSITIVE)
function mapModeToBuiltIn(mode) {
  if (!mode || typeof mode !== 'string') return 'SayMessage';
  const normalized = mode.toLowerCase().trim();
  const mapping = {
    'datarequest': 'GetData',
    'getdata': 'GetData',
    'data': 'GetData',
    'message': 'SayMessage',
    'saymessage': 'SayMessage',
    'say': 'SayMessage',
    'problemclassification': 'ClassifyProblem',
    'classifyproblem': 'ClassifyProblem',
    'problem': 'ClassifyProblem',
    'backendcall': 'callBackend',
    'callbackend': 'callBackend',
    'backend': 'callBackend'
  };
  return mapping[normalized] || 'SayMessage';
}

// ❌ RIMOSSO: DDT Library V2 endpoints (collection eliminata, non usata)
// I DDT sono ora gestiti direttamente nei Tasks con type: DataRequest

// ❌ RIMOSSO: Backend Calls endpoints (collection eliminata, migrata a Tasks type: 4)
// Usa /api/factory/tasks?taskType=Action invece

// Conditions - GET (legacy)
app.get('/api/factory/conditions', async (req, res) => {
  const client = await getMongoClient();
  try {
    const db = client.db(dbFactory);
    const coll = db.collection('Conditions');
    const docs = await coll.find({}).toArray();
    console.log(`>>> Found ${docs.length} Conditions`);
    res.json(docs);
  } catch (error) {
    console.error('Error fetching conditions:', error);
    res.status(500).json({ error: 'Failed to fetch conditions' });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

// Conditions - POST (with scope filtering)
app.post('/api/factory/conditions', async (req, res) => {
  const startTime = Date.now();
  const client = await getMongoClient();
  try {
    const db = client.db(dbFactory);
    const coll = db.collection('Conditions');

    const { industry, scope } = req.body;

    // Build query based on scope filtering
    const query = {};

    if (scope && Array.isArray(scope)) {
      const scopeConditions = [];

      if (scope.includes('global')) {
        scopeConditions.push({ scope: 'global' });
      }

      if (scope.includes('industry') && industry) {
        scopeConditions.push({
          scope: 'industry',
          industry: industry
        });
      }

      if (scopeConditions.length > 0) {
        query.$or = scopeConditions;
      }
    }

    console.log('>>> Conditions query:', JSON.stringify(query, null, 2));

    const queryStart = Date.now();
    const docs = await coll.find(query).toArray();
    const queryDuration = Date.now() - queryStart;
    const duration = Date.now() - startTime;
    console.log(`>>> Found ${docs.length} Conditions with scope filtering (query: ${queryDuration}ms, total: ${duration}ms)`);
    logInfo('Factory.Conditions.post', { industry, scope, count: docs.length, duration: `${duration}ms`, queryDuration: `${queryDuration}ms` });
    res.json(docs);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Error fetching conditions with scope filtering:', error);
    logError('Factory.Conditions.post', error, { duration: `${duration}ms` });
    res.status(500).json({ error: 'Failed to fetch conditions' });
  }
});

// Conditions - POST (create new)
app.post('/api/factory/conditions/create', async (req, res) => {
  const payload = req.body || {};
  const client = await getMongoClient();
  try {
    const db = client.db(dbFactory);
    const coll = db.collection('Conditions');

    if (!payload._id || !payload.name) {
      return res.status(400).json({ error: 'id_and_name_required' });
    }

    const now = new Date();
    const doc = {
      _id: payload._id,
      name: payload.name,
      label: payload.label || payload.name,
      description: payload.description || '',
      data: payload.data || {},
      updatedAt: now
    };

    await coll.updateOne(
      { _id: doc._id },
      { $set: doc, $setOnInsert: { createdAt: now } },
      { upsert: true }
    );

    const saved = await coll.findOne({ _id: doc._id });
    res.json(saved);
  } catch (error) {
    console.error('[Conditions][Create] Error:', error);
    res.status(500).json({ error: 'Failed to create condition' });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

// Conditions - PUT (update)
app.put('/api/factory/conditions/:id', async (req, res) => {
  const conditionId = req.params.id;
  const payload = req.body || {};
  const client = await getMongoClient();
  try {
    const db = client.db(dbFactory);
    const coll = db.collection('Conditions');

    const update = { $set: { updatedAt: new Date() } };
    if (payload.data) update.$set.data = payload.data;
    if (payload.name) update.$set.name = payload.name;
    if (payload.label) update.$set.label = payload.label;
    if (payload.description !== undefined) update.$set.description = payload.description;

    const result = await coll.updateOne({ _id: conditionId }, update);
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Condition not found' });
    }

    const updated = await coll.findOne({ _id: conditionId });
    res.json(updated);
  } catch (error) {
    console.error('[Conditions][Update] Error:', error);
    res.status(500).json({ error: 'Failed to update condition' });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

// ❌ RIMOSSO: Tasks - GET (legacy) - Duplicato, gestito dall'endpoint sopra con scope filtering

// Tasks - POST (with scope filtering)
app.post('/api/factory/tasks', async (req, res) => {
  const client = await getMongoClient();
  try {
    const db = client.db(dbFactory);
    const coll = db.collection('tasks');

    const { industry, scope } = req.body;

    // Build query based on scope filtering
    const query = {};

    if (scope && Array.isArray(scope)) {
      const scopeConditions = [];

      if (scope.includes('global')) {
        scopeConditions.push({ scope: 'global' });
      }

      if (scope.includes('industry') && industry) {
        scopeConditions.push({
          scope: 'industry',
          industry: industry
        });
      }

      if (scopeConditions.length > 0) {
        query.$or = scopeConditions;
      }
    }

    console.log('>>> Tasks query:', JSON.stringify(query, null, 2));

    const docs = await coll.find(query).toArray();
    console.log(`>>> Found ${docs.length} Tasks with scope filtering`);
    res.json(docs);
  } catch (error) {
    console.error('Error fetching tasks with scope filtering:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

// Constants - GET months for language
app.get('/api/constants/months/:language', async (req, res) => {
  const client = await getMongoClient();
  try {
    const db = client.db(dbFactory);
    const constantsCollection = db.collection('Constants');

    const { language } = req.params;
    const languageUpper = language.toUpperCase();

    logInfo('CONSTANTS_MONTHS', { language: languageUpper });

    const constant = await constantsCollection.findOne({
      type: 'months',
      locale: languageUpper,
      scope: 'global'
    });

    if (!constant) {
      logWarn('CONSTANTS_MONTHS', {
        language: languageUpper,
        message: 'Months constants not found'
      });
      return res.status(404).json({
        error: `Months constants for ${languageUpper} not found`
      });
    }

    // Restituisci i valori (array unificato dopo migrazione)
    res.json({
      _id: constant._id,
      locale: constant.locale,
      values: constant.values || [], // Array unificato
      mapping: constant.mapping || {}
    });
  } catch (error) {
    logError('CONSTANTS_MONTHS', error, { language: req.params.language });
    res.status(500).json({ error: error.message });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

// Macro Tasks - GET (legacy)
app.get('/api/factory/macro-tasks', async (req, res) => {
  const client = await getMongoClient();
  try {
    const db = client.db(dbFactory);
    const coll = db.collection('MacroTasks');
    const docs = await coll.find({}).toArray();
    console.log(`>>> Found ${docs.length} MacroTasks`);
    res.json(docs);
  } catch (error) {
    console.error('Error fetching macro tasks:', error);
    res.status(500).json({ error: 'Failed to fetch macro tasks' });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

// Macro Tasks - POST (with scope filtering)
app.post('/api/factory/macro-tasks', async (req, res) => {
  const client = await getMongoClient();
  try {
    const db = client.db(dbFactory);
    const coll = db.collection('MacroTasks');

    const { industry, scope } = req.body;

    // Build query based on scope filtering
    const query = {};

    if (scope && Array.isArray(scope)) {
      const scopeConditions = [];

      if (scope.includes('global')) {
        scopeConditions.push({ scope: 'global' });
      }

      if (scope.includes('industry') && industry) {
        scopeConditions.push({
          scope: 'industry',
          industry: industry
        });
      }

      if (scopeConditions.length > 0) {
        query.$or = scopeConditions;
      }
    }

    console.log('>>> MacroTasks query:', JSON.stringify(query, null, 2));

    const docs = await coll.find(query).toArray();
    console.log(`>>> Found ${docs.length} MacroTasks with scope filtering`);
    res.json(docs);
  } catch (error) {
    console.error('Error fetching macro tasks with scope filtering:', error);
    res.status(500).json({ error: 'Failed to fetch macro tasks' });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

// DEPRECATED: AgentActs endpoints removed - use /api/factory/tasks instead

app.get('/api/factory/actions', async (req, res) => {
  const client = await getMongoClient();
  try {
    const db = client.db(dbFactory);
    // ✅ Actions sono in Tasks con type enum 6-19 (SendSMS=6, SendEmail=7, EscalateToHuman=8, ecc.)
    const actions = await db.collection('tasks').find({  // ✅ Collection tasks (lowercase)
      type: { $gte: 6, $lte: 19 }  // ✅ Action types: enum 6-19
    }).toArray();
    // Convert to old format for backward compatibility
    const formattedActions = actions.map(action => ({
      id: action.id?.replace('-template', '') || action._id?.replace('-template', ''),
      label: action.label || '',
      description: action.description || '',
      icon: action.icon || 'Circle',
      color: action.color || 'text-gray-500',
      params: action.structure || action.params || {}
    }));
    res.json(formattedActions);
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

app.get('/api/factory/dialogue-templates', async (req, res) => {
  try {
    await withMongoClient(async (client) => {
      const db = client.db(dbFactory);

      // ✅ Carica TUTTI i task dalla collection tasks
      // Non filtrare per tipo - serve tutta la cache per risolvere i reference (subDataIds)
      const query = {}; // ✅ Query vuota = carica tutto

      // ✅ Collection tasks (lowercase)
      const ddt1 = await db.collection('tasks').find(query).toArray();  // ✅ Collection tasks (lowercase)

      // Converti in oggetto per accesso rapido
      const templateMap = new Map();
      ddt1.forEach(t => {
        const id = t.id || t._id?.toString();
        if (id && !templateMap.has(id)) {
          templateMap.set(id, t);
        }
      });

      const ddt = Array.from(templateMap.values());
      console.log('>>> LOAD /api/factory/dialogue-templates count =', ddt.length);
      res.json(ddt);
    });
  } catch (err) {
    console.error('[dialogue-templates] Error:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 🧠 EMBEDDING ENDPOINTS - Task Template Matching
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/embeddings/compute - Calcola embedding per un testo (delega a Python FastAPI)
app.post('/api/embeddings/compute', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Delega a Python FastAPI service
    const pythonServiceUrl = process.env.EMBEDDING_SERVICE_URL || 'http://localhost:8000';
    const targetUrl = `${pythonServiceUrl}/api/embeddings/compute`;

    console.log('[Embeddings][COMPUTE] Calling Python service', {
      url: targetUrl,
      textLength: text.trim().length,
      textPreview: text.trim().substring(0, 50)
    });

    let response;
    try {
      const requestBody = { text: text.trim() };
      console.log('[Embeddings][COMPUTE] Request body:', {
        textLength: requestBody.text.length,
        textPreview: requestBody.text.substring(0, 50)
      });

      response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(30000) // ✅ Aumentato a 30 secondi (il modello può impiegare tempo a caricarsi)
      });
    } catch (fetchError) {
      console.error('[Embeddings][COMPUTE] Fetch error (service not reachable):', {
        error: fetchError.message,
        errorName: fetchError.name,
        url: targetUrl,
        hint: 'Make sure Python FastAPI service (be:apiNew) is running on port 8000. Check if uvicorn is listening on port 8000.'
      });
      throw new Error(`Cannot reach Python embedding service at ${targetUrl}: ${fetchError.message}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Embeddings][COMPUTE] Python service error response', {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText.substring(0, 200),
        url: targetUrl
      });
      throw new Error(`Python embedding service error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('[Embeddings][COMPUTE] Success', {
      embeddingLength: data.embedding?.length || 0,
      model: data.model
    });
    res.json(data);
  } catch (error) {
    console.error('[Embeddings][COMPUTE] Error:', {
      error: error.message,
      stack: error.stack,
      url: pythonServiceUrl
    });
    res.status(500).json({
      error: error.message || 'Failed to compute embedding',
      details: 'Make sure Python FastAPI service is running on port 8000. Check logs for: [apiNew] or uvicorn'
    });
  }
});

// POST /api/embeddings - Salva/aggiorna embedding (generico, filtra per type nel body)
app.post('/api/embeddings', async (req, res) => {
  try {
    await withMongoClient(async (client) => {
      const db = client.db(dbFactory);
      const coll = db.collection('embeddings');

      const { id, type, text, embedding } = req.body;
      if (!id || !type || !text || !embedding || !Array.isArray(embedding)) {
        return res.status(400).json({ error: 'id, type, text, and embedding (array) are required' });
      }

      const now = new Date();
      const result = await coll.updateOne(
        { id: id, type: type },
        {
          $set: {
            id: id,
            type: type,
            text: text.trim(),
            embedding: embedding,
            model: 'paraphrase-multilingual-MiniLM-L12-v2',
            updatedAt: now
          },
          $setOnInsert: {
            createdAt: now
          }
        },
        { upsert: true }
      );

      console.log('[Embeddings] Saved embedding', {
        id,
        type,
        text: text.substring(0, 50),
        upserted: result.upsertedCount > 0,
        modified: result.modifiedCount > 0
      });

      res.json({ success: true, id, type, upserted: result.upsertedCount > 0 });
    });
  } catch (error) {
    console.error('[Embeddings] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/embeddings - Carica embedding filtrati per type (query parameter)
app.get('/api/embeddings', async (req, res) => {
  try {
    await withMongoClient(async (client) => {
      const db = client.db(dbFactory);
      const coll = db.collection('embeddings');

      const { type } = req.query;
      const filter = type ? { type: type } : {}; // Se type non specificato, carica tutto

      const embeddings = await coll.find(filter).toArray();

      // Rimuovi _id e ritorna solo i campi necessari
      const result = embeddings.map(item => ({
        id: item.id,
        type: item.type,
        text: item.text,
        embedding: item.embedding
      }));

      console.log('[Embeddings] Loaded', result.length, 'embeddings', type ? `(type: ${type})` : '(all types)');
      res.json(result);
    });
  } catch (error) {
    console.error('[Embeddings] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// IDE translations (static, read-only from client perspective)
app.get('/api/factory/ide-translations', async (req, res) => {
  const client = await getMongoClient();
  try {
    const db = client.db(dbFactory);
    const coll = db.collection('IDETranslations');
    const docs = await coll.find({}).toArray();
    const merged = {};
    for (const d of docs) {
      if (d && typeof d === 'object') {
        const source = d.data || d.translations || {};
        Object.assign(merged, source);
      }
    }
    res.json(merged);
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

// Template translations (from steps)
app.post('/api/factory/template-translations', async (req, res) => {
  const client = await getMongoClient();
  try {
    // Validate request body
    if (!req.body) {
      logError('TEMPLATE_TRANSLATIONS', new Error('No request body received'));
      return res.status(400).json({ error: 'Request body is required' });
    }

    const { keys } = req.body; // Array of translation keys (GUIDs or old-style keys)

    if (!Array.isArray(keys)) {
      logError('TEMPLATE_TRANSLATIONS', new Error('Invalid keys format'), { received: typeof keys });
      return res.status(400).json({ error: 'Keys must be an array', received: typeof keys });
    }

    if (keys.length === 0) {
      return res.json({});
    }
    const db = client.db(dbFactory);
    const coll = db.collection('Translations');

    // Check if keys are GUIDs (new format) or old-style keys
    const isGuid = (key) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
    const guidKeys = keys.filter(isGuid);
    const oldKeys = keys.filter(k => !isGuid(k));

    console.log('[TEMPLATE_TRANSLATIONS] Request:', {
      totalKeys: keys.length,
      guidKeys: guidKeys.length,
      oldKeys: oldKeys.length,
      sampleGuids: guidKeys.slice(0, 3),
      sampleOldKeys: oldKeys.slice(0, 3)
    });

    const merged = {};

    // Query for GUIDs (new format): guid field (type rimosso - GUID identifica già l'oggetto)
    if (guidKeys.length > 0) {
      const guidDocs = await coll.find({
        guid: { $in: guidKeys }
      }).toArray();

      console.log('[TEMPLATE_TRANSLATIONS] Found', guidDocs.length, 'translations for GUIDs');

      // Group by guid and language, then merge into { guid: { en, it, pt } }
      for (const doc of guidDocs) {
        if (doc.guid && doc.language && doc.text !== undefined) {
          if (!merged[doc.guid]) {
            merged[doc.guid] = { en: '', it: '', pt: '' };
          }
          if (doc.language === 'en' || doc.language === 'it' || doc.language === 'pt') {
            merged[doc.guid][doc.language] = doc.text || '';
          }
        }
      }
    }

    // Query for old-style keys (backward compatibility): _id field
    if (oldKeys.length > 0) {
      const oldDocs = await coll.find({ _id: { $in: oldKeys } }).toArray();
      console.log('[TEMPLATE_TRANSLATIONS] Found', oldDocs.length, 'translations for old keys');

      for (const doc of oldDocs) {
        if (doc && doc._id) {
          // Each doc has structure: { _id: 'template.phone.start.prompt1', en: '...', it: '...', pt: '...' }
          merged[doc._id] = {
            en: doc.en || '',
            it: doc.it || '',
            pt: doc.pt || ''
          };
        }
      }
    }

    console.log('[TEMPLATE_TRANSLATIONS] Loaded', Object.keys(merged).length, 'translations for', keys.length, 'keys');
    res.json(merged);
  } catch (err) {
    console.error('[TEMPLATE_TRANSLATIONS] Error:', {
      message: err.message,
      stack: err.stack,
      name: err.name,
      keysReceived: req.body?.keys,
      keysCount: req.body?.keys?.length,
      dbFactory: typeof dbFactory !== 'undefined' ? dbFactory : 'UNDEFINED'
    });
    res.status(500).json({
      error: err.message || 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      keysReceived: req.body?.keys,
      keysCount: req.body?.keys?.length
    });
  } finally {
    // ✅ NON chiudere la connessione se usi il pool
  }
});

// GET /api/factory/heuristics-synonyms - Get all heuristics synonyms for a language
app.get('/api/factory/heuristics-synonyms', async (req, res) => {
  const client = await getMongoClient();
  try {
    const { language } = req.query;
    if (!language) {
      return res.status(400).json({ error: 'language parameter is required' });
    }

    if (!['it', 'en', 'pt'].includes(language)) {
      return res.status(400).json({ error: 'language must be one of: it, en, pt' });
    }

    const db = client.db(dbFactory);
    const coll = db.collection('Translations');

    const query = {
      language: String(language),
      Use: 'Heuristics',
      Find: 'TaskTemplate'
    };

    const docs = await coll.find(query).toArray();

    const synonymsMap = {};
    docs.forEach(doc => {
      if (doc.guid && Array.isArray(doc.synonyms)) {
        synonymsMap[doc.guid] = doc.synonyms;
      }
    });

    console.log(`[HEURISTICS_SYNONYMS] Loaded ${Object.keys(synonymsMap).length} synonym sets for language ${language}`);
    res.json(synonymsMap);
  } catch (err) {
    console.error('[HEURISTICS_SYNONYMS] Error:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Load project translations by GUIDs
app.post('/api/projects/:pid/translations/load', async (req, res) => {
  const projectId = req.params.pid;
  const { guids } = req.body || {};

  if (!Array.isArray(guids) || guids.length === 0) {
    return res.json({});
  }

  const client = await getMongoClient();
  try {

    console.log(`[PROJECT_TRANSLATIONS] Request for project ${projectId}, ${guids.length} GUIDs`);
    console.log(`[PROJECT_TRANSLATIONS] Sample GUIDs:`, guids.slice(0, 5));

    // Try project database first
    const projDb = await getProjectDb(client, projectId);
    const projColl = projDb.collection('Translations');

    // Query: guid in guids (type rimosso - GUID identifica già l'oggetto)
    const projectQuery = {
      guid: { $in: guids }
    };
    console.log(`[PROJECT_TRANSLATIONS] Project query:`, JSON.stringify(projectQuery));

    const projectTranslations = await projColl.find(projectQuery).toArray();
    console.log(`[PROJECT_TRANSLATIONS] Found ${projectTranslations.length} translations in project DB`);
    if (projectTranslations.length > 0) {
      console.log(`[PROJECT_TRANSLATIONS] Sample project translation:`, {
        guid: projectTranslations[0].guid,
        language: projectTranslations[0].language,
        text: projectTranslations[0].text?.substring(0, 50),
        projectId: projectTranslations[0].projectId
      });
    }

    // Also check factory database as fallback
    const factoryDb = client.db(dbFactory);
    const factoryColl = factoryDb.collection('Translations');

    // Query: guid in guids AND (projectId = null OR projectId doesn't exist) (type rimosso)
    const factoryQuery = {
      guid: { $in: guids },
      $or: [
        { projectId: null },
        { projectId: { $exists: false } }
      ]
    };
    console.log(`[PROJECT_TRANSLATIONS] Factory query:`, JSON.stringify(factoryQuery));

    const factoryTranslations = await factoryColl.find(factoryQuery).toArray();
    console.log(`[PROJECT_TRANSLATIONS] Found ${factoryTranslations.length} translations in factory DB`);
    if (factoryTranslations.length > 0) {
      console.log(`[PROJECT_TRANSLATIONS] Sample factory translation:`, {
        guid: factoryTranslations[0].guid,
        language: factoryTranslations[0].language,
        text: factoryTranslations[0].text?.substring(0, 50),
        projectId: factoryTranslations[0].projectId
      });
    }

    // Debug: check if any translations exist for these GUIDs (without type filter)
    const allFactoryTranslations = await factoryColl.find({ guid: { $in: guids } }).limit(5).toArray();
    console.log(`[PROJECT_TRANSLATIONS] DEBUG: Found ${allFactoryTranslations.length} total translations in factory (any type) for sample GUIDs`);
    if (allFactoryTranslations.length > 0) {
      console.log(`[PROJECT_TRANSLATIONS] DEBUG: Sample translation structure:`, {
        guid: allFactoryTranslations[0].guid,
        type: allFactoryTranslations[0].type,
        language: allFactoryTranslations[0].language,
        hasText: !!allFactoryTranslations[0].text,
        keys: Object.keys(allFactoryTranslations[0])
      });
    }

    // Merge: project translations override factory ones
    // Structure: { guid: { en: '...', it: '...', pt: '...' } }
    const merged = {};

    // First add factory translations (group by guid and language)
    factoryTranslations.forEach((doc) => {
      if (doc.guid && doc.language && doc.text !== undefined) {
        if (!merged[doc.guid]) {
          merged[doc.guid] = { en: '', it: '', pt: '' };
        }
        if (doc.language === 'en' || doc.language === 'it' || doc.language === 'pt') {
          merged[doc.guid][doc.language] = doc.text || '';
        }
      }
    });

    // Then override with project translations
    projectTranslations.forEach((doc) => {
      if (doc.guid && doc.language && doc.text !== undefined) {
        if (!merged[doc.guid]) {
          merged[doc.guid] = { en: '', it: '', pt: '' };
        }
        if (doc.language === 'en' || doc.language === 'it' || doc.language === 'pt') {
          merged[doc.guid][doc.language] = doc.text || '';
        }
      }
    });

    console.log(`[PROJECT_TRANSLATIONS] Loaded ${Object.keys(merged).length} translations for ${guids.length} GUIDs (project docs: ${projectTranslations.length}, factory docs: ${factoryTranslations.length})`);
    res.json(merged);
  } catch (err) {
    console.error('[PROJECT_TRANSLATIONS] Error:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

// Load ALL project translations (for project opening)
app.get('/api/projects/:pid/translations/all', async (req, res) => {
  const projectId = req.params.pid;
  const { locale } = req.query || {};
  const projectLocale = locale || 'pt'; // Default to 'pt' if not specified
  const startTime = Date.now();

  const client = await getMongoClient();
  try {
    console.log(`[PROJECT_TRANSLATIONS_ALL] Loading all translations for project ${projectId}, locale: ${projectLocale}`);

    // Get both databases
    const projDb = await getProjectDb(client, projectId);
    const projColl = projDb.collection('Translations');
    const factoryDb = client.db(dbFactory);
    const factoryColl = factoryDb.collection('Translations');

    // ✅ APPROCCIO SEMPLIFICATO: Carica TUTTE le traduzioni dalla collection Translations del progetto
    // Non filtrare per GUID specifici - carica tutto quello che c'è nel progetto
    const projectQuery = {
      language: projectLocale
    };

    // Per il factory, carica solo le traduzioni dei template (senza projectId)
    const factoryQuery = {
      language: projectLocale,
      $or: [
        { projectId: null },
        { projectId: { $exists: false } }
      ]
    };

    // Execute queries in parallel for better performance
    const queryStart = Date.now();
    const [projectTranslations, factoryTranslations] = await Promise.all([
      projColl.find(projectQuery).toArray(),
      factoryColl.find(factoryQuery).toArray()
    ]);
    const queryDuration = Date.now() - queryStart;

    console.log(`[PROJECT_TRANSLATIONS_ALL] Found ${projectTranslations.length} translations in project DB, ${factoryTranslations.length} in factory DB (query: ${queryDuration}ms)`);

    // Build flat dictionary: { guid: text } - optimized merge
    const mergeStart = Date.now();
    const merged = {};

    // First add factory translations (template defaults) - using for loop for better performance
    for (const doc of factoryTranslations) {
      if (doc.guid && doc.text !== undefined) {
        merged[doc.guid] = doc.text || '';
      }
    }

    // Then override with project translations (instance-specific or project overrides)
    for (const doc of projectTranslations) {
      if (doc.guid && doc.text !== undefined) {
        merged[doc.guid] = doc.text || '';
      }
    }
    const mergeDuration = Date.now() - mergeStart;

    const duration = Date.now() - startTime;
    console.log(`[PROJECT_TRANSLATIONS_ALL] ✅ Loaded ${Object.keys(merged).length} translations (project: ${projectTranslations.length}, factory: ${factoryTranslations.length}, total: ${duration}ms, query: ${queryDuration}ms, merge: ${mergeDuration}ms)`);
    logInfo('Translations.getAll', { projectId, locale: projectLocale, count: Object.keys(merged).length, duration: `${duration}ms`, queryDuration: `${queryDuration}ms`, mergeDuration: `${mergeDuration}ms` });
    res.json(merged);
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error('[PROJECT_TRANSLATIONS_ALL] Error:', err);
    logError('Translations.getAll', err, { projectId, duration: `${duration}ms` });
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Save project translations (explicit save)
app.post('/api/projects/:pid/translations', async (req, res) => {
  const projectId = req.params.pid;
  const { translations } = req.body || {};

  if (!Array.isArray(translations) || translations.length === 0) {
    return res.json({ success: true, count: 0 });
  }

  const client = await getMongoClient();
  try {

    console.log(`[PROJECT_TRANSLATIONS_SAVE] Saving ${translations.length} translations for project ${projectId}`);

    // Get project database
    const projDb = await getProjectDb(client, projectId);
    const projColl = projDb.collection('Translations');

    const now = new Date();

    // Prepare bulk operations for all translations
    const bulkOps = translations
      .filter(trans => trans.guid && trans.language && trans.text !== undefined)
      .map(trans => {
        const filter = {
          guid: trans.guid,
          language: trans.language
        };

        const update = {
          $set: {
            guid: trans.guid,
            language: trans.language,
            text: trans.text,
            updatedAt: now
          },
          $setOnInsert: {
            createdAt: now
          }
        };

        return {
          updateOne: {
            filter,
            update,
            upsert: true
          }
        };
      });

    // Execute bulk write (much faster than sequential updates)
    let savedCount = 0;
    let result = null;
    if (bulkOps.length > 0) {
      result = await projColl.bulkWrite(bulkOps, { ordered: false });
      savedCount = result.upsertedCount + result.modifiedCount;
    }

    console.log(`[PROJECT_TRANSLATIONS_SAVE] ✅ Saved ${savedCount} translations for project ${projectId} (${result?.upsertedCount || 0} inserted, ${result?.modifiedCount || 0} updated)`);
    res.json({ success: true, count: savedCount });
  } catch (err) {
    console.error('[PROJECT_TRANSLATIONS_SAVE] Error:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

// --- DDT Wizard (mock) ---
// Minimal mock for detect-type to avoid relying on FastAPI during dev
// (removed) /api/ddt/step2 mock — using FastAPI /step2

app.post('/api/factory/dialogue-templates', async (req, res) => {
  try { console.log('>>> SAVE /api/factory/dialogue-templates size ~', Buffer.byteLength(JSON.stringify(req.body || {})), 'bytes'); } catch { }
  const client = await getMongoClient();
  try {
    const db = client.db(dbFactory);
    const coll = db.collection('tasks');
    const embeddingsColl = db.collection('embeddings'); // ✅ NUOVO: Collection per embeddings
    const now = new Date();

    // Handle single template or array of templates
    const templates = Array.isArray(req.body) ? req.body : [req.body];

    // ✅ NUOVO: Array per tracciare template che necessitano embedding
    const templatesNeedingEmbedding = [];

    for (const template of templates) {
      if (!template.id) {
        console.log('[POST /api/factory/dialogue-templates] ⚠️ Skipping template without id', {
          label: template.label,
        });
        continue; // Skip templates without id
      }

      // ✅ FIX: Rimuovi _id, name, createdAt dal template prima dell'update
      // name non è più necessario - templates sono identificati solo da id
      const { _id, name, createdAt, ...templateWithoutId } = template;

      console.log('[POST /api/factory/dialogue-templates] 💾 Saving template', {
        id: template.id,
        label: template.label,
        hasSubTasksIds: !!template.subTasksIds,
        subTasksIds: template.subTasksIds,
      });

      // ✅ FIX: Upsert by id (not by name)
      const result = await coll.updateOne(
        { id: template.id },
        {
          $set: {
            ...templateWithoutId,
            updatedAt: now
          },
          $setOnInsert: {
            createdAt: now
          }
        },
        { upsert: true }
      );

      console.log('[POST /api/factory/dialogue-templates] ✅ Template saved', {
        id: template.id,
        label: template.label,
        upserted: result.upsertedCount > 0,
        modified: result.modifiedCount > 0,
        matched: result.matchedCount > 0,
      });

      // ✅ NUOVO: Se è un template di tipo 3 (UtteranceInterpretation), aggiungi alla lista per embedding
      const templateType = template.type || template.Type;
      if (templateType === 3 && template.label) {
        templatesNeedingEmbedding.push({
          id: template.id,
          label: template.label,
          isNew: result.upsertedCount > 0, // Nuovo template
          wasModified: result.modifiedCount > 0 // Template esistente modificato
        });
      }
    }

    // ✅ NUOVO: Genera embedding per tutti i template che ne necessitano (in background, non blocca la risposta)
    if (templatesNeedingEmbedding.length > 0) {
      console.log('[POST /api/factory/dialogue-templates] 🧠 Generating embeddings', {
        count: templatesNeedingEmbedding.length,
        templates: templatesNeedingEmbedding.map(t => ({
          id: t.id,
          label: t.label.substring(0, 50),
          isNew: t.isNew
        }))
      });

      // Genera embedding in parallelo (non blocca la risposta HTTP)
      Promise.all(
        templatesNeedingEmbedding.map(async (template) => {
          try {
            // 1. Calcola embedding usando Python FastAPI
            const pythonServiceUrl = process.env.EMBEDDING_SERVICE_URL || 'http://localhost:8000';
            const computeResponse = await fetch(`${pythonServiceUrl}/api/embeddings/compute`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: template.label.trim() }),
              signal: AbortSignal.timeout(10000) // 10 second timeout
            });

            if (!computeResponse.ok) {
              const errorText = await computeResponse.text();
              throw new Error(`Failed to compute embedding: ${computeResponse.status} ${errorText}`);
            }

            const { embedding } = await computeResponse.json();

            if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
              throw new Error('Invalid embedding returned from service');
            }

            // 2. Salva embedding in MongoDB
            await embeddingsColl.updateOne(
              { id: template.id, type: 'task' },
              {
                $set: {
                  id: template.id,
                  type: 'task',
                  text: template.label.trim(),
                  embedding: embedding,
                  model: 'paraphrase-multilingual-MiniLM-L12-v2',
                  updatedAt: now
                },
                $setOnInsert: {
                  createdAt: now
                }
              },
              { upsert: true }
            );

            console.log('[POST /api/factory/dialogue-templates] ✅ Embedding generated', {
              templateId: template.id,
              label: template.label.substring(0, 50),
              isNew: template.isNew,
              embeddingDimensions: embedding.length
            });
          } catch (error) {
            console.error('[POST /api/factory/dialogue-templates] ❌ Failed to generate embedding', {
              templateId: template.id,
              label: template.label,
              error: error.message || String(error)
            });
            // Non blocca - embedding può essere generato dopo
          }
        })
      ).then(() => {
        console.log('[POST /api/factory/dialogue-templates] ✅ All embeddings generated', {
          total: templatesNeedingEmbedding.length
        });
      }).catch((error) => {
        console.error('[POST /api/factory/dialogue-templates] ⚠️ Some embeddings failed', {
          error: error.message || String(error)
        });
        // Non blocca - embedding può essere generato dopo
      });
    }

    res.json({ success: true, count: templates.length });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

// Save template label translations to Factory (IDE translations)
// These translations use type: LABEL and projectId: null
app.post('/api/factory/template-label-translations', async (req, res) => {
  const client = await getMongoClient();
  try {
    const db = client.db(dbFactory);
    const coll = db.collection('Translations');
    const { translations } = req.body || {};

    if (!Array.isArray(translations) || translations.length === 0) {
      return res.json({ success: true, count: 0 });
    }

    console.log(`[FACTORY_TRANSLATIONS_SAVE] Saving ${translations.length} template label translations`);

    const now = new Date();

    // Prepare bulk operations for all translations
    const bulkOps = translations
      .filter(trans => trans.guid && trans.language && trans.text !== undefined)
      .map(trans => {
        // ✅ CRITICAL: Filter must include guid, language, AND projectId: null
        // This ensures IDE translations (projectId: null) are separate from app translations (projectId !== null)
        const filter = {
          guid: trans.guid,
          language: trans.language,
          projectId: null, // ✅ IDE translations always have projectId: null
          type: 'Label', // ✅ IDE translations always use type: LABEL
        };

        const update = {
          $set: {
            guid: trans.guid,
            language: trans.language,
            text: trans.text,
            type: trans.type || 'Label', // ✅ Default to LABEL if not specified
            projectId: null, // ✅ CRITICAL: IDE translations always have projectId: null
            updatedAt: now
          },
          $setOnInsert: {
            createdAt: now
          }
        };

        return {
          updateOne: {
            filter,
            update,
            upsert: true
          }
        };
      });

    // Execute bulk write (much faster than sequential updates)
    let savedCount = 0;
    let result = null;
    if (bulkOps.length > 0) {
      result = await coll.bulkWrite(bulkOps, { ordered: false });
      savedCount = result.upsertedCount + result.modifiedCount;
    }

    console.log(`[FACTORY_TRANSLATIONS_SAVE] ✅ Saved ${savedCount} template label translations (${result?.upsertedCount || 0} inserted, ${result?.modifiedCount || 0} updated)`);
    res.json({ success: true, count: savedCount });
  } catch (err) {
    console.error('[FACTORY_TRANSLATIONS_SAVE] Error:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Check which template IDs are missing translations for a given language
app.get('/api/factory/check-missing-translations', async (req, res) => {
  const client = await getMongoClient();
  try {
    const { language } = req.query;

    if (!language || !['it', 'en', 'pt'].includes(language)) {
      return res.status(400).json({ error: 'Invalid language parameter. Must be it, en, or pt' });
    }

    const db = client.db(dbFactory);
    const tasksColl = db.collection('tasks');
    const translationsColl = db.collection('Translations');

    // Get all template IDs from tasks collection
    const allTemplates = await tasksColl.find({}, { projection: { id: 1, label: 1 } }).toArray();
    const allTemplateIds = allTemplates.map(t => t.id || t._id?.toString()).filter(Boolean);

    if (allTemplateIds.length === 0) {
      return res.json({ missing: [] });
    }

    // Get existing translations for the target language (type: LABEL, projectId: null)
    const existingTranslations = await translationsColl.find({
      guid: { $in: allTemplateIds },
      language: language,
      type: 'Label',
      projectId: null,
    }, { projection: { guid: 1 } }).toArray();

    const existingGuids = new Set(existingTranslations.map(t => t.guid));

    // Find missing translations
    // For each missing template, try to find its label in the source language (default: it)
    const sourceLanguage = 'it'; // Default source language
    const sourceTranslations = await translationsColl.find({
      guid: { $in: allTemplateIds },
      language: sourceLanguage,
      type: 'Label',
      projectId: null,
    }, { projection: { guid: 1, text: 1 } }).toArray();

    const sourceMap = new Map(sourceTranslations.map(t => [t.guid, t.text]));

    const missing = allTemplateIds
      .filter(id => !existingGuids.has(id))
      .map(id => {
        const template = allTemplates.find(t => (t.id || t._id?.toString()) === id);
        return {
          guid: id,
          label: sourceMap.get(id) || template?.label || 'Unknown',
          sourceLanguage: sourceLanguage,
          targetLanguage: language,
        };
      });

    console.log(`[CHECK_MISSING_TRANSLATIONS] Found ${missing.length} missing translations for language ${language}`);
    res.json({ missing });
  } catch (err) {
    console.error('[CHECK_MISSING_TRANSLATIONS] Error:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Generate template translations via AI
app.post('/api/factory/generate-template-translations', async (req, res) => {
  const client = await getMongoClient();
  try {
    const { templateIds, targetLanguage, sourceLanguage = 'it' } = req.body;

    if (!Array.isArray(templateIds) || templateIds.length === 0) {
      return res.json({ success: true, generated: 0 });
    }

    if (!targetLanguage || !['it', 'en', 'pt'].includes(targetLanguage)) {
      return res.status(400).json({ error: 'Invalid targetLanguage. Must be it, en, or pt' });
    }

    if (!sourceLanguage || !['it', 'en', 'pt'].includes(sourceLanguage)) {
      return res.status(400).json({ error: 'Invalid sourceLanguage. Must be it, en, or pt' });
    }

    const db = client.db(dbFactory);
    const translationsColl = db.collection('Translations');

    // Load source translations
    const sourceTranslations = await translationsColl.find({
      guid: { $in: templateIds },
      language: sourceLanguage,
      type: 'Label',
      projectId: null,
    }, { projection: { guid: 1, text: 1 } }).toArray();

    if (sourceTranslations.length === 0) {
      return res.json({ success: false, generated: 0, error: 'No source translations found' });
    }

    // Generate translations via AI
    const generatedTranslations = [];
    const errors = [];

    // Import AIProviderService
    const AIProviderService = require('./services/AIProviderService');
    const aiService = new AIProviderService();
    await aiService.initializeProviders();

    for (const sourceTrans of sourceTranslations) {
      try {
        // Build translation prompt
        const languageNames = {
          it: 'Italian',
          en: 'English',
          pt: 'Portuguese',
        };

        const prompt = `Translate the following ${languageNames[sourceLanguage]} text to ${languageNames[targetLanguage]}. Return ONLY the translation, no explanations, no quotes, no markdown.

Text to translate: "${sourceTrans.text}"

Translation:`;

        // Call AI (use OpenAI by default, fallback to Groq)
        const aiResponse = await aiService.callAI('openai', [
          { role: 'system', content: 'You are a professional translator. Return only the translated text, nothing else.' },
          { role: 'user', content: prompt },
        ], { model: 'gpt-4o-mini' });

        const translatedText = (aiResponse || '').trim().replace(/^["']|["']$/g, ''); // Remove quotes if present

        if (!translatedText) {
          errors.push(`No translation returned for ${sourceTrans.guid}`);
          continue;
        }

        generatedTranslations.push({
          guid: sourceTrans.guid,
          language: targetLanguage,
          text: translatedText,
          type: 'Label',
          projectId: null,
        });
      } catch (error) {
        console.error(`[GENERATE_TEMPLATE_TRANSLATIONS] Error translating ${sourceTrans.guid}:`, error);
        errors.push(`Error translating ${sourceTrans.guid}: ${error.message || String(error)}`);
      }
    }

    // Save generated translations
    if (generatedTranslations.length > 0) {
      const now = new Date();
      const bulkOps = generatedTranslations.map(trans => ({
        updateOne: {
          filter: {
            guid: trans.guid,
            language: trans.language,
            projectId: null,
            type: 'Label',
          },
          update: {
            $set: {
              ...trans,
              updatedAt: now,
            },
            $setOnInsert: {
              createdAt: now,
            },
          },
          upsert: true,
        },
      }));

      await translationsColl.bulkWrite(bulkOps, { ordered: false });
    }

    console.log(`[GENERATE_TEMPLATE_TRANSLATIONS] Generated ${generatedTranslations.length} translations (${errors.length} errors)`);
    res.json({
      success: generatedTranslations.length > 0,
      generated: generatedTranslations.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('[GENERATE_TEMPLATE_TRANSLATIONS] Error:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

app.delete('/api/factory/dialogue-templates/:id', async (req, res) => {
  const id = req.params.id;
  const client = await getMongoClient();
  try {
    const db = client.db(dbFactory);
    const coll = db.collection('tasks');
    // ✅ FIX: Delete by id only (name field removed)
    let filter;
    if (/^[a-fA-F0-9]{24}$/.test(id)) {
      filter = { _id: new ObjectId(id) };
    } else {
      // Try by id field first, then by _id
      filter = { $or: [{ id: id }, { _id: id }] };
    }
    const result = await coll.deleteOne(filter);
    if (result.deletedCount === 1) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Template non trovato' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

app.get('/api/factory/industries', async (req, res) => {
  const client = await getMongoClient();
  try {
    const db = client.db(dbFactory);
    const industries = await db.collection('Industries').find({}).toArray();
    res.json(industries);
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

// GET: Lista industry uniche dai progetti (come per i clienti)
app.get('/api/projects/catalog/industries', async (req, res) => {
  const startTime = Date.now();
  const client = await getMongoClient(); // ✅ Usa pool invece di nuova connessione
  try {
    const db = client.db(dbProjects);
    const coll = db.collection('projects_catalog');

    // ✅ Optimized aggregation pipeline
    const industries = await coll.aggregate([
      { $match: { industry: { $exists: true, $ne: null, $type: 'string' } } },
      { $group: { _id: '$industry' } },
      { $match: { _id: { $ne: '', $regex: /^\s*\S/ } } }, // at least one non-whitespace char
      { $sort: { _id: 1 } },
      { $project: { _id: 0, industry: '$_id' } },
    ]).toArray();

    // Trim lato JavaScript (più compatibile con versioni MongoDB)
    const uniqueIndustries = industries
      .map(i => (i.industry || '').trim())
      .filter(Boolean)
      .sort();

    const duration = Date.now() - startTime;
    logInfo('Catalog.industries', { count: uniqueIndustries.length, duration: `${duration}ms` });
    res.json(uniqueIndustries);
  } catch (e) {
    const duration = Date.now() - startTime;
    logError('Catalog.industries', e, { duration: `${duration}ms` });
    res.status(500).json({ error: String(e?.message || e) });
  }
  // ✅ NON chiudere la connessione se usi il pool
});

// POST: Crea nuova industry nel factory
app.post('/api/factory/industries', async (req, res) => {
  const payload = req.body || {};
  const industryName = payload.name || payload.industryName || null;
  if (!industryName || typeof industryName !== 'string' || !industryName.trim()) {
    return res.status(400).json({ error: 'industry_name_required' });
  }
  const client = await getMongoClient();
  try {
    const db = client.db(dbFactory);
    const coll = db.collection('Industries');
    // Verifica se esiste già
    const existing = await coll.findOne({
      $or: [
        { industryId: industryName.trim() },
        { name: industryName.trim() }
      ]
    });
    if (existing) {
      return res.status(409).json({ error: 'industry_already_exists', industry: existing });
    }
    // Crea nuova industry
    const now = new Date();
    const newIndustry = {
      industryId: industryName.trim(),
      name: industryName.trim(),
      description: payload.description || '',
      createdAt: now,
      updatedAt: now
    };
    await coll.insertOne(newIndustry);
    res.json(newIndustry);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

// -----------------------------
// Type Templates Endpoints
// -----------------------------
// -----------------------------
// Endpoint: Task Heuristics (per euristica classificazione)
// -----------------------------
app.get('/api/factory/task-heuristics', async (req, res) => {
  try {
    // ✅ Invalida cache per forzare ricaricamento
    taskHeuristicsCacheLoaded = false;
    taskHeuristicsCache = null;

    const patterns = await loadTaskHeuristicsFromDB();

    logInfo('TaskHeuristics.get', {
      patternsCount: Object.keys(patterns).reduce((sum, lang) => sum + Object.keys(patterns[lang] || {}).length, 0),
      languages: Object.keys(patterns)
    });

    res.json(patterns);
  } catch (e) {
    logError('TaskHeuristics.get', e);
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// POST /api/factory/task-heuristics - Save heuristics
// Ora salva i pattern in Heuristics (rinominata da Task_Types)
app.post('/api/factory/task-heuristics', async (req, res) => {
  const client = await getMongoClient();
  try {
    const db = client.db(dbFactory);
    // Pattern sono ora in Heuristics (rinominata da Task_Types)
    const coll = db.collection('Heuristics');

    const payload = req.body || {};
    const { type, patterns, language } = payload;

    if (!type || !Array.isArray(patterns) || !language) {
      return res.status(400).json({ error: 'type, patterns (array), and language are required' });
    }

    // Mapping da HeuristicType a Heuristics._id
    const typeMapping = {
      'AI_AGENT': 'AIAgent',
      'MESSAGE': 'Message',
      'REQUEST_DATA': 'DataRequest',
      'PROBLEM_SPEC_DIRECT': 'ProblemClassification',
      'PROBLEM_REASON': 'ProblemClassification',
      'PROBLEM': 'ProblemClassification',
      'SUMMARY': 'Summary',
      'BACKEND_CALL': 'BackendCall',
      'NEGOTIATION': 'Negotiation'
    };

    const taskTypeId = typeMapping[type];
    if (!taskTypeId) {
      return res.status(400).json({ error: `Unknown heuristic type: ${type}` });
    }

    const langUpper = language.toUpperCase();
    const now = new Date();

    // Carica il Heuristics esistente per preservare i pattern di altre lingue
    const existing = await coll.findOne({ _id: taskTypeId });
    const existingPatterns = existing?.patterns || {};

    // Aggiorna solo la lingua specificata
    const updatedPatterns = {
      ...existingPatterns,
      [langUpper]: patterns
    };

    // Aggiorna Heuristics (crea se non esiste)
    const result = await coll.updateOne(
      { _id: taskTypeId },
      {
        $set: {
          patterns: updatedPatterns,
          updatedAt: now
        },
        $setOnInsert: {
          createdAt: now
        }
      },
      { upsert: true } // ✅ Crea se non esiste
    );

    // Invalidate cache
    taskHeuristicsCacheLoaded = false;
    taskHeuristicsCache = null;

    const saved = await coll.findOne({ _id: taskTypeId });
    logInfo('TaskHeuristics.post', { type, taskTypeId, language: langUpper, patternsCount: patterns.length });
    res.json(saved);
  } catch (e) {
    logError('TaskHeuristics.post', e);
    res.status(500).json({ error: String(e?.message || e) });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

// -----------------------------
// Factory: Tasks Endpoints
// -----------------------------
// GET /api/factory/tasks - List all tasks
app.get('/api/factory/tasks', async (req, res) => {
  try {
    await withMongoClient(async (client) => {
      const db = client.db(dbFactory);

      const coll = db.collection('tasks');

      const { industry, scope, taskType } = req.query;

    // Build query based on scope filtering and taskType (CASE-INSENSITIVE)
    const query = {};
    const conditions = [];

    // Scope filtering
    if (scope && industry) {
      conditions.push({
        $or: [
          { scope: { $regex: new RegExp(`^global$`, 'i') } },
          { scope: { $regex: new RegExp(`^industry$`, 'i') }, industry: { $regex: new RegExp(`^${industry}$`, 'i') } }
        ]
      });
    }

    // ✅ Filter by taskType if provided (e.g., 'Action' for actions palette)
    // Se taskType='Action', usa allowedContexts che include 'escalation' invece di enumerare i tipi
    if (taskType) {
      const taskTypeLower = taskType.toLowerCase();
      if (taskTypeLower === 'action') {
        // ✅ IMPORTANTE: allowedContexts deve includere 'escalation'
        conditions.push({
          allowedContexts: { $in: ['escalation'] }  // ✅ Solo task che possono essere in escalation
        });
      } else {
        // Per altri tipi, cerca per type enum o name
        const taskTypeRegex = new RegExp(`^${taskType}$`, 'i');
        conditions.push({
          $or: [
            { type: taskTypeRegex },
            { name: taskTypeRegex }
          ]
        });
      }
    }

    // Combina tutte le condizioni con $and (o usa direttamente la condizione se è una sola)
    if (conditions.length > 0) {
      if (conditions.length === 1) {
        // Se c'è solo una condizione, usala direttamente (più efficiente)
        Object.assign(query, conditions[0]);
      } else {
        // Se ci sono più condizioni, combinale con $and
        query.$and = conditions;
      }
    }

    const templates = await coll.find(query).toArray();

    // ✅ DEBUG: Log per verificare il filtro
    if (taskType && taskType.toLowerCase() === 'action') {
      console.log('[Tasks.get] Action query:', JSON.stringify(query, null, 2));
      console.log('[Tasks.get] Found tasks:', templates.length);
      templates.forEach((t, idx) => {
        console.log(`  ${idx + 1}. ID: ${t.id || t._id}, Label: ${t.label || 'N/A'}, Type: ${t.type}, allowedContexts: ${JSON.stringify(t.allowedContexts)}`);
      });
    }
      logInfo('Tasks.get', { count: templates.length, industry, scope, taskType });
      res.json(templates);
    });
  } catch (e) {
    logError('TaskTemplates.get', e);
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// POST /api/factory/tasks - Create task
app.post('/api/factory/tasks', async (req, res) => {
  const client = await getMongoClient();
  try {
    const db = client.db(dbFactory);
    const coll = db.collection('tasks');

    const payload = req.body || {};
    if (!payload.id || !payload.label || !payload.valueSchema) {
      return res.status(400).json({ error: 'id, label, and valueSchema are required' });
    }

    const now = new Date();
    const taskType = payload.type !== undefined ? payload.type : 3;  // ✅ Default DataRequest se non specificato

    // ✅ Determina allowedContexts in base al type (se non è già specificato nel payload)
    const allowedContextsValue = payload.allowedContexts !== undefined
      ? payload.allowedContexts
      : getAllowedContexts(taskType);

    const doc = {
      _id: payload.id,
      id: payload.id,
      type: taskType,
      templateId: payload.templateId || null,  // ✅ templateId: null (standalone) o GUID (reference)
      allowedContexts: allowedContextsValue,  // ✅ Imposta automaticamente in base al type
      label: payload.label,
      description: payload.description || '',
      icon: payload.icon || 'Circle',
      color: payload.color || 'text-gray-500',
      signature: payload.signature || undefined,
      valueSchema: payload.valueSchema,
      scope: payload.scope || 'global',
      industry: payload.industry || undefined,
      createdAt: now,
      updatedAt: now
    };

    await coll.updateOne(
      { _id: doc._id },
      { $set: doc, $setOnInsert: { createdAt: now } },
      { upsert: true }
    );

    const saved = await coll.findOne({ _id: doc._id });
    logInfo('TaskTemplates.post', { id: doc._id, label: doc.label });
    res.json(saved);
  } catch (e) {
    logError('TaskTemplates.post', e);
    res.status(500).json({ error: String(e?.message || e) });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

// PUT /api/factory/tasks/:id - Update task
app.put('/api/factory/tasks/:id', async (req, res) => {
  const id = req.params.id;
  const client = await getMongoClient();
  try {
    const db = client.db(dbFactory);
    const coll = db.collection('tasks');

    const payload = req.body || {};
    const now = new Date();

    const updateDoc = {
      ...payload,
      updatedAt: now
    };
    delete updateDoc._id; // Don't update _id
    delete updateDoc.createdAt; // Don't update createdAt

    // ✅ Cerca per _id prima (converti stringa in ObjectId se necessario)
    let saved = null;
    let actualId = null;

    // ✅ Prova a convertire id in ObjectId
    try {
      const objectId = typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)
        ? new ObjectId(id)
        : id;
      saved = await coll.findOne({ _id: objectId });
      if (saved) {
        actualId = saved._id;
      }
    } catch (e) {
      // ✅ Se la conversione fallisce, cerca per id field
      logWarn('TaskTemplates.put', { id, error: 'Invalid ObjectId format, trying id field' });
    }

    // ✅ Fallback: cerca per id field se _id non trova nulla
    if (!saved) {
      saved = await coll.findOne({ id: id });
      if (saved) {
        actualId = saved._id;
      }
    }

    if (!saved || !actualId) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // ✅ Aggiorna usando actualId (ObjectId corretto)
    await coll.updateOne(
      { _id: actualId },
      { $set: updateDoc },
      { upsert: false }
    );
    saved = await coll.findOne({ _id: actualId });

    if (!saved) {
      return res.status(404).json({ error: 'Template not found' });
    }

    logInfo('TaskTemplates.put', { id });
    res.json(saved);
  } catch (e) {
    logError('TaskTemplates.put', e);
    res.status(500).json({ error: String(e?.message || e) });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

// DELETE /api/factory/tasks/:id - Delete task
app.delete('/api/factory/tasks/:id', async (req, res) => {
  const id = req.params.id;
  const client = await getMongoClient();
  try {
    const db = client.db(dbFactory);
    const coll = db.collection('tasks');

    const result = await coll.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    logInfo('TaskTemplates.delete', { id });
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (e) {
    logError('TaskTemplates.delete', e);
    res.status(500).json({ error: String(e?.message || e) });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

app.get('/api/factory/type-templates', async (req, res) => {
  try {
    const templates = await loadTemplatesFromDB();
    res.json(templates);
  } catch (error) {
    logError('GET /api/factory/type-templates', error);
    res.status(500).json({ error: 'Failed to load templates' });
  }
});

// POST /api/factory/type-templates - Save type template in Factory
app.post('/api/factory/type-templates', async (req, res) => {
  const client = await getMongoClient();
  try {
    const db = client.db(dbFactory);
    const coll = db.collection('Heuristics');

    const payload = req.body || {};
    if (!payload.name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const now = new Date();
    const doc = {
      name: payload.name,
      label: payload.label || payload.name,
      type: payload.type || 'atomic',
      icon: payload.icon || 'FileText',
      subTasks: payload.subTasks || [],
      mainData: payload.mainData || [],
      synonyms: payload.synonyms || [],
      constraints: payload.constraints || [],
      validation: payload.validation || {},
      metadata: payload.metadata || {},
      updatedAt: now
    };

    // Upsert by name
    await coll.updateOne(
      { name: doc.name },
      { $set: doc, $setOnInsert: { createdAt: now } },
      { upsert: true }
    );

    // Invalidate cache - reload templates on next request
    cacheLoaded = false;

    const saved = await coll.findOne({ name: doc.name });
    if (saved && saved._id) {
      delete saved._id;
    }
    logInfo('TypeTemplates.post', { name: doc.name, type: doc.type });
    res.json(saved);
  } catch (e) {
    logError('TypeTemplates.post', e);
    res.status(500).json({ error: String(e?.message || e) });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

// POST /api/projects/:pid/type-templates - Save type template in Project
app.post('/api/projects/:pid/type-templates', async (req, res) => {
  const projectId = req.params.pid;
  const client = await getMongoClient();
  try {
    const projDb = await getProjectDb(client, projectId);
    const coll = projDb.collection('Heuristics');

    const payload = req.body || {};
    if (!payload.name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const now = new Date();
    const doc = {
      name: payload.name,
      label: payload.label || payload.name,
      type: payload.type || 'atomic',
      icon: payload.icon || 'FileText',
      subTasks: payload.subTasks || [],
      mainData: payload.mainData || [],
      synonyms: payload.synonyms || [],
      constraints: payload.constraints || [],
      validation: payload.validation || {},
      metadata: payload.metadata || {},
      updatedAt: now
    };

    // Upsert by name
    await coll.updateOne(
      { name: doc.name },
      { $set: doc, $setOnInsert: { createdAt: now } },
      { upsert: true }
    );

    // Invalidate cache - reload templates on next request
    cacheLoaded = false;

    const saved = await coll.findOne({ name: doc.name });
    if (saved && saved._id) {
      delete saved._id;
    }
    logInfo('TypeTemplates.post', { projectId, name: doc.name, type: doc.type });
    res.json(saved);
  } catch (e) {
    logError('TypeTemplates.post', e, { projectId, name: payload?.name });
    res.status(500).json({ error: String(e?.message || e) });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

app.post('/api/factory/reload-templates', async (req, res) => {
  try {
    cacheLoaded = false;
    await loadTemplatesFromDB();
    res.json({ message: 'Templates reloaded from database' });
  } catch (error) {
    logError('POST /api/factory/reload-templates', error);
    res.status(500).json({ error: 'Failed to reload templates' });
  }
});

// -----------------------------
// Step2 Detect Type Endpoint
// -----------------------------
// DISABLED: Middleware for old /step2 endpoint
// app.use('/step2', (req, res, next) => {
//   if (req.headers['content-type'] === 'text/plain') {
//     let data = '';
//     req.setEncoding('utf8');
//     req.on('data', chunk => {
//       data += chunk;
//     });
//     req.on('end', () => {
//       req.body = data;
//       next();
//     });
//   } else {
//     next();
//   }
// });

// DISABLED: Old /step2 endpoint - use /step2-with-provider instead
app.post('/step2', async (req, res) => {
  res.status(410).json({
    error: 'Endpoint deprecated. Use /step2-with-provider instead.',
    message: 'This endpoint has been replaced with /step2-with-provider for better AI provider support.'
  });
});

// --- INDUSTRY ENDPOINTS ---

app.get('/api/industry/:industryId/templates', async (req, res) => {
  const industryId = req.params.industryId;
  const client = await getMongoClient();
  try {
    const db = client.db(dbFactory);
    const templates = await db.collection('DataDialogueTemplates').find({ industry: industryId }).toArray();
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

// --- PROJECTS ENDPOINTS (API) ---

app.get('/api/projects', async (req, res) => {
  console.log('>>> CHIAMATA /api/projects');
  const client = await getMongoClient();
  try {
    const db = client.db(dbProjects);
    const projects = await db.collection('projects').find({}).sort({ _id: -1 }).toArray();
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

app.post('/api/projects', async (req, res) => {
  const client = await getMongoClient();
  try {
    const db = client.db(dbProjects);
    const result = await db.collection('projects').insertOne(req.body);
    const saved = await db.collection('projects').findOne({ _id: result.insertedId });
    res.json({ id: result.insertedId, ...saved });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

app.get('/api/projects/:id', async (req, res) => {
  const projectId = req.params.id;
  const client = await getMongoClient();
  try {
    // ✅ Cerca prima nel catalogo (supporta projectId custom come "proj_xxx")
    const catalogDb = client.db(dbProjects);
    const catalog = catalogDb.collection('projects_catalog');

    // Prova a cercare per _id o projectId
    let project = await catalog.findOne({ _id: projectId });
    if (!project) {
      project = await catalog.findOne({ projectId: projectId });
    }

    // Se non trovato nel catalogo, prova nella collection projects (per ObjectId MongoDB)
    if (!project) {
      try {
        const db = client.db(dbProjects);
        project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
      } catch (objectIdError) {
        // Se non è un ObjectId valido, ignora l'errore
      }
    }

    if (!project) {
      return res.status(404).json({ error: `Progetto non trovato: ${projectId}` });
    }

    res.json(project);
  } catch (err) {
    console.error(`[GET /api/projects/:id] Error:`, err);
    res.status(500).json({ error: err.message, stack: err.stack });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

// --- PROJECTS ENDPOINTS (ALIAS) ---

app.get('/projects', async (req, res) => {
  const client = await getMongoClient();
  try {
    const db = client.db(dbProjects);
    const projects = await db.collection('projects').find({}).sort({ _id: -1 }).toArray();
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

app.post('/projects', async (req, res) => {
  const client = await getMongoClient();
  try {
    const db = client.db(dbProjects);
    const result = await db.collection('projects').insertOne(req.body);
    const saved = await db.collection('projects').findOne({ _id: result.insertedId });
    res.json({ id: result.insertedId, ...saved });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

app.get('/projects/all', async (req, res) => {
  console.log('>>> CHIAMATA /projects/all');
  const client = await getMongoClient();
  try {
    const db = client.db(dbProjects);
    const projects = await db.collection('projects').find({}).sort({ _id: -1 }).toArray();
    res.json(projects);
  } catch (err) {
    console.error('Errore in /projects/all:', err); // <--- AGGIUNGI QUESTO
    res.status(500).json({ error: err.message, stack: err.stack });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

// Funzione di validazione ObjectId
function isValidObjectId(id) {
  return typeof id === 'string' && id.match(/^[a-fA-F0-9]{24}$/);
}

// Route /projects/:id con validazione
app.get('/projects/:id', async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'ID non valido' });
  }
  const client = await getMongoClient();
  try {
    const db = client.db(dbProjects);
    const project = await db.collection('projects').findOne({ _id: new ObjectId(req.params.id) });
    if (!project) return res.status(404).json({ error: 'Progetto non trovato' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

// ✅ ENTERPRISE: Analizza la richiesta utente usando SOLO AI reale
// Now uses the new modular TemplateIntelligenceOrchestrator
async function analyzeUserRequestWithAI(userDesc, templates, provider = 'groq', model = null) {
  console.log(`[AI_ANALYSIS] Starting AI analysis for: "${userDesc}"`);
  console.log(`[AI_ANALYSIS] Using ${provider} provider`);
  console.log(`[AI_ANALYSIS] Using model: ${model || 'default'}`);
  console.log(`[AI_ANALYSIS] Available templates:`, Object.keys(templates).length);

  try {
    // Use new modular orchestrator (with embedding-based retrieval)
    const result = await templateIntelligenceOrchestrator.analyzeUserRequest(
      userDesc,
      templates,
      provider,
      model
    );

    console.log(`[AI_ANALYSIS] ✅ AI analysis successful:`, result.action);
    console.log(`[AI_ANALYSIS] 📋 AI Response structure:`, {
      action: result.action,
      label: result.label,
      type: result.type,
      icon: result.icon,
      mainsCount: result.mains?.length || 0,
      hasValidation: result.mains?.some(m => m.validation) || false,
      hasExamples: result.mains?.some(m => m.example) || false
    });

    // Log detailed validation info
    if (result.mains && result.mains.length > 0) {
      console.log(`[AI_ANALYSIS] 🔍 Detailed mains analysis:`);
      result.mains.forEach((main, index) => {
        console.log(`[AI_ANALYSIS]   Main ${index + 1}:`, {
          label: main.label,
          type: main.type,
          icon: main.icon,
          hasValidation: !!main.validation,
          hasExamples: !!main.example,
          subTasksCount: main.subTasks?.length || 0,
          validationDescription: main.validation?.description || 'NO DESCRIPTION',
          exampleValue: main.example || 'NO EXAMPLE'
        });
      });
    }

    return result;
  } catch (error) {
    console.error(`[AI_ANALYSIS] ❌ AI analysis failed:`, error.message);
    throw error; // Error already enhanced by orchestrator
  }
}

// ✅ ENTERPRISE: Solo AI generativa - nessun fallback locale

// Compone template esistenti in una struttura unificata
async function composeTemplates(templateNames, templates, userDesc) {
  const composedMains = [];

  for (const templateName of templateNames) {
    const template = templates[templateName];
    if (template) {
      // Risolvi subTasks con supporto 3 livelli
      const resolvedSubTasks = await resolveTemplateRefsWithLevels(template.subTasks || [], templates);

      // Aggiungi validazione e esempi migliorati
      const enhancedSubData = resolvedSubData.map(item => ({
        ...item,
        validation: {
          ...item.validation,
          description: generateValidationDescription(item.type, item.validation),
        }
      }));

      composedMains.push({
        label: template.label,
        type: template.type,
        icon: template.icon,
        subTasks: enhancedSubTasks,
        validation: {
          description: `This field contains ${template.label.toLowerCase()} information`,
        },
        example: generateExampleValue(template.type)
      });
    }
  }

  return {
    ai: {
      action: 'compose',
      composed_from: templateNames,
      auditing_state: 'AI_generated',
      reason: `Composed from existing templates: ${templateNames.join(', ')}`,
      label: userDesc.charAt(0).toUpperCase() + userDesc.slice(1),
      type: 'composite',
      icon: 'user',
      schema: {
        label: userDesc.charAt(0).toUpperCase() + userDesc.slice(1),
        mainData: composedMains
      }
    }
  };
}

// Usa template esistente con miglioramenti
async function useExistingTemplate(templateName, templates, userDesc) {
  const template = templates[templateName];
  if (!template) {
    throw new Error(`Template ${templateName} not found`);
  }

  // ✅ NUOVA STRUTTURA: Usa subTasksIds invece di subData
  // NOTA: Un template alla radice non sa se sarà usato come sottodato o come main,
  // quindi può avere tutti i 6 tipi di steps (start, noMatch, noInput, confirmation, notConfirmed, success).
  // Quando lo usiamo come sottodato, filtriamo e prendiamo solo start, noInput, noMatch.
  // Ignoriamo confirmation, notConfirmed, success anche se presenti nel template sottodato.
  const subTasksIds = template.subTasksIds || [];
  const mainDataList = [];

  if (subTasksIds.length > 0) {
    // ✅ Template composito: crea UN SOLO mainData con subTasks[] popolato
    // ✅ PRIMA: Costruisci array di subTasks instances
    // Per ogni ID in subTasksIds, cerca il template corrispondente e crea una sotto-istanza
    const subTasksInstances = [];

    for (const subId of subTasksIds) {
      // ✅ Cerca template per ID (può essere _id, id, name, o label)
      const subTemplate = templates[subId] ||
        Object.values(templates).find((t) =>
          t._id === subId || t.id === subId || t.name === subId || t.label === subId
        );

      if (subTemplate) {
        // ✅ Estrai steps filtrati per sub-tasks (solo start, noInput, noMatch)
        const subTemplateId = subTemplate.id || subTemplate._id || subId;
        let filteredSteps = undefined;

        if (subTemplate.steps && subTemplateId) {
          const nodeSteps = subTemplate.steps[String(subTemplateId)];
          if (nodeSteps && typeof nodeSteps === 'object') {
            const filtered = {};
            const allowedStepTypes = ['start', 'noInput', 'noMatch'];
            for (const stepType of allowedStepTypes) {
              if (nodeSteps[stepType]) {
                filtered[stepType] = nodeSteps[stepType];
              }
            }
            if (Object.keys(filtered).length > 0) {
              filteredSteps = { [String(subTemplateId)]: filtered };
            }
          }
        }

        // ✅ Usa la label del template trovato (non l'ID!)
        subTasksInstances.push({
          label: subTemplate.label || subTemplate.name || 'Sub',
          type: subTemplate.type || subTemplate.name || 'generic',
          icon: subTemplate.icon || 'FileText',
          steps: filteredSteps, // ✅ Usa steps invece di steps
          constraints: subTemplate.dataContracts || subTemplate.constraints || [],
          subTasks: []
        });
      }
    }

    // ✅ POI: Crea UN SOLO mainData con subTasks[] popolato (non elementi separati!)
    // L'istanza principale copia TUTTI gli steps dal template (tutti i tipi)
    const mainTemplateId = template.id || template._id;
    mainDataList.push({
      label: template.label,
      type: template.type,
      icon: template.icon,
      steps: mainTemplateId && template.steps ? { [String(mainTemplateId)]: template.steps[String(mainTemplateId)] } : undefined, // ✅ Usa steps invece di steps
      constraints: template.dataContracts || template.constraints || [],
      subTasks: subTasksInstances // ✅ Sottodati QUI dentro subTasks[], non in mainData[]
    }); // ✅ UN SOLO elemento in mainDataList
  } else {
    // ✅ Template semplice: crea istanza dal template root
    const mainTemplateId = template.id || template._id;
    mainDataList.push({
      label: template.label,
      type: template.type,
      icon: template.icon,
      steps: mainTemplateId && template.steps ? { [String(mainTemplateId)]: template.steps[String(mainTemplateId)] } : undefined, // ✅ Usa steps invece di steps
      constraints: template.dataContracts || template.constraints || [],
      subTasks: []
    });
  }

  return {
    ai: {
      action: 'use_existing',
      template_source: templateName,
      auditing_state: 'AI_generated',
      reason: `Used existing "${templateName}" template`,
      label: template.label,
      type: template.type,
      icon: template.icon,
      schema: {
        label: template.label,
        mainData: mainDataList
        // ❌ RIMOSSO: steps - usa steps nei nodi invece
      }
    }
  };
}

// Genera descrizioni di validazione in linguaggio naturale
function generateValidationDescription(type, validation) {
  const descriptions = {
    'name': 'The name must contain only letters, spaces, hyphens and apostrophes. It must be between 2 and 100 characters long.',
    'date': 'The date must be in YYYY-MM-DD format and represent a valid calendar date. The year must be between 1900 and 2024.',
    'email': 'The email must be in valid email format with a domain and local part.',
    'phone': 'The phone number must contain only digits and be between 6 and 15 characters long.',
    'address': 'The address must contain street information, city, and postal code.',
    'generic': 'This field accepts text input with basic validation rules.'
  };

  return descriptions[type] || 'This field has specific validation rules that must be followed.';
}

// Genera esempi di test strutturati
function generateTestExamples(type, validation) {
  const examples = {
    'name': {
      valid: ['Mario Rossi', 'Jean-Pierre O\'Connor', 'María José'],
      invalid: ['123', 'M', 'John@Doe'],
      edgeCases: ['A', 'Jean-Pierre', 'O\'Connor']
    },
    'date': {
      valid: ['1990-05-12', '2000-12-31', '1985-01-01'],
      invalid: ['32-13-99', '2024-02-30', '1899-01-01'],
      edgeCases: ['1900-01-01', '2024-12-31', '2000-02-29']
    },
    'email': {
      valid: ['mario.rossi@example.com', 'user+alias@domain.co.uk', 'name@domain.it'],
      invalid: ['plainaddress', '@missinglocal.org', 'user@.com'],
      edgeCases: ['a@b.co', 'very.common@example.com', 'user@[192.168.1.1]']
    },
    'phone': {
      valid: ['+39 333 1234567', '0212345678', '5551234'],
      invalid: ['123', 'abc', '12345'],
      edgeCases: ['+1 555', '1234567890123456', '+39']
    },
    'address': {
      valid: ['Via Roma 10, 20100 Milano, Italia', '123 Main St, New York, NY 10001'],
      invalid: ['', '123', 'Via Roma'],
      edgeCases: ['Via Roma 10', 'Milano, Italia', '123 Main St']
    },
    'generic': {
      valid: ['Sample text', 'Valid input', 'Test value'],
      invalid: ['', '   ', 'a'],
      edgeCases: ['A', 'Very long text that might exceed limits', 'Special chars: !@#$%']
    }
  };

  return examples[type] || examples['generic'];
}

// Genera valore di esempio
function generateExampleValue(type) {
  const examples = {
    'name': 'Mario Rossi',
    'date': '1990-05-12',
    'email': 'mario.rossi@example.com',
    'phone': '+39 333 1234567',
    'address': 'Via Roma 10, 20100 Milano, Italia',
    'generic': 'Sample text'
  };

  return examples[type] || 'Example value';
}

// --- GENERATIVE CONSTRAINT ENDPOINT ---
app.post('/api/generateConstraint', async (req, res) => {
  const { description, variable, type } = req.body;
  // MOCK generativa: genera constraint JS e test coerenti
  let script = '';
  let messages = [];
  let testCases = [];
  let title = '';
  let explanation = '';
  if (description.toLowerCase().includes('passato')) {
    script = `value => new Date(value) < new Date()`;
    messages = ['La data deve essere nel passato'];
    testCases = [
      { input: '2020-01-01', expected: true, description: 'Data nel passato' },
      { input: '2099-01-01', expected: false, description: 'Data nel futuro' }
    ];
    title = 'Data nel passato';
    explanation = 'Il valore deve essere una data precedente a oggi.';
  } else if (description.toLowerCase().includes('positivo')) {
    script = `value => Number(value) > 0`;
    messages = ['Il valore deve essere positivo'];
    testCases = [
      { input: 5, expected: true, description: 'Valore positivo' },
      { input: -2, expected: false, description: 'Valore negativo' }
    ];
    title = 'Valore positivo';
    explanation = 'Il valore deve essere maggiore di zero.';
  } else {
    script = `value => true`;
    messages = ['Vincolo generico'];
    testCases = [
      { input: 1, expected: true, description: 'Test generico' }
    ];
    title = 'Vincolo generico';
    explanation = 'Vincolo generato in modo generico.';
  }
  res.json({
    variable,
    type,
    script,
    messages,
    testCases,
    title,
    explanation
  });
});

// ✅ ENTERPRISE AI ENDPOINTS

// Single field analysis endpoint for auto-mapping
app.post('/api/analyze-field', async (req, res) => {
  try {
    const { fieldLabel, provider = 'groq', model } = req.body;

    console.log('[FIELD_ANALYSIS] Analyzing field:', fieldLabel, 'with provider:', provider, 'model:', model || 'default');

    const templates = await loadTemplatesFromDB();
    const analysis = await analyzeUserRequestWithAI(fieldLabel, templates, provider, model);

    console.log('[FIELD_ANALYSIS] Result:', analysis.action);

    res.json({
      fieldLabel,
      analysis,
      provider_used: provider,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[FIELD_ANALYSIS] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ HEURISTIC MATCHING
const { findBestTemplateMatch, buildHeuristicResponse, extractMentionedFields } = require('./template_heuristics');
const { PatternMemoryService } = require('./services/PatternMemoryService');

// PatternMemoryService instance (singleton)
let patternMemoryService = null;

function getPatternMemoryService() {
  if (!patternMemoryService) {
    patternMemoryService = new PatternMemoryService(uri, dbFactory);
  }
  return patternMemoryService;
}

// Provider selection endpoint
app.post('/step2-with-provider', async (req, res) => {
  const requestId = Date.now();
  console.log(`[STEP2][${requestId}] 📥 POST /step2-with-provider - Request received`);

  try {
    const { userDesc, provider = 'groq', model } = req.body;

    console.log(`[STEP2][${requestId}] Raw body:`, req.body);
    console.log(`[STEP2][${requestId}] Parsed userDesc:`, userDesc);
    console.log(`[STEP2][${requestId}] Parsed provider:`, provider);
    console.log(`[STEP2][${requestId}] Parsed model:`, model);

    // Load templates from database
    console.log(`[STEP2][${requestId}] Loading templates from database...`);
    const templates = await loadTemplatesFromDB();
    console.log(`[STEP2][${requestId}] Using`, Object.keys(templates).length, 'templates from Factory DB cache');

    // Initialize orchestrator with templates (lazy initialization)
    // This pre-computes embeddings for faster retrieval
    try {
      await templateIntelligenceOrchestrator.initialize(templates);
    } catch (initError) {
      console.warn('[STEP2] Orchestrator initialization failed (will continue without embeddings):', initError.message);
      // Continue without embeddings - will fallback to create_new
    }

    // ✅ Load pattern memory for synonyms (default to 'it' for now, can be passed from request)
    const targetLang = req.body.language || 'it';
    const projectId = req.body.projectId || null;
    const patternService = getPatternMemoryService();
    let patternMemory = null;

    try {
      patternMemory = await patternService.loadPatterns(targetLang, projectId);
      console.log('[STEP2][PATTERN_MEMORY] Loaded pattern memory:', {
        language: targetLang,
        projectId: projectId,
        templatesWithPatterns: patternMemory.templatePatterns.size,
        uniquePatterns: patternMemory.patternToGuids.size
      });
    } catch (patternError) {
      console.warn('[STEP2][PATTERN_MEMORY] Failed to load pattern memory, continuing without it:', patternError.message);
      // Continue without pattern memory (backward compatibility)
    }

    // ✅ HEURISTIC MATCHING: Try deterministic matching before AI
    try {
      console.log('[STEP2][HEURISTIC] Starting heuristic matching', {
        userDesc,
        templatesCount: Object.keys(templates).length,
        templateNames: Object.keys(templates).slice(0, 10),
        hasPatternMemory: !!patternMemory
      });

      const heuristicResult = findBestTemplateMatch(userDesc, templates, null, patternMemory);

      console.log('[STEP2][HEURISTIC] Match result:', {
        hasResult: !!heuristicResult,
        result: heuristicResult ? {
          templateName: heuristicResult.template?.name,
          score: heuristicResult.score,
          reason: heuristicResult.reason,
          templateType: heuristicResult.template?.type,
          hasSubTasks: !!heuristicResult.template?.subTasks,
          subTasksCount: heuristicResult.template?.subTasks?.length || 0
        } : null
      });

      if (heuristicResult) {
        const { template, score, reason } = heuristicResult;
        console.log(`[STEP2][HEURISTIC] ✅ Match found: ${template.name || 'unknown'} (score: ${score}, reason: ${reason})`);
        console.log('[STEP2][HEURISTIC] Template structure:', JSON.stringify(template, null, 2));

        // Extract mentioned fields for response building
        const mentionedFields = extractMentionedFields(userDesc, templates, patternMemory);
        console.log('[STEP2][HEURISTIC] Mentioned fields:', mentionedFields);

        // Build response from matched template
        const heuristicResponse = buildHeuristicResponse(template, mentionedFields, templates, 'it');

        // ✅ DEBUG: Log steps nella risposta
        console.log('[STEP2][HEURISTIC] Response built:', JSON.stringify(heuristicResponse, null, 2));
        console.log('[STEP2][HEURISTIC] DEBUG steps check:', {
          mainDataHasSteps: heuristicResponse.schema?.mainData?.some(m => m.steps),
          mainDataSteps: heuristicResponse.schema?.mainData?.map(m => ({
            label: m.label,
            hasSteps: !!m.steps,
            stepsKeys: m.steps ? Object.keys(m.steps) : []
          }))
        });

        return res.json({
          ai: heuristicResponse
        });
      } else {
        console.log('[STEP2][HEURISTIC] No heuristic match found, falling back to AI');
      }
    } catch (heuristicError) {
      console.error('[STEP2][HEURISTIC] Heuristic matching failed, falling back to AI:', heuristicError);
      console.error('[STEP2][HEURISTIC] Error stack:', heuristicError.stack);
    }

    // Fallback to AI if no heuristic match
    console.log('[STEP2] Using Template Intelligence Service (AI fallback)');
    const analysis = await analyzeUserRequestWithAI(userDesc, templates, provider, model);

    console.log('[STEP2] AI Analysis:', analysis.action, '- User requested', `"${userDesc}"`, '...');
    console.log('[STEP2] AI Response generated:', JSON.stringify(analysis, null, 2));

    // ❌ RIMOSSO: steps - usa steps nei nodi invece
    // Se AI trova un template match, gli steps sono già inclusi nei nodi mainData

    res.json({
      ai: {
        ...analysis,
        provider_used: provider,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error(`[STEP2][${requestId}] ❌ ERROR:`, error);
    console.error(`[STEP2][${requestId}] ❌ Error stack:`, error.stack);
    console.error(`[STEP2][${requestId}] ❌ Error details:`, {
      message: error.message,
      name: error.name,
      code: error.code,
      body: req.body
    });
    res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Provider information endpoint
app.get('/api/ai-providers', (req, res) => {
  res.json({
    available: aiProviderService.getAvailableProviders(),
    info: aiProviderService.getAllProvidersInfo(),
    metrics: aiProviderService.getMetrics(),
    default: 'openai'
  });
});

// Health check endpoint
app.get('/api/ai-health', async (req, res) => {
  try {
    const health = await aiProviderService.healthCheck();
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Service status endpoint
app.get('/api/ai-status', (req, res) => {
  res.json(aiProviderService.getStatus());
});

// ✅ ENTERPRISE ADVANCED ENDPOINTS

// Circuit breaker status
app.get('/api/ai-circuit-breakers', (req, res) => {
  res.json(circuitBreakerManager.getAllBreakerStatuses());
});

// Rate limit status
app.get('/api/ai-rate-limits', (req, res) => {
  const status = {};
  for (const provider of aiProviderService.getAvailableProviders()) {
    status[provider] = rateLimiter.getStatus(provider, 'global');
  }
  res.json(status);
});

// Advanced health check
app.get('/api/ai-health-detailed', async (req, res) => {
  try {
    const report = await healthChecker.getDetailedReport();
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health trends
app.get('/api/ai-health-trends', (req, res) => {
  res.json(healthChecker.getHealthTrends());
});

// Reset circuit breakers
app.post('/api/ai-reset-circuit-breakers', (req, res) => {
  circuitBreakerManager.resetAllBreakers();
  res.json({ message: 'All circuit breakers reset' });
});

// Reset rate limits
app.post('/api/ai-reset-rate-limits', (req, res) => {
  rateLimiter.resetAll();
  res.json({ message: 'All rate limits reset' });
});

// --- Extractor endpoints (centralized contracts) ---
app.get('/api/extractors/bindings', async (req, res) => {
  try {
    // For now return global bindings are implicit; a real impl would read Mongo and merge scopes
    res.json({ ok: true, strategy: 'global', note: 'Bindings are resolved server-side when running extractors' });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.post('/api/extractors/run', async (req, res) => {
  const { kind, text, locale } = req.body || {};
  if (!kind || typeof text !== 'string') return res.status(400).json({ ok: false, error: 'kind_and_text_required' });
  try {
    // TODO: Implement extraction logic or use external service
    const out = { value: text, confidence: 0, matched: false };
    res.json(out);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// -----------------------------
// Endpoint: Update catalog timestamp
// -----------------------------
app.post('/api/projects/catalog/update-timestamp', async (req, res) => {
  const { projectId, ownerCompany, ownerClient } = req.body;
  if (!projectId) {
    return res.status(400).json({ error: 'projectId_required' });
  }
  const client = await getMongoClient();
  try {
    const db = client.db(dbProjects);
    const cat = db.collection('projects_catalog');
    const now = new Date();
    const updateDoc = { updatedAt: now };

    // Aggiorna ownerCompany se fornito
    if (ownerCompany !== undefined) {
      updateDoc.ownerCompany = ownerCompany || null;
    }

    // Aggiorna ownerClient se fornito
    if (ownerClient !== undefined) {
      updateDoc.ownerClient = ownerClient || null;
    }

    const result = await cat.updateOne(
      { _id: projectId },
      { $set: updateDoc }
    );
    if (result.matchedCount === 0) {
      logInfo('Catalog.updateTimestamp', { projectId, warning: 'project_not_found_in_catalog' });
    } else {
      logInfo('Catalog.updateTimestamp', { projectId, updated: true, ownerCompany: ownerCompany !== undefined, ownerClient: ownerClient !== undefined });
    }

    // Aggiorna anche project_meta se esiste
    try {
      const catalogDoc = await cat.findOne({ _id: projectId });
      if (catalogDoc && catalogDoc.dbName) {
        const projDb = client.db(catalogDoc.dbName);
        const metaUpdate = { updatedAt: now };
        if (ownerCompany !== undefined) {
          metaUpdate.ownerCompany = ownerCompany || null;
        }
        if (ownerClient !== undefined) {
          metaUpdate.ownerClient = ownerClient || null;
        }
        await projDb.collection('project_meta').updateOne(
          { _id: 'meta' },
          { $set: metaUpdate }
        );
      }
    } catch (metaErr) {
      // Non bloccare se project_meta non esiste o errore
      console.warn('[Catalog.updateTimestamp] Failed to update project_meta:', metaErr);
    }

    res.json({ ok: true });
  } catch (e) {
    logError('Catalog.updateTimestamp', e);
    res.status(500).json({ error: String(e?.message || e) });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

// ✅ Funzione per precaricare tutte le cache del server
async function preloadAllServerCaches() {
  console.log('[SERVER] 🚀 Precaricando tutte le cache del server...');
  try {
    await Promise.all([
      loadTemplatesFromDB(),
      loadTaskHeuristicsFromDB()
    ]);
    console.log('[SERVER] ✅ Tutte le cache del server precaricate - inferenza ora istantanea!');
  } catch (err) {
    console.warn('[SERVER] ⚠️ Errore nel precaricamento cache (non critico):', err.message);
  }
}

// ✅ Precarica tutte le cache all'avvio del server
preloadAllServerCaches();

// Initialize indexes for factory Translations collection (one-time, async)
(async () => {
  try {
    const client = await getMongoClient();
    const factoryDb = client.db(dbFactory);
    const factoryTranslationsColl = factoryDb.collection('Translations');

    // Create indexes for faster translation queries
    await factoryTranslationsColl.createIndex({ language: 1, type: 1 }).catch(() => { });
    await factoryTranslationsColl.createIndex({ guid: 1, language: 1 }).catch(() => { });
    await factoryTranslationsColl.createIndex({ language: 1, type: 1, projectId: 1 }).catch(() => { });
  // ✅ NON chiudere la connessione se usi il pool
    console.log('[SERVER] ✅ Factory Translations indexes initialized');
  } catch (err) {
    console.warn('[SERVER] ⚠️ Could not initialize factory Translations indexes:', err.message);
  }
})();

// ═══════════════════════════════════════════════════════════════════════════
// 🚀 RUNTIME API - Flow Compiler Endpoint
// ═══════════════════════════════════════════════════════════════════════════

app.post('/api/runtime/compile', async (req, res) => {
  try {
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('🚀 [API] POST /api/runtime/compile - REQUEST RECEIVED');
    console.log('═══════════════════════════════════════════════════════════════════════════');

    const { nodes, edges, tasks, ddts, projectId, translations } = req.body;

    console.log('[API] Compile request:', {
      nodesCount: nodes?.length || 0,
      edgesCount: edges?.length || 0,
      tasksCount: tasks?.length || 0,
      ddtsCount: ddts?.length || 0,
      projectId,
      translationsCount: translations ? Object.keys(translations).length : 0
    });

    // ✅ Translations come from frontend (already in memory from ProjectTranslationsContext)
    // Frontend passes translations table directly - no database access needed
    // Runtime will do lookup at execution time instead of "baking" translations during compilation
    const projectTranslations = translations || {};

    // Import compiler (TypeScript - using ts-node)
    let compileFlow;
    try {
      // Register ts-node to execute TypeScript
      require('ts-node').register({
        transpileOnly: true,
        compilerOptions: {
          module: 'commonjs',
          esModuleInterop: true,
          resolveJsonModule: true
        }
      });

      // Import TypeScript compiler
      const compilerModule = require('./runtime/compiler/compiler.ts');
      compileFlow = compilerModule.compileFlow;

      if (!compileFlow) {
        throw new Error('compileFlow function not found in compiler module');
      }

      console.log('[API] ✅ Backend compiler loaded successfully');
    } catch (err) {
      console.error('[API] ❌ Error loading compiler:', err);
      return res.status(500).json({
        error: 'Compiler not available',
        message: 'Failed to load TypeScript compiler. Make sure ts-node is installed.',
        details: err.message,
        stack: err.stack
      });
    }

    // Create getTask function from tasks array
    const taskMap = new Map();
    if (tasks && Array.isArray(tasks)) {
      tasks.forEach(task => {
        taskMap.set(task.id, task);
      });
    }

    const getTask = (taskId) => {
      return taskMap.get(taskId) || null;
    };

    // Create getDDT function from ddts array
    const ddtMap = new Map();
    if (ddts && Array.isArray(ddts)) {
      ddts.forEach(ddt => {
        if (ddt.id) {
          ddtMap.set(ddt.id, ddt);
        }
      });
    }

    const getDDT = (taskId) => {
      // Find DDT associated with task
      const task = getTask(taskId);
      // ✅ DDT fields directly on task (no value wrapper)
      if (task && task.mainData && task.mainData.length > 0) {
        return {
          label: task.label,
          mainData: task.mainData,
          steps: task.steps,
          constraints: task.constraints,
          examples: task.examples
        };
      }
      // Try to find by taskId in ddts
      return ddtMap.get(taskId) || null;
    };

    // Call compiler
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('🔧 [BACKEND] Flow Compiler - EXECUTING ON BACKEND');
    console.log('📍 Location: BACKEND (Node.js server)');
    console.log('🔨 Compiler: backend/runtime/compiler/compiler.ts');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('[API] Calling backend compiler...');
    const result = compileFlow(nodes, edges, {
      getTask,
      getDDT,
      translations: projectTranslations // ✅ Pass translation table to compiler
    });

    // Convert Map to object for JSON serialization
    const taskMapObj = {};
    result.taskMap.forEach((value, key) => {
      taskMapObj[key] = value;
    });

    const response = {
      tasks: result.tasks,
      entryTaskId: result.entryTaskId,
      taskMap: taskMapObj,
      translations: result.translations || {}, // ✅ Include translation table for runtime lookup
      compiledBy: 'BACKEND_RUNTIME', // ✅ Flag to confirm backend compiler was used
      timestamp: new Date().toISOString()
    };

    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('✅ [BACKEND] Flow Compiler - COMPLETED');
    console.log('📍 Execution: BACKEND (Node.js server)');
    console.log('✅ Compilation: SUCCESS');
    console.log('[API] Compile result:', {
      tasksCount: result.tasks.length,
      entryTaskId: result.entryTaskId,
      translationsCount: Object.keys(result.translations || {}).length,
      compiledBy: 'BACKEND_RUNTIME',
      timestamp: response.timestamp
    });
    console.log('═══════════════════════════════════════════════════════════════════════════');

    res.json(response);
  } catch (error) {
    console.error('═══════════════════════════════════════════════════════════════════════════');
    console.error('❌ [API] POST /api/runtime/compile - ERROR');
    console.error('[API] Error:', error);
    console.error('═══════════════════════════════════════════════════════════════════════════');
    res.status(500).json({
      error: 'Compilation failed',
      message: error.message,
      stack: error.stack
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 🚀 RUNTIME API - DDT Engine Endpoint
// ═══════════════════════════════════════════════════════════════════════════

app.post('/api/runtime/ddt/run', async (req, res) => {
  try {
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('🚀 [API] POST /api/runtime/ddt/run - REQUEST RECEIVED');
    console.log('═══════════════════════════════════════════════════════════════════════════');

    const { ddtInstance, userInputs, translations, limits } = req.body;

    console.log('[API] DDT run request:', {
      ddtId: ddtInstance?.id,
      ddtLabel: ddtInstance?.label,
      userInputsCount: userInputs?.length || 0,
      hasTranslations: !!translations,
      timestamp: new Date().toISOString()
    });

    if (!ddtInstance) {
      return res.status(400).json({
        error: 'Missing ddtInstance',
        message: 'ddtInstance is required'
      });
    }

    // Import DDT Engine (TypeScript - using ts-node)
    let runDDT;
    try {
      // Register ts-node if not already registered
      try {
        require('ts-node').register({
          transpileOnly: true,
          compilerOptions: {
            module: 'commonjs',
            esModuleInterop: true,
            resolveJsonModule: true
          }
        });
      } catch (e) {
        // Already registered, ignore
      }

      // Import TypeScript DDT Engine
      const ddtModule = require('./runtime/ddt/ddtEngine.ts');
      runDDT = ddtModule.runDDT;

      if (!runDDT) {
        throw new Error('runDDT function not found in DDT engine module');
      }

      console.log('[API] ✅ Backend DDT Engine loaded successfully');
    } catch (err) {
      console.error('[API] ❌ Error loading DDT Engine:', err);
      return res.status(500).json({
        error: 'DDT Engine not available',
        message: 'Failed to load TypeScript DDT Engine. Make sure ts-node is installed.',
        details: err.message,
        stack: err.stack
      });
    }

    // Prepare callbacks for DDT Engine
    const messages = [];
    const inputQueue = userInputs || [];
    let inputIndex = 0;

    const callbacks = {
      onMessage: (text, stepType, escalationNumber) => {
        messages.push({
          text,
          stepType: stepType || 'message',
          escalationNumber,
          timestamp: new Date().toISOString()
        });
        console.log('[API][DDT] Message:', { text: text?.substring(0, 50), stepType, escalationNumber });
      },
      onGetRetrieveEvent: async (nodeId, ddt) => {
        // Get next input from queue
        if (inputIndex < inputQueue.length) {
          const input = inputQueue[inputIndex++];
          console.log('[API][DDT] Retrieving input:', { nodeId, input: input?.substring(0, 50) });
          return { type: 'match', value: input };
        } else {
          // No more inputs - return noInput
          console.log('[API][DDT] No more inputs available');
          return { type: 'noInput' };
        }
      },
      onProcessInput: async (input, node) => {
        // Simple processing - in real scenario, this would use NLP contracts
        console.log('[API][DDT] Processing input:', { input: input?.substring(0, 50), nodeId: node?.id });
        return {
          status: 'match',
          value: input
        };
      },
      onUserInputProcessed: (input, matchStatus, extractedValues) => {
        console.log('[API][DDT] Input processed:', { input: input?.substring(0, 50), matchStatus });
      },
      translations: translations || {}
    };

    // Run DDT Engine
    console.log('[API] Calling backend DDT Engine...');
    const result = await runDDT(ddtInstance, callbacks, limits);

    const response = {
      success: result.success,
      value: result.value,
      messages: messages,
      executedBy: 'BACKEND_RUNTIME', // ✅ Flag to confirm backend DDT Engine was used
      timestamp: new Date().toISOString()
    };

    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('✅ [API] POST /api/runtime/ddt/run - COMPLETED');
    console.log('[API] DDT result:', {
      success: result.success,
      messagesCount: messages.length,
      memoryKeys: result.value ? Object.keys(result.value) : [],
      executedBy: 'BACKEND_RUNTIME',
      timestamp: response.timestamp
    });
    console.log('═══════════════════════════════════════════════════════════════════════════');

    res.json(response);
  } catch (error) {
    console.error('═══════════════════════════════════════════════════════════════════════════');
    console.error('❌ [API] POST /api/runtime/ddt/run - ERROR');
    console.error('[API] Error:', error);
    console.error('═══════════════════════════════════════════════════════════════════════════');
    res.status(500).json({
      error: 'DDT execution failed',
      message: error.message,
      stack: error.stack
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 🚀 RUNTIME API - DDT Engine Session Endpoints (Interactive)
// ═══════════════════════════════════════════════════════════════════════════

// Import DDT Session Manager
let DDTSessionManager;
try {
  require('ts-node').register({
    transpileOnly: true,
    compilerOptions: {
      module: 'commonjs',
      esModuleInterop: true,
      resolveJsonModule: true
    }
  });
  const sessionModule = require('./runtime/session/DDTSessionManager.ts');
  DDTSessionManager = sessionModule.ddtSessionManager;
  console.log('[SERVER] ✅ DDT Session Manager loaded successfully');
} catch (err) {
  console.warn('[SERVER] ⚠️ DDT Session Manager not available:', err.message);
}

// POST /api/runtime/ddt/session/start - Start a new DDT session
app.post('/api/runtime/ddt/session/start', async (req, res) => {
  try {
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('🚀 [API] POST /api/runtime/ddt/session/start - REQUEST');
    console.log('═══════════════════════════════════════════════════════════════════════════');

    const { ddtInstance, translations, limits } = req.body;

    if (!ddtInstance) {
      return res.status(400).json({
        error: 'Missing ddtInstance',
        message: 'ddtInstance is required'
      });
    }

    if (!DDTSessionManager) {
      return res.status(500).json({
        error: 'DDT Session Manager not available',
        message: 'Failed to load DDT Session Manager'
      });
    }

    const sessionId = DDTSessionManager.createSession(
      ddtInstance,
      translations || {},
      limits || {}
    );

    console.log('✅ [API] POST /api/runtime/ddt/session/start - Session created:', { sessionId });
    res.json({
      sessionId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [API] POST /api/runtime/ddt/session/start - ERROR', error);
    res.status(500).json({
      error: 'Failed to create session',
      message: error.message,
      stack: error.stack
    });
  }
});

// POST /api/runtime/ddt/session/:id/input - Provide user input to session
app.post('/api/runtime/ddt/session/:id/input', async (req, res) => {
  try {
    const { id: sessionId } = req.params;
    const { input } = req.body;

    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('📥 [API] POST /api/runtime/ddt/session/:id/input - REQUEST', {
      sessionId,
      inputLength: input?.length || 0
    });
    console.log('═══════════════════════════════════════════════════════════════════════════');

    if (!DDTSessionManager) {
      return res.status(500).json({
        error: 'DDT Session Manager not available'
      });
    }

    const result = DDTSessionManager.provideInput(sessionId, input || '');

    if (!result.success) {
      console.warn('⚠️ [API] POST /api/runtime/ddt/session/:id/input - Failed:', result.error);
      return res.status(400).json({
        error: result.error || 'Failed to provide input'
      });
    }

    console.log('✅ [API] POST /api/runtime/ddt/session/:id/input - Input provided');
    res.json({
      success: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [API] POST /api/runtime/ddt/session/:id/input - ERROR', error);
    res.status(500).json({
      error: 'Failed to provide input',
      message: error.message
    });
  }
});

// GET /api/runtime/ddt/session/:id/stream - SSE stream for real-time events
app.get('/api/runtime/ddt/session/:id/stream', (req, res) => {
  try {
    const { id: sessionId } = req.params;

    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('📡 [API] GET /api/runtime/ddt/session/:id/stream - SSE connection opened', { sessionId });
    console.log('═══════════════════════════════════════════════════════════════════════════');

    if (!DDTSessionManager) {
      res.status(500).write('event: error\n');
      res.write(`data: ${JSON.stringify({ error: 'DDT Session Manager not available' })}\n\n`);
      res.end();
      return;
    }

    const session = DDTSessionManager.getSession(sessionId);
    if (!session) {
      res.status(404).write('event: error\n');
      res.write(`data: ${JSON.stringify({ error: 'Session not found' })}\n\n`);
      res.end();
      return;
    }

    // Setup SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send existing messages first
    if (session.messages.length > 0) {
      for (const msg of session.messages) {
        res.write(`event: message\n`);
        res.write(`data: ${JSON.stringify(msg)}\n\n`);
      }
    }

    // ✅ Send waitingForInput event if already waiting (handles case where event was emitted before listener registered)
    if (session.waitingForInput) {
      console.log('[API] 📡 Sending pending waitingForInput event to SSE client', {
        sessionId,
        nodeId: session.waitingForInput.nodeId
      });
      res.write(`event: waitingForInput\n`);
      res.write(`data: ${JSON.stringify({ nodeId: session.waitingForInput.nodeId })}\n\n`);
    }

    // If session is already complete, send result immediately
    if (session.result) {
      res.write(`event: complete\n`);
      res.write(`data: ${JSON.stringify(session.result)}\n\n`);
      res.end();
      return;
    }

    // Listen to events from session
    const eventEmitter = session.eventEmitter;
    if (!eventEmitter) {
      res.write('event: error\n');
      res.write(`data: ${JSON.stringify({ error: 'Session event emitter not available' })}\n\n`);
      res.end();
      return;
    }

    const onMessage = (msg) => {
      if (!res.writableEnded) {
        res.write(`event: message\n`);
        res.write(`data: ${JSON.stringify(msg)}\n\n`);
      }
    };

    const onWaitingForInput = (data) => {
      if (!res.writableEnded) {
        res.write(`event: waitingForInput\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }
    };

    const onComplete = (result) => {
      if (!res.writableEnded) {
        res.write(`event: complete\n`);
        res.write(`data: ${JSON.stringify(result)}\n\n`);
        res.end();
      }
    };

    const onError = (error) => {
      if (!res.writableEnded) {
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({ error: error.message || String(error) })}\n\n`);
        res.end();
      }
    };

    // Register event listeners
    eventEmitter.on('message', onMessage);
    eventEmitter.on('waitingForInput', onWaitingForInput);
    eventEmitter.on('complete', onComplete);
    eventEmitter.on('error', onError);

    // Cleanup on client disconnect
    req.on('close', () => {
      console.log('✅ [API] GET /api/runtime/ddt/session/:id/stream - SSE connection closed', { sessionId });
      eventEmitter.removeListener('message', onMessage);
      eventEmitter.removeListener('waitingForInput', onWaitingForInput);
      eventEmitter.removeListener('complete', onComplete);
      eventEmitter.removeListener('error', onError);
    });

    // Send heartbeat every 30 seconds to keep connection alive
    const heartbeatInterval = setInterval(() => {
      if (!res.writableEnded) {
        res.write(': heartbeat\n\n');
      } else {
        clearInterval(heartbeatInterval);
      }
    }, 30000);

    // Clear heartbeat on close
    req.on('close', () => {
      clearInterval(heartbeatInterval);
    });
  } catch (error) {
    console.error('❌ [API] GET /api/runtime/ddt/session/:id/stream - ERROR', error);
    if (!res.headersSent) {
      res.status(500).write('event: error\n');
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    }
    res.end();
  }
});

// GET /api/runtime/ddt/session/:id/status - Get session status (kept for compatibility)
app.get('/api/runtime/ddt/session/:id/status', async (req, res) => {
  try {
    const { id: sessionId } = req.params;
    const { lastMessageIndex } = req.query;

    if (!DDTSessionManager) {
      return res.status(500).json({
        error: 'DDT Session Manager not available'
      });
    }

    const status = DDTSessionManager.getSessionStatus(sessionId);

    if (!status.found) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    // If lastMessageIndex is provided, return only new messages
    if (lastMessageIndex !== undefined) {
      const lastIndex = parseInt(String(lastMessageIndex), 10);
      const newMessages = DDTSessionManager.getNewMessages(sessionId, lastIndex);

      res.json({
        ...status.session,
        newMessages: newMessages.messages || [],
        hasMore: newMessages.hasMore
      });
    } else {
      res.json(status.session);
    }
  } catch (error) {
    console.error('❌ [API] GET /api/runtime/ddt/session/:id/status - ERROR', error);
    res.status(500).json({
      error: 'Failed to get session status',
      message: error.message
    });
  }
});

// DELETE /api/runtime/ddt/session/:id - Delete session
app.delete('/api/runtime/ddt/session/:id', async (req, res) => {
  try {
    const { id: sessionId } = req.params;

    if (!DDTSessionManager) {
      return res.status(500).json({
        error: 'DDT Session Manager not available'
      });
    }

    const deleted = DDTSessionManager.deleteSession(sessionId);

    if (!deleted) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [API] DELETE /api/runtime/ddt/session/:id - ERROR', error);
    res.status(500).json({
      error: 'Failed to delete session',
      message: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 🚀 RUNTIME API - Flow Orchestrator Session Endpoints (Interactive)
// ═══════════════════════════════════════════════════════════════════════════

// Import Orchestrator Session Manager (lazy load to avoid blocking server startup)
let OrchestratorSessionManager;
let orchestratorSessionManagerInstance;

function loadOrchestratorSessionManager() {
  if (OrchestratorSessionManager && orchestratorSessionManagerInstance) {
    return { OrchestratorSessionManager, orchestratorSessionManagerInstance };
  }

  try {
    require('ts-node').register({
      transpileOnly: true,
      compilerOptions: {
        module: 'commonjs',
        esModuleInterop: true,
        resolveJsonModule: true
      }
    });
    const orchestratorSessionModule = require('./runtime/session/OrchestratorSessionManager.ts');
    OrchestratorSessionManager = orchestratorSessionModule.OrchestratorSessionManager;
    orchestratorSessionManagerInstance = orchestratorSessionModule.orchestratorSessionManager || new OrchestratorSessionManager();
    console.log('[SERVER] ✅ Orchestrator Session Manager loaded successfully');
    return { OrchestratorSessionManager, orchestratorSessionManagerInstance };
  } catch (err) {
    console.warn('[SERVER] ⚠️ Orchestrator Session Manager not available:', err.message);
    return { OrchestratorSessionManager: null, orchestratorSessionManagerInstance: null };
  }
}

// POST /api/runtime/orchestrator/session/start - Start a new orchestrator session
app.post('/api/runtime/orchestrator/session/start', async (req, res) => {
  try {
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('🚀 [API] POST /api/runtime/orchestrator/session/start - REQUEST');
    console.log('═══════════════════════════════════════════════════════════════════════════');

    const { compilationResult, tasks, ddts, translations } = req.body;

    if (!compilationResult) {
      return res.status(400).json({
        error: 'Missing compilationResult',
        message: 'compilationResult is required'
      });
    }

    const { OrchestratorSessionManager: Manager, orchestratorSessionManagerInstance: instance } = loadOrchestratorSessionManager();
    if (!Manager || !instance) {
      return res.status(500).json({
        error: 'Orchestrator Session Manager not available',
        message: 'Failed to load Orchestrator Session Manager'
      });
    }

    // Convert taskMap from object to Map if needed
    if (compilationResult.taskMap && typeof compilationResult.taskMap === 'object') {
      const taskMap = new Map();
      Object.entries(compilationResult.taskMap).forEach(([key, value]) => {
        taskMap.set(key, value);
      });
      compilationResult.taskMap = taskMap;
    }

    const sessionManager = orchestratorSessionManagerInstance;
    const sessionId = sessionManager.createSession(
      compilationResult,
      tasks || [],
      ddts || [],
      translations || {}
    );

    console.log('✅ [API] POST /api/runtime/orchestrator/session/start - Session created:', { sessionId });
    res.json({
      sessionId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [API] POST /api/runtime/orchestrator/session/start - ERROR', error);
    res.status(500).json({
      error: 'Failed to create session',
      message: error.message,
      stack: error.stack
    });
  }
});

// POST /api/runtime/orchestrator/session/:id/input - Provide user input to session
app.post('/api/runtime/orchestrator/session/:id/input', async (req, res) => {
  try {
    const { id: sessionId } = req.params;
    const { input } = req.body;

    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('📥 [API] POST /api/runtime/orchestrator/session/:id/input - REQUEST', {
      sessionId,
      inputLength: input?.length || 0
    });
    console.log('═══════════════════════════════════════════════════════════════════════════');

    const { OrchestratorSessionManager: Manager, orchestratorSessionManagerInstance: instance } = loadOrchestratorSessionManager();
    if (!Manager || !instance) {
      return res.status(500).json({
        error: 'Orchestrator Session Manager not available'
      });
    }

    const sessionManager = instance;
    const result = sessionManager.provideInput(sessionId, input || '');

    if (!result.success) {
      console.warn('⚠️ [API] POST /api/runtime/orchestrator/session/:id/input - Failed:', result.error);
      return res.status(400).json({
        error: result.error || 'Failed to provide input'
      });
    }

    console.log('✅ [API] POST /api/runtime/orchestrator/session/:id/input - Input provided');
    res.json({
      success: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [API] POST /api/runtime/orchestrator/session/:id/input - ERROR', error);
    res.status(500).json({
      error: 'Failed to provide input',
      message: error.message
    });
  }
});

// GET /api/runtime/orchestrator/session/:id/stream - SSE stream for real-time events
app.get('/api/runtime/orchestrator/session/:id/stream', (req, res) => {
  try {
    const { id: sessionId } = req.params;

    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('📡 [API] GET /api/runtime/orchestrator/session/:id/stream - SSE connection opened', { sessionId });
    console.log('═══════════════════════════════════════════════════════════════════════════');

    const { OrchestratorSessionManager: Manager, orchestratorSessionManagerInstance: instance } = loadOrchestratorSessionManager();
    if (!Manager || !instance) {
      res.status(500).write('event: error\n');
      res.write(`data: ${JSON.stringify({ error: 'Orchestrator Session Manager not available' })}\n\n`);
      res.end();
      return;
    }

    const sessionManager = instance;
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      res.status(404).write('event: error\n');
      res.write(`data: ${JSON.stringify({ error: 'Session not found' })}\n\n`);
      res.end();
      return;
    }

    // Setup SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send existing messages first
    if (session.messages.length > 0) {
      for (const msg of session.messages) {
        res.write(`event: message\n`);
        res.write(`data: ${JSON.stringify(msg)}\n\n`);
      }
    }

    // Send waitingForInput event if already waiting
    if (session.waitingForInput) {
      // Try to get DDT from the task that's waiting
      let ddtForEvent = null;
      try {
        // Get the task from compilation result to find its DDT
        const waitingTask = session.compilationResult.tasks.find(t => t.id === session.waitingForInput.taskId);
        if (waitingTask && waitingTask.mainData && waitingTask.mainData.length > 0) {
          // ✅ DDT fields directly on task (no value wrapper)
          ddtForEvent = {
            label: waitingTask.label,
            mainData: waitingTask.mainData,
            steps: waitingTask.steps, // ✅ Usa steps invece di steps
            constraints: waitingTask.constraints,
            examples: waitingTask.examples
          };
        }
      } catch (e) {
        console.warn('[API] Could not get DDT for waitingForInput event', e);
      }

      console.log('[API] 📡 Sending pending waitingForInput event to SSE client', {
        sessionId,
        taskId: session.waitingForInput.taskId,
        nodeId: session.waitingForInput.nodeId,
        hasDDT: !!ddtForEvent
      });
      res.write(`event: waitingForInput\n`);
      res.write(`data: ${JSON.stringify({
        taskId: session.waitingForInput.taskId,
        nodeId: session.waitingForInput.nodeId,
        ddt: ddtForEvent // Include DDT so frontend can show input box
      })}\n\n`);
    }

    // If session is already complete, send result immediately
    if (session.isComplete) {
      res.write(`event: complete\n`);
      res.write(`data: ${JSON.stringify({ success: true })}\n\n`);
      res.end();
      return;
    }

    // Listen to events from session
    const eventEmitter = session.eventEmitter;
    if (!eventEmitter) {
      res.write('event: error\n');
      res.write(`data: ${JSON.stringify({ error: 'Session event emitter not available' })}\n\n`);
      res.end();
      return;
    }

    const onMessage = (msg) => {
      if (!res.writableEnded) {
        res.write(`event: message\n`);
        res.write(`data: ${JSON.stringify(msg)}\n\n`);
      }
    };

    const onDDTStart = (data) => {
      if (!res.writableEnded) {
        res.write(`event: ddtStart\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }
    };

    const onWaitingForInput = (data) => {
      if (!res.writableEnded) {
        res.write(`event: waitingForInput\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }
    };

    const onStateUpdate = (state) => {
      if (!res.writableEnded) {
        res.write(`event: stateUpdate\n`);
        res.write(`data: ${JSON.stringify({
          currentNodeId: state.currentNodeId,
          executedTaskIds: Array.from(state.executedTaskIds),
          variableStore: state.variableStore
        })}\n\n`);
      }
    };

    const onComplete = (result) => {
      if (!res.writableEnded) {
        res.write(`event: complete\n`);
        res.write(`data: ${JSON.stringify(result)}\n\n`);
        res.end();
      }
    };

    const onError = (error) => {
      if (!res.writableEnded) {
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({ error: error.error || error.message || String(error) })}\n\n`);
        res.end();
      }
    };

    // Register event listeners
    eventEmitter.on('message', onMessage);
    eventEmitter.on('ddtStart', onDDTStart);
    eventEmitter.on('waitingForInput', onWaitingForInput);
    eventEmitter.on('stateUpdate', onStateUpdate);
    eventEmitter.on('complete', onComplete);
    eventEmitter.on('error', onError);

    // Cleanup on client disconnect
    req.on('close', () => {
      console.log('✅ [API] GET /api/runtime/orchestrator/session/:id/stream - SSE connection closed', { sessionId });
      eventEmitter.removeListener('message', onMessage);
      eventEmitter.removeListener('ddtStart', onDDTStart);
      eventEmitter.removeListener('waitingForInput', onWaitingForInput);
      eventEmitter.removeListener('stateUpdate', onStateUpdate);
      eventEmitter.removeListener('complete', onComplete);
      eventEmitter.removeListener('error', onError);
    });

    // Send heartbeat every 30 seconds
    const heartbeatInterval = setInterval(() => {
      if (!res.writableEnded) {
        res.write(': heartbeat\n\n');
      } else {
        clearInterval(heartbeatInterval);
      }
    }, 30000);

    req.on('close', () => {
      clearInterval(heartbeatInterval);
    });
  } catch (error) {
    console.error('❌ [API] GET /api/runtime/orchestrator/session/:id/stream - ERROR', error);
    if (!res.headersSent) {
      res.status(500).write('event: error\n');
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    }
    res.end();
  }
});

// GET /api/runtime/orchestrator/session/:id/status - Get session status
app.get('/api/runtime/orchestrator/session/:id/status', async (req, res) => {
  try {
    const { id: sessionId } = req.params;

    const { OrchestratorSessionManager: Manager, orchestratorSessionManagerInstance: instance } = loadOrchestratorSessionManager();
    if (!Manager || !instance) {
      return res.status(500).json({
        error: 'Orchestrator Session Manager not available'
      });
    }

    const sessionManager = instance;
    const status = sessionManager.getSessionStatus(sessionId);

    if (!status.found) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    if (!status.session) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    res.json({
      session: {
        id: status.session.id,
        isRunning: status.session.isRunning,
        isComplete: status.session.isComplete,
        messages: status.session.messages,
        executionState: status.session.executionState,
        error: status.session.error ? status.session.error.message : undefined
      }
    });
  } catch (error) {
    console.error('❌ [API] GET /api/runtime/orchestrator/session/:id/status - ERROR', error);
    res.status(500).json({
      error: 'Failed to get session status',
      message: error.message
    });
  }
});

// DELETE /api/runtime/orchestrator/session/:id - Delete session
app.delete('/api/runtime/orchestrator/session/:id', async (req, res) => {
  try {
    const { id: sessionId } = req.params;

    const { OrchestratorSessionManager: Manager, orchestratorSessionManagerInstance: instance } = loadOrchestratorSessionManager();
    if (!Manager || !instance) {
      return res.status(500).json({
        error: 'Orchestrator Session Manager not available'
      });
    }

    const sessionManager = instance;
    const deleted = sessionManager.deleteSession(sessionId);

    if (!deleted) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [API] DELETE /api/runtime/orchestrator/session/:id - ERROR', error);
    res.status(500).json({
      error: 'Failed to delete session',
      message: error.message
    });
  }
});

// ✅ Global error handler (must be after all routes)
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}`, {
    error: err.message,
    stack: err.stack
  });
  if (!res.headersSent) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Template label translations (for heuristic matching)
app.get('/api/factory/template-label-translations', async (req, res) => {
  const language = req.query.language || 'it';
  const client = await getMongoClient();
  try {
    const db = client.db(dbFactory);

    // Ottieni tutti gli ID dei template DDT
    const templatesQuery = {
      $or: [
        { type: 3 },
        { type: { $regex: /^datarequest$/i } },
        { type: { $regex: /^data$/i } },
        { name: { $regex: /^(datarequest|getdata|data)$/i } },
        { taskType: { $regex: /^(datarequest|getdata|data)$/i } }
      ]
    };

    const templates1 = await db.collection('tasks').find(templatesQuery).toArray();  // ✅ Collection tasks (lowercase)

    const templateMap = new Map();
    templates1.forEach(t => {
      const id = t.id || t._id?.toString();
      if (id && !templateMap.has(id)) {
        templateMap.set(id, t);
      }
    });

    const templateIds = Array.from(templateMap.keys());

    // Carica traduzioni per questi template nella lingua specificata
    const translations = await db.collection('Translations').find({
      guid: { $in: templateIds },
      language: language
    }).toArray();

    // Costruisci oggetto: { templateId: translatedLabel }
    const result = {};
    translations.forEach(t => {
      if (t.guid && t.text) {
        result[t.guid] = t.text;
      }
    });

    console.log(`[API] Template label translations: ${Object.keys(result).length} traduzioni per lingua ${language}`);
    res.json(result);

  } catch (err) {
    console.error('[API] Errore caricamento traduzioni label:', err);
    res.status(500).json({ error: err.message });
  // ✅ NON chiudere la connessione se usi il pool
  }
});

// ✅ Pre-inizializza il MongoDB connection pool all'avvio del server
async function initializeMongoPool() {
  try {
    console.log('[MongoDB] Pre-initializing connection pool...');
    logInfo('MongoDB.Startup', { message: 'Pre-initializing connection pool...' });
    await getMongoClient();
    console.log('[MongoDB] ✅ Connection pool pre-initialized successfully');
    logInfo('MongoDB.Startup', { message: 'Connection pool pre-initialized successfully' });

    // Create indexes after pool is initialized
    console.log('[MongoDB] Ensuring catalog indexes...');
    await ensureCatalogIndexes();
    console.log('[MongoDB] ✅ Catalog indexes ensured');
  } catch (error) {
    console.error('[MongoDB] ❌ Failed to pre-initialize pool:', error);
    logError('MongoDB.Startup', error, { message: 'Failed to pre-initialize pool (will retry on first request)' });
    // Non bloccare l'avvio del server, il pool verrà inizializzato alla prima richiesta
    throw error; // Rilancia l'errore per far partire il server comunque
  }
}

// Inizializza il pool prima di avviare il server
console.log('[Server] Starting initialization...');
initializeMongoPool().then(() => {
  console.log('[Server] MongoDB pool initialized, starting Express server...');
  app.listen(3100, () => {
    console.log('[Server] ✅ Express server ready on port 3100');
    logInfo('Express', { message: 'Server ready on port 3100' });
  });
}).catch((error) => {
  console.error('[Server] ❌ Error during initialization:', error);
  logError('Express', error, { message: 'Failed to start server' });
  // Avvia comunque il server, il pool verrà inizializzato alla prima richiesta
  console.log('[Server] Starting Express server anyway (MongoDB will initialize on first request)...');
  app.listen(3100, () => {
    console.log('[Server] ✅ Express server ready on port 3100 (MongoDB pool will initialize on first request)');
    logInfo('Express', { message: 'Server ready on port 3100 (MongoDB pool will initialize on first request)' });
  });
});

