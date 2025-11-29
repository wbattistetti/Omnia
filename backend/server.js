

const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');

// ✅ ENTERPRISE AI SERVICES
const AIProviderService = require('./services/AIProviderService');
const TemplateIntelligenceService = require('./services/TemplateIntelligenceService');

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
    return mongoClientPool;
  }

  if (mongoClientPoolPromise) {
    return mongoClientPoolPromise;
  }

  mongoClientPoolPromise = (async () => {
    const client = new MongoClient(uri, {
      maxPoolSize: 10, // Maximum number of connections in the pool
      minPoolSize: 2,  // Minimum number of connections in the pool
      maxIdleTimeMS: 30000, // Close connections after 30s of inactivity
      serverSelectionTimeoutMS: 5000, // Timeout for server selection
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
    console.log('[TASK_HEURISTICS_CACHE] Caricando pattern da Task_Types...');
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbFactory);
    // Pattern sono ora in Task_Types, non più in task_heuristics
    const collection = db.collection('Task_Types');

    const taskTypes = await collection.find({ patterns: { $exists: true, $ne: null } }).toArray();
    await client.close();

    // Mapping da Task_Types._id a HeuristicType (per compatibilità con frontend)
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

      // I pattern in Task_Types sono strutturati come: { IT: [...], EN: [...], PT: [...] }
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
        Object.keys(taskType.patterns).forEach(lang => {
          const langUpper = lang.toUpperCase();
          const patterns = taskType.patterns[lang];

          if (Array.isArray(patterns) && patterns.length > 0) {
            // Se ci sono pattern specifici per PROBLEM, usali
            // Altrimenti usa PROBLEM_SPEC_DIRECT come default
            if (!rulesByLang[langUpper].PROBLEM_SPEC_DIRECT || rulesByLang[langUpper].PROBLEM_SPEC_DIRECT.length === 0) {
              rulesByLang[langUpper].PROBLEM_SPEC_DIRECT = [...patterns];
            }
          }
        });
      }
    });

    taskHeuristicsCache = rulesByLang;
    taskHeuristicsCacheLoaded = true;
    console.log(`[TASK_HEURISTICS_CACHE] Caricati pattern da Task_Types per lingue: ${Object.keys(rulesByLang).join(', ')}`);
    return taskHeuristicsCache;

  } catch (error) {
    console.error('[TASK_HEURISTICS_CACHE] Errore nel caricamento:', error);
    return {};
  }
}

async function loadTemplatesFromDB() {
  if (cacheLoaded) {
    return templateCache;
  }

  try {
    console.log('[TEMPLATE_CACHE] Caricando template dal database Factory...');
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('factory');
    const collection = db.collection('Task_Types');

    const templates = await collection.find({}).toArray();
    await client.close();

    // Converti in oggetto per accesso rapido
    templateCache = {};
    templates.forEach(template => {
      if (template._id) {
        delete template._id;
      }
      templateCache[template.name] = template;
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
async function resolveTemplateRefs(subData, templates, level = 0) {
  const resolved = [];

  // Limite di sicurezza per evitare ricorsioni infinite
  if (level > 10) {
    console.warn(`[TEMPLATE_RESOLUTION] Livello massimo raggiunto (${level}), interrompendo ricorsione`);
    return resolved;
  }

  for (const item of subData) {
    if (item.templateRef && templates[item.templateRef]) {
      // Espandi il template referenziato
      const referencedTemplate = templates[item.templateRef];

      if (referencedTemplate.subData && referencedTemplate.subData.length > 0) {
        // Se il template referenziato ha subData, espandili ricorsivamente
        const expandedSubData = await resolveTemplateRefs(referencedTemplate.subData, templates, level + 1);
        resolved.push(...expandedSubData);
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
async function resolveTemplateRefsWithLevels(subData, templates) {
  return await resolveTemplateRefs(subData, templates, 0);
}

// Template cache verrà precaricata da preloadAllServerCaches()

// ✅ ENTERPRISE AI SERVICES INITIALIZATION
const aiProviderService = new AIProviderService();
const templateIntelligenceService = new TemplateIntelligenceService(aiProviderService);

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
  const client = await getMongoClient();
  try {
    const db = client.db(dbProjects);
    const queryStart = Date.now();
    // ✅ OPTIMIZATION: Sort by updatedAt (index should exist, but don't force hint if it doesn't)
    const list = await db.collection('projects_catalog')
      .find({})
      .sort({ updatedAt: -1 })
      .toArray();
    const queryDuration = Date.now() - queryStart;
    const duration = Date.now() - startTime;
    logInfo('Catalog.list', { count: Array.isArray(list) ? list.length : 0, duration: `${duration}ms`, queryDuration: `${queryDuration}ms` });
    res.json(list);
  } catch (e) {
    const duration = Date.now() - startTime;
    logError('Catalog.list', e, { duration: `${duration}ms` });
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Endpoint: Get unique clients from catalog
app.get('/api/projects/catalog/clients', async (req, res) => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbProjects);
    const projects = await db.collection('projects_catalog').find({}).toArray();

    // Estrai tutti i clientName validi (escludendo null/vuoti)
    const clients = new Set();
    projects.forEach((p) => {
      const clientName = (p.clientName || '').trim();
      if (clientName) {
        clients.add(clientName);
      }
    });

    // Converti in array e ordina alfabeticamente
    const uniqueClients = Array.from(clients).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    logInfo('Catalog.clients', { count: uniqueClients.length });
    res.json(uniqueClients);
  } catch (e) {
    logError('Catalog.clients', e);
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    await client.close();
  }
});

// Endpoint: Get unique project names from catalog
app.get('/api/projects/catalog/project-names', async (req, res) => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbProjects);
    const projects = await db.collection('projects_catalog').find({}).toArray();

    // Estrai tutti i projectName validi
    const projectNames = new Set();
    projects.forEach((p) => {
      const projectName = (p.projectName || p.name || '').trim();
      if (projectName) {
        projectNames.add(projectName);
      }
    });

    // Converti in array e ordina alfabeticamente
    const uniqueProjectNames = Array.from(projectNames).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    logInfo('Catalog.projectNames', { count: uniqueProjectNames.length });
    res.json(uniqueProjectNames);
  } catch (e) {
    logError('Catalog.projectNames', e);
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    await client.close();
  }
});

app.post('/api/projects/catalog', async (req, res) => {
  const payload = req.body || {};
  const clientName = payload.clientName || null; // Permette null/vuoto
  const projectName = payload.projectName;
  if (!projectName) {
    return res.status(400).json({ error: 'projectName_required' });
  }
  const client = new MongoClient(uri);
  try {
    await client.connect();
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
  } finally {
    await client.close();
  }
});

// DELETE catalog by id
app.delete('/api/projects/catalog/:id', async (req, res) => {
  const id = req.params.id;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbProjects);
    const coll = db.collection('projects_catalog');
    const result = await coll.deleteOne({ $or: [{ _id: id }, { projectId: id }] });
    res.json({ ok: true, deleted: result?.deletedCount || 0 });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    await client.close();
  }
});

// DELETE all catalog
app.delete('/api/projects/catalog', async (req, res) => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbProjects);
    const coll = db.collection('projects_catalog');
    const result = await coll.deleteMany({});
    res.json({ ok: true, deleted: result?.deletedCount || 0 });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    await client.close();
  }
});

// -----------------------------
// Factory: list AgentActs (for draft/new projects intellisense)
// -----------------------------
app.get('/api/factory/agent-acts', async (req, res) => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbFactory);
    const coll = db.collection('AgentActs');
    const items = await coll.find({}, { projection: { _id: 0, id: 1, name: 1, label: 1, mode: 1, ddt: 1, ddtSnapshot: 1, userActs: 1, category: 1 } }).toArray();
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    await client.close();
  }
});

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

  const client = new MongoClient(uri);
  try {
    await client.connect();

    // 1) Catalogo: crea record se non esiste
    const catalogDb = client.db(dbProjects);
    const cat = catalogDb.collection('projects_catalog');
    const now = new Date();
    const projectId = payload.projectId || makeProjectId();
    const dbName = payload.dbName || makeProjectDbName(clientName, projectName);

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
    } catch (e) {
      // if already exists, update metadata (idempotent)
      await cat.updateOne({ _id: projectId }, { $set: { ...catalogDoc, createdAt: undefined, updatedAt: now } }, { upsert: true });
    }

    // 2) Project DB handle
    const projDb = client.db(dbName);

    // 3) Scrivi metadati locali
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

    // 4) Clona Task_Templates dalla factory al progetto
    const factoryDb = client.db(dbFactory);
    const templatesColl = factoryDb.collection('Task_Templates');

    // Scope filtering: global + industry-specific
    let templatesQuery = {};
    if (industry) {
      templatesQuery = { $or: [{ scope: 'global' }, { scope: 'industry', industry }] };
    } else {
      templatesQuery = { scope: 'global' };
    }

    let templates = await templatesColl.find(templatesQuery).toArray();
    // Fallback: se il filtro non produce risultati, copia tutti i template globali
    if (!templates || templates.length === 0) {
      templates = await templatesColl.find({ scope: 'global' }).toArray();
    }

    let templatesInserted = 0;
    if (templates && templates.length > 0) {
      // Copy templates from Factory to Project DB
      // Each template must have an 'id' field (used as _id in Project DB)
      const mappedTemplates = templates
        .filter(t => t.id || t._id) // Only copy templates with valid ID
        .map(t => {
          const doc = { ...t };
          const templateId = doc.id || doc._id; // Use id field or _id as fallback
          delete doc._id; // Remove MongoDB _id, will use id as _id
          doc._id = templateId; // Set _id to template id
          if (!doc.id) {
            doc.id = templateId; // Ensure id field exists
          }
          doc.createdAt = now;
          doc.updatedAt = now;
          return doc;
        });

      if (mappedTemplates.length > 0) {
        try {
          const result = await projDb.collection('Task_Templates').insertMany(mappedTemplates, { ordered: false });
          templatesInserted = result.insertedCount || Object.keys(result.insertedIds || {}).length || 0;
        } catch (insertError) {
          console.error('[Bootstrap] Error inserting task_templates:', insertError);
          // Continue even if insert fails (collection might already exist or have duplicates)
          templatesInserted = 0;
        }
      }
    }

    // 5) Clona task_heuristics dalla factory al progetto
    const heuristicsColl = factoryDb.collection('task_heuristics');
    const heuristics = await heuristicsColl.find({}).toArray();

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
        const result = await projDb.collection('task_heuristics').insertMany(mappedHeuristics, { ordered: false });
        heuristicsInserted = result.insertedCount || Object.keys(result.insertedIds || {}).length || 0;
      } catch (insertError) {
        console.error('[Bootstrap] Error inserting task_heuristics:', insertError);
        // Continue even if insert fails (collection might already exist)
        heuristicsInserted = 0;
      }
    }

    // 6) Collezioni vuote necessarie e indici per performance
    await projDb.collection('tasks').createIndex({ updatedAt: -1 }).catch(() => { });
    await projDb.collection('flow_nodes').createIndex({ updatedAt: -1 }).catch(() => { });
    await projDb.collection('flow_edges').createIndex({ updatedAt: -1 }).catch(() => { });

    // Indici per Translations collection (ottimizzazione caricamento)
    const translationsColl = projDb.collection('Translations');
    await translationsColl.createIndex({ language: 1, type: 1 }).catch(() => { });
    await translationsColl.createIndex({ guid: 1, language: 1 }).catch(() => { });

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
        task_templates: templatesInserted,
        task_heuristics: heuristicsInserted
      }
    });
  } catch (e) {
    logError('Projects.bootstrap', e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  } finally {
    await client.close();
  }
});

// -----------------------------
// Endpoints: Task Templates per progetto
// -----------------------------
// GET /api/projects/:pid/task-templates - Load project templates
app.get('/api/projects/:pid/task-templates', async (req, res) => {
  const projectId = req.params.pid;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const projDb = await getProjectDb(client, projectId);
    const coll = projDb.collection('Task_Templates');
    const templates = await coll.find({}).toArray();
    logInfo('TaskTemplates.get', { projectId, count: templates.length });
    res.json({ items: templates });
  } catch (e) {
    logError('TaskTemplates.get', e, { projectId });
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    await client.close();
  }
});

// POST /api/projects/:pid/task-templates - Create/update template in project
app.post('/api/projects/:pid/task-templates', async (req, res) => {
  const projectId = req.params.pid;
  const payload = req.body || {};
  if (!payload.id || !payload.label || !payload.valueSchema) {
    return res.status(400).json({ error: 'id, label, and valueSchema are required' });
  }
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const projDb = await getProjectDb(client, projectId);
    const coll = projDb.collection('Task_Templates');
    const now = new Date();
    const doc = {
      _id: payload.id,
      id: payload.id,
      label: payload.label,
      description: payload.description || '',
      icon: payload.icon || 'Circle',
      color: payload.color || 'text-gray-500',
      signature: payload.signature || undefined,
      valueSchema: payload.valueSchema,
      scope: payload.scope || 'client',
      industry: payload.industry || undefined,
      updatedAt: now
    };
    await coll.updateOne(
      { _id: doc._id },
      { $set: doc, $setOnInsert: { createdAt: now } },
      { upsert: true }
    );
    const saved = await coll.findOne({ _id: doc._id });
    logInfo('TaskTemplates.post', { projectId, id: doc._id });
    res.json(saved);
  } catch (e) {
    logError('TaskTemplates.post', e, { projectId, id: payload?.id });
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    await client.close();
  }
});

// -----------------------------
// Endpoints: Task Heuristics per progetto
// -----------------------------
// GET /api/projects/:pid/task-heuristics - Load project heuristics
// Ora carica da Task_Types del progetto (o factory come fallback)
app.get('/api/projects/:pid/task-heuristics', async (req, res) => {
  const projectId = req.params.pid;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const projDb = await getProjectDb(client, projectId);
    // Pattern sono ora in Task_Types, non più in task_heuristics
    const coll = projDb.collection('Task_Types');
    const taskTypes = await coll.find({ patterns: { $exists: true, $ne: null } }).toArray();

    // Se il progetto non ha Task_Types con pattern, usa quelli di factory
    if (taskTypes.length === 0) {
      console.log(`[TaskHeuristics] Project ${projectId} has no Task_Types with patterns, using factory patterns`);
      const factoryPatterns = await loadTaskHeuristicsFromDB();
      logInfo('TaskHeuristics.get', { projectId, source: 'factory', languages: Object.keys(factoryPatterns) });
      return res.json(factoryPatterns);
    }

    // Mapping da Task_Types._id a HeuristicType (per compatibilità con frontend)
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

      // I pattern in Task_Types sono strutturati come: { IT: [...], EN: [...], PT: [...] }
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
  } finally {
    await client.close();
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

    logInfo('Flow.put', {
      projectId: pid,
      flowId,
      payload: { nodes: nodes.length, edges: edges.length },
      result: { upserts: { nodes: nUpserts, edges: eUpserts }, deletes: { nodes: nDeletes, edges: eDeletes } }
    });
    res.json({ ok: true, nodes: nodes.length, edges: edges.length });
  }).catch((e) => {
    logError('Flow.put', e, { projectId: pid, flowId, payloadNodes: nodes.length, payloadEdges: edges.length });
    res.status(500).json({ error: String(e?.message || e) });
  });
});

// List flows (by distinct flowId in flow_nodes)
app.get('/api/projects/:pid/flows', async (req, res) => {
  const pid = req.params.pid;
  const client = new MongoClient(uri);
  try {
    await client.connect();
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
  } finally {
    await client.close();
  }
});

// -----------------------------
// Endpoint: Lista atti del progetto
// -----------------------------
app.get('/api/projects/:pid/acts', async (req, res) => {
  const projectId = req.params.pid;
  const { limit, q } = req.query || {};
  const startTime = Date.now();
  const client = await getMongoClient();
  try {
    const projDb = await getProjectDb(client, projectId);
    const coll = projDb.collection('project_acts');
    const filter = q ? { name: { $regex: String(q), $options: 'i' } } : {};
    const cursor = coll.find(filter).sort({ name: 1 });
    const queryStart = Date.now();
    const docs = await (limit ? cursor.limit(parseInt(String(limit), 10) || 50) : cursor).toArray();
    // Optimization: Only count if limit is applied and we need total count
    // Otherwise, docs.length is sufficient
    const count = limit ? await coll.countDocuments(filter) : docs.length;
    const queryDuration = Date.now() - queryStart;
    const duration = Date.now() - startTime;
    logInfo('Acts.get', { projectId, count, itemsReturned: docs.length, duration: `${duration}ms`, queryDuration: `${queryDuration}ms`, hasLimit: !!limit, hasQuery: !!q });
    res.json({ count, items: docs });
  } catch (e) {
    const duration = Date.now() - startTime;
    logError('Acts.get', e, { projectId, duration: `${duration}ms` });
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// -----------------------------
// Endpoints: Project Acts (create/upsert; list esiste già)
// Persistiamo gli Agent Acts creati al volo solo su Save esplicito
// -----------------------------
app.post('/api/projects/:pid/acts', async (req, res) => {
  const pid = req.params.pid;
  const payload = req.body || {};
  if (!payload || !payload._id || !payload.name) {
    return res.status(400).json({ error: 'id_and_name_required' });
  }
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = await getProjectDb(client, pid);
    const coll = db.collection('project_acts');
    const now = new Date();
    const doc = {
      _id: payload._id,
      name: payload.name,
      label: payload.label || payload.name,
      description: payload.description || '',
      type: payload.type || null,
      mode: payload.mode || null,
      category: payload.category || null,
      scope: payload.scope || 'industry',
      industry: payload.industry || null,
      ddtSnapshot: payload.ddtSnapshot || null,
      // Persist ProblemClassification payload when provided
      problem: payload.problem || null,
      updatedAt: now,
      createdAt: now
    };
    // Evita conflitto su 'createdAt' tra $set e $setOnInsert
    const setDoc = { ...doc };
    delete setDoc.createdAt;
    setDoc.updatedAt = now;
    await coll.updateOne(
      { _id: doc._id },
      { $set: setDoc, $setOnInsert: { createdAt: now } },
      { upsert: true }
    );
    const saved = await coll.findOne({ _id: doc._id });
    logInfo('Acts.post', { projectId: pid, id: doc._id, name: doc.name, type: doc.type, mode: doc.mode });
    res.json(saved);
  } catch (e) {
    logError('Acts.post', e, { projectId: pid, id: payload?._id });
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    await client.close();
  }
});

// -----------------------------
// Endpoint: Project Acts bulk upsert
// -----------------------------
app.post('/api/projects/:pid/acts/bulk', async (req, res) => {
  const pid = req.params.pid;
  const payload = req.body || {};
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) {
    return res.json({ ok: true, upsertedCount: 0, modifiedCount: 0, matchedCount: 0 });
  }
  await withMongoClient(async (client) => {
    const db = await getProjectDb(client, pid);
    const coll = db.collection('project_acts');
    const now = new Date();
    const ops = items.map((it) => {
      const doc = {
        _id: it._id,
        name: it.name,
        label: it.label || it.name,
        description: it.description || '',
        type: it.type || null,
        mode: it.mode || null,
        category: it.category || null,
        scope: it.scope || 'industry',
        industry: it.industry || null,
        ddtSnapshot: it.ddtSnapshot || null,
        // Persist ProblemClassification payload when provided
        problem: it.problem || null,
        updatedAt: now,
        createdAt: now
      };
      const setDoc = { ...doc };
      delete setDoc.createdAt;
      setDoc.updatedAt = now;
      return {
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: setDoc, $setOnInsert: { createdAt: now } },
          upsert: true
        }
      };
    });
    let result;
    try {
      result = await coll.bulkWrite(ops, { ordered: false });
    } catch (e) {
      logError('Acts.post.bulk.exec', e, { projectId: pid, count: items.length });
      return res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
    logInfo('Acts.post.bulk', { projectId: pid, count: items.length, matched: result.matchedCount, modified: result.modifiedCount, upserted: result.upsertedCount });
    res.json({ ok: true, matchedCount: result.matchedCount, modifiedCount: result.modifiedCount, upsertedCount: result.upsertedCount });
  }).catch((e) => {
    logError('Acts.post.bulk', e, { projectId: pid, count: items.length });
    res.status(500).json({ error: String(e?.message || e) });
  });
});

// -----------------------------
// Endpoint: Project Conditions (create/upsert)
// -----------------------------
app.post('/api/projects/:pid/conditions', async (req, res) => {
  const pid = req.params.pid;
  const payload = req.body || {};
  if (!payload || !payload._id || !payload.name) {
    return res.status(400).json({ error: 'id_and_name_required' });
  }
  const client = new MongoClient(uri);
  try {
    await client.connect();
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
  } finally {
    await client.close();
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

// -----------------------------
// Endpoints: Act Instances (create/update/get)
// -----------------------------
app.post('/api/projects/:pid/instances', async (req, res) => {
  const projectId = req.params.pid;
  const payload = req.body || {};
  if (!payload.baseActId || !payload.mode) {
    return res.status(400).json({ error: 'baseActId_and_mode_required' });
  }
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const projDb = await getProjectDb(client, projectId);
    const now = new Date();

    // derive base ddt version/hash from project_acts when available
    let base = null;
    try { base = await projDb.collection('project_acts').findOne({ _id: payload.baseActId }); } catch { }
    const instance = {
      projectId,
      baseActId: payload.baseActId,
      ddtRefId: payload.baseActId,
      mode: payload.mode,
      message: payload.message || null,
      overrides: payload.overrides || null,
      baseVersion: base?.updatedAt || null,
      baseHash: null,
      ddtSnapshot: payload.ddtSnapshot || null, // Supporto per ddtSnapshot nel POST
      rowId: payload.rowId || null, // ID originale della riga (instance.instanceId)
      createdAt: now,
      updatedAt: now
    };
    const r = await projDb.collection('act_instances').insertOne(instance);
    const saved = await projDb.collection('act_instances').findOne({ _id: r.insertedId });
    logInfo('Instances.post', { projectId, baseActId: payload.baseActId, mode: payload.mode, instanceId: String(r?.insertedId || '') });
    res.json(saved);
  } catch (e) {
    logError('Instances.post', e, { projectId, baseActId: payload?.baseActId });
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    await client.close();
  }
});

// Bulk create instances
app.post('/api/projects/:pid/instances/bulk', async (req, res) => {
  const projectId = req.params.pid;
  const payload = req.body || {};
  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (!items.length) return res.json({ ok: true, inserted: 0 });
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const projDb = await getProjectDb(client, projectId);
    const now = new Date();
    const docs = [];
    for (const it of items) {
      if (!it?.baseActId || !it?.mode) continue;
      let base = null;
      try { base = await projDb.collection('project_acts').findOne({ _id: it.baseActId }); } catch { }
      docs.push({
        projectId,
        baseActId: it.baseActId,
        ddtRefId: it.baseActId,
        mode: it.mode,
        message: it.message || null,
        overrides: it.overrides || null,
        baseVersion: base?.updatedAt || null,
        baseHash: null,
        ddtSnapshot: null,
        createdAt: now,
        updatedAt: now
      });
    }
    const result = docs.length ? await projDb.collection('act_instances').insertMany(docs, { ordered: false }) : { insertedCount: 0 };
    logInfo('Instances.post.bulk', { projectId, count: docs.length });
    res.json({ ok: true, inserted: result?.insertedCount || docs.length });
  } catch (e) {
    logError('Instances.post.bulk', e, { projectId, count: items.length });
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    await client.close();
  }
});

app.put('/api/projects/:pid/instances/:iid', async (req, res) => {
  const projectId = req.params.pid;
  const iid = req.params.iid;
  const payload = req.body || {};
  const client = new MongoClient(uri);
  try {
    console.log('[Backend][INSTANCE_UPDATE][START]', {
      projectId,
      instanceId: iid,
      payload: {
        hasMessage: !!payload.message,
        messageText: payload.message?.text?.substring(0, 50) || 'N/A',
        mode: payload.mode,
        baseActId: payload.baseActId,
        hasOverrides: !!payload.overrides,
        hasDdtSnapshot: !!payload.ddtSnapshot
      }
    });

    await client.connect();
    const projDb = await getProjectDb(client, projectId);

    // Cerca prima per _id, poi per rowId se non trovato (per supportare ID righe)
    let existing = await projDb.collection('act_instances').findOne({ _id: iid });
    if (!existing) {
      // Prova a cercare per rowId (ID originale della riga)
      existing = await projDb.collection('act_instances').findOne({ rowId: iid });
    }

    console.log('[Backend][INSTANCE_UPDATE][FIND]', {
      instanceId: iid,
      foundById: !!await projDb.collection('act_instances').findOne({ _id: iid }),
      foundByRowId: !!await projDb.collection('act_instances').findOne({ rowId: iid }),
      existing: existing ? {
        _id: existing._id,
        rowId: existing.rowId,
        mode: existing.mode,
        baseActId: existing.baseActId,
        hasMessage: !!existing.message,
        messageText: existing.message?.text?.substring(0, 50) || 'N/A'
      } : null
    });

    const update = { updatedAt: new Date() };
    if (payload.message !== undefined) update['message'] = payload.message;
    if (payload.overrides !== undefined) update['overrides'] = payload.overrides;
    if (payload.ddtSnapshot !== undefined) {
      // ✅ Log dettagliato del ddtSnapshot che viene salvato
      const ddtSnapshot = payload.ddtSnapshot;
      const firstMain = ddtSnapshot?.mainData?.[0];
      const steps = firstMain?.steps || {};
      const stepsKeys = Object.keys(steps);

      console.log('[Backend][INSTANCE_UPDATE][DDT_SNAPSHOT]', {
        instanceId: iid,
        ddtId: ddtSnapshot?.id,
        firstMainKind: firstMain?.kind,
        stepsKeys,
        stepsKeysCount: stepsKeys.length,
        stepsContent: steps,
        hasStart: !!steps.start,
        hasNoInput: !!steps.noInput,
        hasNoMatch: !!steps.noMatch,
        hasConfirmation: !!steps.confirmation
      });

      update['ddtSnapshot'] = payload.ddtSnapshot;
    }
    // ✅ FIX: Aggiorna anche mode e baseActId quando vengono passati nel payload
    if (payload.mode !== undefined) update['mode'] = payload.mode;
    if (payload.baseActId !== undefined) update['baseActId'] = payload.baseActId;
    // ✅ FIX: Salva anche problemIntents (frasi generate nell'IntentEditor)
    if (payload.problemIntents !== undefined) update['problemIntents'] = payload.problemIntents;

    console.log('[Backend][INSTANCE_UPDATE][UPDATE_OBJECT]', {
      instanceId: iid,
      updateFields: Object.keys(update),
      mode: update.mode,
      baseActId: update.baseActId,
      hasProblemIntents: !!update.problemIntents,
      problemIntentsCount: update.problemIntents?.length || 0,
      messageInUpdate: update.message ? {
        text: update.message.text?.substring(0, 50) || 'N/A',
        full: JSON.stringify(update.message)
      } : null
    });

    // optional: fork = true → copy current project_acts.ddtSnapshot into instance.ddtSnapshot
    if (payload.fork === true) {
      // Usa existing già trovato sopra, o cerca di nuovo se necessario
      if (!existing) {
        existing = await projDb.collection('act_instances').findOne({ _id: iid }) ||
          await projDb.collection('act_instances').findOne({ rowId: iid });
      }
      const baseId = payload.baseActId || existing?.baseActId;
      if (baseId) {
        const base = await projDb.collection('project_acts').findOne({ _id: baseId });
        if (base && base.ddtSnapshot) {
          update['ddtSnapshot'] = base.ddtSnapshot;
          update['baseVersion'] = base.updatedAt || new Date();
        }
      }
    }

    // Usa _id trovato o rowId per aggiornare
    const filter = existing ? { _id: existing._id } : { rowId: iid };
    console.log('[Backend][INSTANCE_UPDATE][FILTER]', {
      instanceId: iid,
      filter,
      willCreate: !existing
    });

    const updateResult = await projDb.collection('act_instances').updateOne(filter, { $set: update });

    console.log('[Backend][INSTANCE_UPDATE][UPDATE_RESULT]', {
      instanceId: iid,
      matchedCount: updateResult.matchedCount,
      modifiedCount: updateResult.modifiedCount,
      willCreate: updateResult.matchedCount === 0 && iid && !existing
    });

    // Se non esiste e abbiamo rowId, crea nuova istanza
    if (updateResult.matchedCount === 0 && iid && !existing) {
      // Crea nuova istanza con rowId
      const newInstance = {
        projectId,
        baseActId: payload.baseActId || 'Unknown',
        ddtRefId: payload.baseActId || 'Unknown',
        mode: payload.mode || 'DataRequest',
        message: payload.message || null,
        overrides: payload.overrides || null,
        ddtSnapshot: payload.ddtSnapshot || null,
        problemIntents: payload.problemIntents || null, // ✅ Salva anche problemIntents quando si crea una nuova istanza
        rowId: iid,
        baseVersion: null,
        baseHash: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      console.log('[Backend][INSTANCE_UPDATE][CREATE_NEW]', {
        instanceId: iid,
        newInstance: {
          rowId: newInstance.rowId,
          mode: newInstance.mode,
          baseActId: newInstance.baseActId,
          hasMessage: !!newInstance.message,
          messageText: newInstance.message?.text?.substring(0, 50) || 'N/A'
        }
      });

      await projDb.collection('act_instances').insertOne(newInstance);
      existing = newInstance;
    }

    const saved = await projDb.collection('act_instances').findOne(existing ? { _id: existing._id } : { rowId: iid });

    // ✅ Log dettagliato del ddtSnapshot salvato nel database
    if (saved?.ddtSnapshot) {
      const savedDDT = saved.ddtSnapshot;
      const savedFirstMain = savedDDT?.mainData?.[0];
      const savedSteps = savedFirstMain?.steps || {};
      const savedStepsKeys = Object.keys(savedSteps);

      console.log('[Backend][INSTANCE_UPDATE][SAVED_DDT]', {
        instanceId: iid,
        ddtId: savedDDT?.id,
        firstMainKind: savedFirstMain?.kind,
        savedStepsKeys,
        savedStepsKeysCount: savedStepsKeys.length,
        savedStepsContent: savedSteps,
        hasStart: !!savedSteps.start,
        hasNoInput: !!savedSteps.noInput,
        hasNoMatch: !!savedSteps.noMatch,
        hasConfirmation: !!savedSteps.confirmation
      });
    }

    console.log('[Backend][INSTANCE_UPDATE][SAVED]', {
      instanceId: iid,
      saved: saved ? {
        _id: saved._id,
        rowId: saved.rowId,
        mode: saved.mode,
        baseActId: saved.baseActId,
        hasMessage: !!saved.message,
        messageText: saved.message?.text?.substring(0, 50) || 'N/A',
        messageFull: saved.message ? JSON.stringify(saved.message) : 'null'
      } : null
    });

    res.json(saved);
  } catch (e) {
    console.error('[Backend][INSTANCE_UPDATE][ERROR]', {
      projectId,
      instanceId: iid,
      error: String(e),
      stack: e?.stack?.substring(0, 300)
    });
    logError('Instances.put', e, { projectId, instanceId: iid });
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    await client.close();
  }
});

app.get('/api/projects/:pid/instances', async (req, res) => {
  const projectId = req.params.pid;
  const ids = String(req.query.ids || '').split(',').map(s => s.trim()).filter(Boolean);
  const client = new MongoClient(uri);
  try {
    console.log('[Backend][INSTANCE_GET][START]', { projectId, requestedIds: ids.length > 0 ? ids : 'all' });
    await client.connect();
    const projDb = await getProjectDb(client, projectId);
    const coll = projDb.collection('act_instances');
    const filter = ids.length ? { _id: { $in: ids } } : {};
    const items = await coll.find(filter).sort({ updatedAt: -1 }).toArray();

    console.log('[Backend][INSTANCE_GET][FOUND]', {
      projectId,
      count: items.length,
      instances: items.map(inst => ({
        _id: inst._id,
        rowId: inst.rowId,
        instanceId: inst.instanceId,
        mode: inst.mode,
        baseActId: inst.baseActId,
        hasMessage: !!inst.message,
        messageText: inst.message?.text?.substring(0, 50) || 'N/A',
        messageFull: inst.message ? JSON.stringify(inst.message) : 'null'
      }))
    });

    res.json({ count: items.length, items });
  } catch (e) {
    console.error('[Backend][INSTANCE_GET][ERROR]', {
      projectId,
      error: String(e),
      stack: e?.stack?.substring(0, 300)
    });
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    await client.close();
  }
});

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

// POST /api/projects/:pid/tasks - Create or update task (upsert)
app.post('/api/projects/:pid/tasks', async (req, res) => {
  const projectId = req.params.pid;
  const payload = req.body || {};
  if (!payload.id || !payload.action) {
    return res.status(400).json({ error: 'id_and_action_required' });
  }
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const projDb = await getProjectDb(client, projectId);
    const now = new Date();
    const task = {
      projectId,
      id: payload.id,
      action: payload.action,
      value: payload.value || {},
      updatedAt: now
    };

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
      action: payload.action,
      upserted: result.upsertedCount > 0,
      modified: result.modifiedCount > 0
    });
    res.json(saved);
  } catch (e) {
    logError('Tasks.post', e, { projectId, taskId: payload?.id });
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    await client.close();
  }
});

// PUT /api/projects/:pid/tasks/:taskId - Update task
app.put('/api/projects/:pid/tasks/:taskId', async (req, res) => {
  const projectId = req.params.pid;
  const taskId = req.params.taskId;
  const payload = req.body || {};
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const projDb = await getProjectDb(client, projectId);

    // Find by id field (not _id)
    const existing = await projDb.collection('tasks').findOne({ projectId, id: taskId });
    if (!existing) {
      return res.status(404).json({ error: 'task_not_found' });
    }

    const update = { updatedAt: new Date() };
    if (payload.action !== undefined) update.action = payload.action;
    if (payload.value !== undefined) update.value = payload.value;

    await projDb.collection('tasks').updateOne(
      { projectId, id: taskId },
      { $set: update }
    );

    const updated = await projDb.collection('tasks').findOne({ projectId, id: taskId });
    logInfo('Tasks.put', { projectId, taskId, updatedFields: Object.keys(update) });
    res.json(updated);
  } catch (e) {
    logError('Tasks.put', e, { projectId, taskId });
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    await client.close();
  }
});

// DELETE /api/projects/:pid/tasks/:taskId - Delete task
app.delete('/api/projects/:pid/tasks/:taskId', async (req, res) => {
  const projectId = req.params.pid;
  const taskId = req.params.taskId;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const projDb = await getProjectDb(client, projectId);
    const result = await projDb.collection('tasks').deleteOne({ projectId, id: taskId });
    logInfo('Tasks.delete', { projectId, taskId, deleted: result.deletedCount > 0 });
    res.json({ deleted: result.deletedCount > 0 });
  } catch (e) {
    logError('Tasks.delete', e, { projectId, taskId });
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    await client.close();
  }
});

// POST /api/projects/:pid/tasks/bulk - Bulk save tasks
app.post('/api/projects/:pid/tasks/bulk', async (req, res) => {
  const projectId = req.params.pid;
  const payload = req.body || {};
  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (!items.length) return res.json({ ok: true, inserted: 0, updated: 0 });

  const tStart = Date.now();
  await withMongoClient(async (client) => {
    const projDb = await getProjectDb(client, projectId);
    const coll = projDb.collection('tasks');
    const now = new Date();

    // ✅ OPTIMIZATION: Use bulkWrite instead of sequential findOne + updateOne/insertOne
    // This reduces 2*N database calls to just 1 bulk operation!
    const bulkOps = items
      .filter(item => item.id && item.action)
      .map(item => {
        const task = {
          projectId,
          id: item.id,
          action: item.action,
          value: item.value || {},
          updatedAt: now
        };

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
      });

    let inserted = 0;
    let updated = 0;

    if (bulkOps.length > 0) {
      const tBulk = Date.now();
      const result = await coll.bulkWrite(bulkOps, { ordered: false });
      const tBulkEnd = Date.now();
      console.log(`[Tasks.bulk][PERF] bulkWrite: ${tBulkEnd - tBulk}ms (${bulkOps.length} ops)`);
      inserted = result.upsertedCount;
      updated = result.modifiedCount;
    }

    const tEnd = Date.now();
    console.log(`[Tasks.bulk][PERF] Total: ${tEnd - tStart}ms`);
    logInfo('Tasks.bulk', { projectId, inserted, updated, total: items.length });
    res.json({ ok: true, inserted, updated });
  }).catch((e) => {
    const tEnd = Date.now();
    console.error(`[Tasks.bulk][PERF] ERROR after ${tEnd - tStart}ms`);
    logError('Tasks.bulk', e, { projectId, itemsCount: items.length });
    res.status(500).json({ error: String(e?.message || e) });
  });
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
  const client = new MongoClient(uri);
  try {
    await client.connect();
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
  } finally {
    await client.close();
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
// Agent Acts (embedded DDT 1:1)
app.get('/api/factory/agent-acts', async (req, res) => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbFactory);
    const coll = db.collection('AgentActs');
    let acts = await coll.find({}).toArray();
    // Auto-seed on first call if empty
    if (!Array.isArray(acts) || acts.length === 0) {
      try {
        const seedPath = path.resolve(__dirname, '../data/templates/utility_gas/agent_acts/en.json');
        const raw = fs.readFileSync(seedPath, 'utf8');
        const json = JSON.parse(raw);
        const now = new Date().toISOString();
        const docs = (json || []).map((it) => ({
          _id: it.id || it._id,
          type: 'agent_act',
          label: it.label || it.name || 'Unnamed',
          description: it.description || '',
          category: it.category || 'Uncategorized',
          tags: it.tags || [],
          isInteractive: Boolean(it.isInteractive),
          data: it.data || {},
          ddt: null,
          createdAt: now,
          updatedAt: now,
        }));
        if (docs.length > 0) {
          await coll.insertMany(docs, { ordered: false });
          acts = await coll.find({}).toArray();
          console.log('>>> AgentActs seeded:', acts.length);
        }
      } catch (e) {
        console.warn('Seed AgentActs failed:', e.message);
      }
    }
    // Normalize returned objects with mode and isInteractive
    console.log('>>> GET /api/factory/agent-acts - Raw acts count:', acts.length);
    if (acts.length > 0) {
      console.log('>>> First act sample:', JSON.stringify({
        _id: acts[0]._id,
        label: acts[0].label,
        mode: acts[0].mode
      }, null, 2));
    }

    const normalizedActs = acts.map(act => {
      const derivedMode = deriveModeFromDoc(act);
      const derivedIsInteractive = deriveIsInteractiveFromMode(derivedMode);
      return {
        ...act,
        mode: derivedMode,
        isInteractive: derivedIsInteractive
      };
    });

    console.log('>>> Normalized acts count:', normalizedActs.length);
    if (normalizedActs.length > 0) {
      console.log('>>> First normalized act sample:', JSON.stringify({
        _id: normalizedActs[0]._id,
        label: normalizedActs[0].label,
        mode: normalizedActs[0].mode
      }, null, 2));
    }

    res.json(normalizedActs);
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  } finally {
    await client.close();
  }
});

// Agent Acts - POST (with scope filtering)
app.post('/api/factory/agent-acts', async (req, res) => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbFactory);
    const coll = db.collection('AgentActs');

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

    console.log('>>> AgentActs query:', JSON.stringify(query, null, 2));

    const docs = await coll.find(query).toArray();
    console.log(`>>> Found ${docs.length} AgentActs with scope filtering`);
    res.json(docs);
  } catch (error) {
    console.error('Error fetching agent acts with scope filtering:', error);
    res.status(500).json({ error: 'Failed to fetch agent acts' });
  } finally {
    await client.close();
  }
});

// Backend Calls - GET (legacy)
app.get('/api/factory/backend-calls', async (req, res) => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbFactory);
    const coll = db.collection('BackendCalls');
    const docs = await coll.find({}).toArray();
    console.log(`>>> Found ${docs.length} BackendCalls`);
    res.json(docs);
  } catch (error) {
    console.error('Error fetching backend calls:', error);
    res.status(500).json({ error: 'Failed to fetch backend calls' });
  } finally {
    await client.close();
  }
});

// Backend Calls - POST (with scope filtering)
app.post('/api/factory/backend-calls', async (req, res) => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbFactory);
    const coll = db.collection('BackendCalls');

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

    console.log('>>> BackendCalls query:', JSON.stringify(query, null, 2));

    const docs = await coll.find(query).toArray();
    console.log(`>>> Found ${docs.length} BackendCalls with scope filtering`);
    res.json(docs);
  } catch (error) {
    console.error('Error fetching backend calls with scope filtering:', error);
    res.status(500).json({ error: 'Failed to fetch backend calls' });
  } finally {
    await client.close();
  }
});

// Conditions - GET (legacy)
app.get('/api/factory/conditions', async (req, res) => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbFactory);
    const coll = db.collection('Conditions');
    const docs = await coll.find({}).toArray();
    console.log(`>>> Found ${docs.length} Conditions`);
    res.json(docs);
  } catch (error) {
    console.error('Error fetching conditions:', error);
    res.status(500).json({ error: 'Failed to fetch conditions' });
  } finally {
    await client.close();
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
  const client = new MongoClient(uri);
  try {
    await client.connect();
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
  } finally {
    await client.close();
  }
});

// Conditions - PUT (update)
app.put('/api/factory/conditions/:id', async (req, res) => {
  const conditionId = req.params.id;
  const payload = req.body || {};
  const client = new MongoClient(uri);
  try {
    await client.connect();
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
  } finally {
    await client.close();
  }
});

// Tasks - GET (legacy)
app.get('/api/factory/tasks', async (req, res) => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbFactory);
    const coll = db.collection('Tasks');
    const docs = await coll.find({}).toArray();
    console.log(`>>> Found ${docs.length} Tasks`);
    res.json(docs);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  } finally {
    await client.close();
  }
});

// Tasks - POST (with scope filtering)
app.post('/api/factory/tasks', async (req, res) => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbFactory);
    const coll = db.collection('Tasks');

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
  } finally {
    await client.close();
  }
});

// Constants - GET months for language
app.get('/api/constants/months/:language', async (req, res) => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
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
  } finally {
    await client.close();
  }
});

// Macro Tasks - GET (legacy)
app.get('/api/factory/macro-tasks', async (req, res) => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbFactory);
    const coll = db.collection('MacroTasks');
    const docs = await coll.find({}).toArray();
    console.log(`>>> Found ${docs.length} MacroTasks`);
    res.json(docs);
  } catch (error) {
    console.error('Error fetching macro tasks:', error);
    res.status(500).json({ error: 'Failed to fetch macro tasks' });
  } finally {
    await client.close();
  }
});

// Macro Tasks - POST (with scope filtering)
app.post('/api/factory/macro-tasks', async (req, res) => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
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
  } finally {
    await client.close();
  }
});

app.put('/api/factory/agent-acts/:id', async (req, res) => {
  const id = req.params.id;
  const payload = req.body || {};
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbFactory);
    payload.updatedAt = new Date();
    await db.collection('AgentActs').updateOne(
      { _id: id },
      { $set: payload, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
    const saved = await db.collection('AgentActs').findOne({ _id: id });
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  } finally {
    await client.close();
  }
});

// Bulk-replace Agent Acts: delete all then insert the provided list
app.post('/api/factory/agent-acts/bulk-replace', async (req, res) => {
  const payload = Array.isArray(req.body) ? req.body : [];
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbFactory);
    const coll = db.collection('AgentActs');
    await coll.deleteMany({});
    let inserted = 0;
    if (payload.length > 0) {
      const docs = payload.map((it) => ({
        _id: it._id || it.id,
        type: 'agent_act',
        label: it.label || it.name || 'Unnamed',
        description: it.description || '',
        category: it.category || 'Uncategorized',
        tags: it.tags || [],
        isInteractive: Boolean(it.isInteractive),
        data: it.data || {},
        ddt: it.ddt || null,
        prompts: it.prompts || {},
        createdAt: it.createdAt || new Date(),
        updatedAt: new Date(),
      }));
      const result = await coll.insertMany(docs, { ordered: false });
      inserted = (result && result.insertedCount) || 0;
    }
    res.json({ success: true, inserted });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  } finally {
    await client.close();
  }
});

app.get('/api/factory/actions', async (req, res) => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbFactory);
    // Actions sono ora in Task_Templates con taskType='Action', non più in Actions
    const actions = await db.collection('Task_Templates').find({ taskType: 'Action' }).toArray();
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
  } finally {
    await client.close();
  }
});

app.get('/api/factory/dialogue-templates', async (req, res) => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbFactory);
    // ✅ Load data templates from Task_Templates (filter by type: 'data' instead of obsolete 'name' field)
    const ddt = await db.collection('Task_Templates').find({ type: 'data' }).toArray();
    try { console.log('>>> LOAD /api/factory/dialogue-templates count =', Array.isArray(ddt) ? ddt.length : 0); } catch { }
    res.json(ddt);
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  } finally {
    await client.close();
  }
});

// IDE translations (static, read-only from client perspective)
app.get('/api/factory/ide-translations', async (req, res) => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
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
  } finally {
    await client.close();
  }
});

// DataDialogue translations (dynamic, editable)
app.get('/api/factory/data-dialogue-translations', async (req, res) => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbFactory);
    const coll = db.collection('DataDialogueTranslations');
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
  } finally {
    await client.close();
  }
});

// Template translations (from stepPrompts)
app.post('/api/factory/template-translations', async (req, res) => {
  const client = new MongoClient(uri);
  try {
    const { keys } = req.body; // Array of translation keys (GUIDs or old-style keys)

    if (!Array.isArray(keys) || keys.length === 0) {
      return res.json({});
    }

    await client.connect();
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

    // Query for GUIDs (new format): guid field, type = 'Template'
    if (guidKeys.length > 0) {
      const guidDocs = await coll.find({
        guid: { $in: guidKeys },
        type: 'Template'
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
    console.error('[TEMPLATE_TRANSLATIONS] Error:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  } finally {
    await client.close();
  }
});

app.post('/api/factory/data-dialogue-translations', async (req, res) => {
  const payload = req.body || {};
  if (typeof payload !== 'object' || Array.isArray(payload)) {
    return res.status(400).json({ error: 'Payload must be an object of translationKey: text' });
  }
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbFactory);
    const coll = db.collection('DataDialogueTranslations');
    await coll.deleteMany({});
    await coll.insertOne({ data: payload, updatedAt: new Date() });
    res.json({ success: true, count: Object.keys(payload).length });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  } finally {
    await client.close();
  }
});

// Load project translations by GUIDs
app.post('/api/projects/:pid/translations/load', async (req, res) => {
  const projectId = req.params.pid;
  const { guids } = req.body || {};

  if (!Array.isArray(guids) || guids.length === 0) {
    return res.json({});
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();

    console.log(`[PROJECT_TRANSLATIONS] Request for project ${projectId}, ${guids.length} GUIDs`);
    console.log(`[PROJECT_TRANSLATIONS] Sample GUIDs:`, guids.slice(0, 5));

    // Try project database first
    const projDb = await getProjectDb(client, projectId);
    const projColl = projDb.collection('Translations');

    // Query: guid in guids AND type = 'Template' (projectId can be anything or null)
    const projectQuery = {
      guid: { $in: guids },
      type: 'Template'
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

    // Query: guid in guids AND type = 'Template' AND (projectId = null OR projectId doesn't exist)
    const factoryQuery = {
      guid: { $in: guids },
      type: 'Template',
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
  } finally {
    await client.close();
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

    // Prepare queries
    const projectQuery = {
      $or: [
        { type: 'Instance' },
        { type: 'Template' }
      ],
      language: projectLocale
    };

    const factoryQuery = {
      type: 'Template',
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

  const client = new MongoClient(uri);
  try {
    await client.connect();

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
          language: trans.language,
          type: trans.type || 'Instance'
        };

        const update = {
          $set: {
            guid: trans.guid,
            language: trans.language,
            text: trans.text,
            type: trans.type || 'Instance',
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
  } finally {
    await client.close();
  }
});

// --- DDT Wizard (mock) ---
// Minimal mock for detect-type to avoid relying on FastAPI during dev
// (removed) /api/ddt/step2 mock — using FastAPI /step2

app.post('/api/factory/dialogue-templates', async (req, res) => {
  try { console.log('>>> SAVE /api/factory/dialogue-templates size ~', Buffer.byteLength(JSON.stringify(req.body || {})), 'bytes'); } catch { }
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbFactory);
    const coll = db.collection('Task_Templates');
    const now = new Date();

    // Handle single template or array of templates
    const templates = Array.isArray(req.body) ? req.body : [req.body];

    for (const template of templates) {
      if (!template.name) {
        continue; // Skip templates without name
      }

      // Upsert by name
      await coll.updateOne(
        { name: template.name },
        {
          $set: {
            ...template,
            updatedAt: now
          },
          $setOnInsert: {
            createdAt: now
          }
        },
        { upsert: true }
      );
    }

    res.json({ success: true, count: templates.length });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  } finally {
    await client.close();
  }
});

app.delete('/api/factory/dialogue-templates/:id', async (req, res) => {
  const id = req.params.id;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbFactory);
    const coll = db.collection('Task_Templates');
    // Delete by name or _id
    let filter;
    if (/^[a-fA-F0-9]{24}$/.test(id)) {
      filter = { _id: new ObjectId(id) };
    } else {
      // Try by name first, then by _id
      filter = { $or: [{ name: id }, { _id: id }] };
    }
    const result = await coll.deleteOne(filter);
    if (result.deletedCount === 1) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Template non trovato' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  } finally {
    await client.close();
  }
});

app.get('/api/factory/industries', async (req, res) => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbFactory);
    const industries = await db.collection('Industries').find({}).toArray();
    res.json(industries);
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  } finally {
    await client.close();
  }
});

// GET: Lista industry uniche dai progetti (come per i clienti)
app.get('/api/projects/catalog/industries', async (req, res) => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbProjects);
    const coll = db.collection('projects_catalog');
    const projects = await coll.find({}, { projection: { industry: 1 } }).toArray();
    const industries = new Set();
    projects.forEach(p => {
      if (p.industry && typeof p.industry === 'string' && p.industry.trim()) {
        industries.add(p.industry.trim());
      }
    });
    const uniqueIndustries = Array.from(industries).sort();
    res.json(uniqueIndustries);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    await client.close();
  }
});

// POST: Crea nuova industry nel factory
app.post('/api/factory/industries', async (req, res) => {
  const payload = req.body || {};
  const industryName = payload.name || payload.industryName || null;
  if (!industryName || typeof industryName !== 'string' || !industryName.trim()) {
    return res.status(400).json({ error: 'industry_name_required' });
  }
  const client = new MongoClient(uri);
  try {
    await client.connect();
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
  } finally {
    await client.close();
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
// Ora salva i pattern in Task_Types invece di task_heuristics
app.post('/api/factory/task-heuristics', async (req, res) => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbFactory);
    // Pattern sono ora in Task_Types, non più in task_heuristics
    const coll = db.collection('Task_Types');

    const payload = req.body || {};
    const { type, patterns, language } = payload;

    if (!type || !Array.isArray(patterns) || !language) {
      return res.status(400).json({ error: 'type, patterns (array), and language are required' });
    }

    // Mapping da HeuristicType a Task_Types._id
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

    // Carica il Task_Types esistente per preservare i pattern di altre lingue
    const existing = await coll.findOne({ _id: taskTypeId });
    const existingPatterns = existing?.patterns || {};

    // Aggiorna solo la lingua specificata
    const updatedPatterns = {
      ...existingPatterns,
      [langUpper]: patterns
    };

    // Aggiorna Task_Types
    const result = await coll.updateOne(
      { _id: taskTypeId },
      {
        $set: {
          patterns: updatedPatterns,
          updatedAt: now
        }
      },
      { upsert: false } // Non creare se non esiste
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: `Task_Types._id '${taskTypeId}' not found` });
    }

    // Invalidate cache
    taskHeuristicsCacheLoaded = false;
    taskHeuristicsCache = null;

    const saved = await coll.findOne({ _id: taskTypeId });
    logInfo('TaskHeuristics.post', { type, taskTypeId, language: langUpper, patternsCount: patterns.length });
    res.json(saved);
  } catch (e) {
    logError('TaskHeuristics.post', e);
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    await client.close();
  }
});

// -----------------------------
// Factory: Task Templates Endpoints
// -----------------------------
// GET /api/factory/task-templates - List all templates
app.get('/api/factory/task-templates', async (req, res) => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbFactory);
    // Task templates sono in Task_Templates, non task_templates
    const coll = db.collection('Task_Templates');

    const { industry, scope, taskType } = req.query;

    // Build query based on scope filtering and taskType
    const query = {};
    if (scope && industry) {
      query.$or = [
        { scope: 'global' },
        { scope: 'industry', industry }
      ];
    }
    // Filter by taskType if provided (e.g., 'Action' for actions palette)
    if (taskType) {
      query.taskType = taskType;
    }

    const templates = await coll.find(query).toArray();
    logInfo('TaskTemplates.get', { count: templates.length, industry, scope, taskType });
    res.json(templates);
  } catch (e) {
    logError('TaskTemplates.get', e);
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    await client.close();
  }
});

// POST /api/factory/task-templates - Create template
app.post('/api/factory/task-templates', async (req, res) => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbFactory);
    const coll = db.collection('Task_Templates');

    const payload = req.body || {};
    if (!payload.id || !payload.label || !payload.valueSchema) {
      return res.status(400).json({ error: 'id, label, and valueSchema are required' });
    }

    const now = new Date();
    const doc = {
      _id: payload.id,
      id: payload.id,
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
  } finally {
    await client.close();
  }
});

// PUT /api/factory/task-templates/:id - Update template
app.put('/api/factory/task-templates/:id', async (req, res) => {
  const id = req.params.id;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbFactory);
    const coll = db.collection('Task_Templates');

    const payload = req.body || {};
    const now = new Date();

    const updateDoc = {
      ...payload,
      updatedAt: now
    };
    delete updateDoc._id; // Don't update _id
    delete updateDoc.createdAt; // Don't update createdAt

    await coll.updateOne(
      { _id: id },
      { $set: updateDoc },
      { upsert: false }
    );

    const saved = await coll.findOne({ _id: id });
    if (!saved) {
      return res.status(404).json({ error: 'Template not found' });
    }

    logInfo('TaskTemplates.put', { id });
    res.json(saved);
  } catch (e) {
    logError('TaskTemplates.put', e);
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    await client.close();
  }
});

// DELETE /api/factory/task-templates/:id - Delete template
app.delete('/api/factory/task-templates/:id', async (req, res) => {
  const id = req.params.id;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbFactory);
    const coll = db.collection('Task_Templates');

    const result = await coll.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    logInfo('TaskTemplates.delete', { id });
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (e) {
    logError('TaskTemplates.delete', e);
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    await client.close();
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
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbFactory);
    const coll = db.collection('Task_Types');

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
      subData: payload.subData || [],
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
  } finally {
    await client.close();
  }
});

// POST /api/projects/:pid/type-templates - Save type template in Project
app.post('/api/projects/:pid/type-templates', async (req, res) => {
  const projectId = req.params.pid;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const projDb = await getProjectDb(client, projectId);
    const coll = projDb.collection('Task_Types');

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
      subData: payload.subData || [],
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
  } finally {
    await client.close();
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
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbFactory);
    const templates = await db.collection('DataDialogueTemplates').find({ industry: industryId }).toArray();
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  } finally {
    await client.close();
  }
});

// --- PROJECTS ENDPOINTS (API) ---

app.get('/api/projects', async (req, res) => {
  console.log('>>> CHIAMATA /api/projects');
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbProjects);
    const projects = await db.collection('projects').find({}).sort({ _id: -1 }).toArray();
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  } finally {
    await client.close();
  }
});

app.post('/api/projects', async (req, res) => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbProjects);
    const result = await db.collection('projects').insertOne(req.body);
    const saved = await db.collection('projects').findOne({ _id: result.insertedId });
    res.json({ id: result.insertedId, ...saved });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  } finally {
    await client.close();
  }
});

app.get('/api/projects/:id', async (req, res) => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbProjects);
    const project = await db.collection('projects').findOne({ _id: new ObjectId(req.params.id) });
    if (!project) return res.status(404).json({ error: 'Progetto non trovato' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  } finally {
    await client.close();
  }
});

// --- PROJECTS ENDPOINTS (ALIAS) ---

app.get('/projects', async (req, res) => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbProjects);
    const projects = await db.collection('projects').find({}).sort({ _id: -1 }).toArray();
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  } finally {
    await client.close();
  }
});

app.post('/projects', async (req, res) => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbProjects);
    const result = await db.collection('projects').insertOne(req.body);
    const saved = await db.collection('projects').findOne({ _id: result.insertedId });
    res.json({ id: result.insertedId, ...saved });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  } finally {
    await client.close();
  }
});

app.get('/projects/all', async (req, res) => {
  console.log('>>> CHIAMATA /projects/all');
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbProjects);
    const projects = await db.collection('projects').find({}).sort({ _id: -1 }).toArray();
    res.json(projects);
  } catch (err) {
    console.error('Errore in /projects/all:', err); // <--- AGGIUNGI QUESTO
    res.status(500).json({ error: err.message, stack: err.stack });
  } finally {
    await client.close();
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
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbProjects);
    const project = await db.collection('projects').findOne({ _id: new ObjectId(req.params.id) });
    if (!project) return res.status(404).json({ error: 'Progetto non trovato' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  } finally {
    await client.close();
  }
});

// ✅ ENTERPRISE: Analizza la richiesta utente usando SOLO AI reale
async function analyzeUserRequestWithAI(userDesc, templates, provider = 'groq', model = null) {
  console.log(`[AI_ANALYSIS] Starting AI analysis for: "${userDesc}"`);
  console.log(`[AI_ANALYSIS] Using ${provider} provider`);
  console.log(`[AI_ANALYSIS] Using model: ${model || 'default'}`);
  console.log(`[AI_ANALYSIS] Available templates:`, Object.keys(templates).length);

  try {
    const result = await templateIntelligenceService.analyzeUserRequest(userDesc, templates, provider, model);
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
          subDataCount: main.subData?.length || 0,
          validationDescription: main.validation?.description || 'NO DESCRIPTION',
          exampleValue: main.example || 'NO EXAMPLE'
        });
      });
    }

    return result;
  } catch (error) {
    console.error(`[AI_ANALYSIS] ❌ AI analysis failed:`, error.message);
    throw new Error(`AI analysis failed: ${error.message}`);
  }
}

// ✅ ENTERPRISE: Solo AI generativa - nessun fallback locale

// Compone template esistenti in una struttura unificata
async function composeTemplates(templateNames, templates, userDesc) {
  const composedMains = [];

  for (const templateName of templateNames) {
    const template = templates[templateName];
    if (template) {
      // Risolvi subData con supporto 3 livelli
      const resolvedSubData = await resolveTemplateRefsWithLevels(template.subData || [], templates);

      // Aggiungi validazione e esempi migliorati
      const enhancedSubData = resolvedSubData.map(item => ({
        ...item,
        validation: {
          ...item.validation,
          description: generateValidationDescription(item.type, item.validation),
          examples: generateTestExamples(item.type, item.validation)
        }
      }));

      composedMains.push({
        label: template.label,
        type: template.type,
        icon: template.icon,
        subData: enhancedSubData,
        validation: {
          description: `This field contains ${template.label.toLowerCase()} information`,
          examples: generateTestExamples(template.type, template.validation)
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

  // ✅ NUOVA STRUTTURA: Usa subDataIds invece di subData
  // NOTA: Un template alla radice non sa se sarà usato come sottodato o come main,
  // quindi può avere tutti i 6 tipi di stepPrompts (start, noMatch, noInput, confirmation, notConfirmed, success).
  // Quando lo usiamo come sottodato, filtriamo e prendiamo solo start, noInput, noMatch.
  // Ignoriamo confirmation, notConfirmed, success anche se presenti nel template sottodato.
  const subDataIds = template.subDataIds || [];
  const mainDataList = [];

  if (subDataIds.length > 0) {
    // ✅ Template composito: crea UN SOLO mainData con subData[] popolato
    // ✅ PRIMA: Costruisci array di subData instances
    // Per ogni ID in subDataIds, cerca il template corrispondente e crea una sotto-istanza
    const subDataInstances = [];

    for (const subId of subDataIds) {
      // ✅ Cerca template per ID (può essere _id, id, name, o label)
      const subTemplate = templates[subId] ||
        Object.values(templates).find((t) =>
          t._id === subId || t.id === subId || t.name === subId || t.label === subId
        );

      if (subTemplate) {
        // ✅ Filtra stepPrompts: solo start, noInput, noMatch per sottodati
        // Ignora confirmation, notConfirmed, success anche se presenti nel template sottodato
        const filteredStepPrompts = {};
        if (subTemplate.stepPrompts) {
          if (subTemplate.stepPrompts.start) {
            filteredStepPrompts.start = subTemplate.stepPrompts.start;
          }
          if (subTemplate.stepPrompts.noInput) {
            filteredStepPrompts.noInput = subTemplate.stepPrompts.noInput;
          }
          if (subTemplate.stepPrompts.noMatch) {
            filteredStepPrompts.noMatch = subTemplate.stepPrompts.noMatch;
          }
          // ❌ Ignoriamo: confirmation, notConfirmed, success
        }

        // ✅ Usa la label del template trovato (non l'ID!)
        subDataInstances.push({
          label: subTemplate.label || subTemplate.name || 'Sub',
          type: subTemplate.type || subTemplate.name || 'generic',
          icon: subTemplate.icon || 'FileText',
          stepPrompts: Object.keys(filteredStepPrompts).length > 0 ? filteredStepPrompts : null,
          constraints: subTemplate.dataContracts || subTemplate.constraints || [],
          examples: subTemplate.examples || [],
          subData: []
        });
      }
    }

    // ✅ POI: Crea UN SOLO mainData con subData[] popolato (non elementi separati!)
    // L'istanza principale copia TUTTI i stepPrompts dal template (tutti e 6 i tipi)
    mainDataList.push({
      label: template.label,
      type: template.type,
      icon: template.icon,
      stepPrompts: template.stepPrompts || null, // ✅ Tutti e 6 i tipi per main
      constraints: template.dataContracts || template.constraints || [],
      examples: template.examples || [],
      subData: subDataInstances // ✅ Sottodati QUI dentro subData[], non in mainData[]
    }); // ✅ UN SOLO elemento in mainDataList
  } else {
    // ✅ Template semplice: crea istanza dal template root
    mainDataList.push({
      label: template.label,
      type: template.type,
      icon: template.icon,
      stepPrompts: template.stepPrompts || null,
      constraints: template.dataContracts || template.constraints || [],
      examples: template.examples || [],
      subData: []
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
        mainData: mainDataList,
        stepPrompts: template.stepPrompts || null
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
  try {
    const { userDesc, provider = 'groq', model } = req.body;

    console.log('[STEP2] Raw body:', req.body);
    console.log('[STEP2] Parsed userDesc:', userDesc);
    console.log('[STEP2] Parsed provider:', provider);
    console.log('[STEP2] Parsed model:', model);

    // Load templates from database
    const templates = await loadTemplatesFromDB();
    console.log('[STEP2] Using', Object.keys(templates).length, 'templates from Factory DB cache');

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
          hasSubData: !!heuristicResult.template?.subData,
          subDataCount: heuristicResult.template?.subData?.length || 0
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

        // ✅ DEBUG: Log stepPrompts nella risposta
        console.log('[STEP2][HEURISTIC] Response built:', JSON.stringify(heuristicResponse, null, 2));
        console.log('[STEP2][HEURISTIC] DEBUG stepPrompts check:', {
          schemaHasStepPrompts: !!(heuristicResponse.schema?.stepPrompts),
          schemaStepPrompts: heuristicResponse.schema?.stepPrompts,
          mainDataHasStepPrompts: heuristicResponse.schema?.mainData?.some(m => m.stepPrompts),
          mainDataStepPrompts: heuristicResponse.schema?.mainData?.map(m => ({
            label: m.label,
            hasStepPrompts: !!m.stepPrompts,
            stepPrompts: m.stepPrompts
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

    // If AI found a template match (use_existing), include stepPrompts from the matched template
    if (analysis.action === 'use_existing' && analysis.template_source) {
      const matchedTemplate = templates[analysis.template_source];
      if (matchedTemplate && matchedTemplate.stepPrompts) {
        console.log('[STEP2][AI_MATCH] Including stepPrompts from matched template:', analysis.template_source);
        // Add stepPrompts to schema level and mainData level
        if (analysis.schema) {
          analysis.schema.stepPrompts = matchedTemplate.stepPrompts;
          if (analysis.schema.mainData && analysis.schema.mainData.length > 0) {
            analysis.schema.mainData[0].stepPrompts = matchedTemplate.stepPrompts;
          }
        }
      }
    }

    res.json({
      ai: {
        ...analysis,
        provider_used: provider,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[STEP2] Error:', error);
    res.status(500).json({ error: error.message });
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
  const client = new MongoClient(uri);
  try {
    await client.connect();
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
  } finally {
    await client.close();
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
    const client = new MongoClient(uri);
    await client.connect();
    const factoryDb = client.db(dbFactory);
    const factoryTranslationsColl = factoryDb.collection('Translations');

    // Create indexes for faster translation queries
    await factoryTranslationsColl.createIndex({ language: 1, type: 1 }).catch(() => { });
    await factoryTranslationsColl.createIndex({ guid: 1, language: 1 }).catch(() => { });
    await factoryTranslationsColl.createIndex({ language: 1, type: 1, projectId: 1 }).catch(() => { });

    await client.close();
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

    const { nodes, edges, tasks, ddts, projectId } = req.body;

    console.log('[API] Compile request:', {
      nodesCount: nodes?.length || 0,
      edgesCount: edges?.length || 0,
      tasksCount: tasks?.length || 0,
      ddtsCount: ddts?.length || 0,
      projectId
    });

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
      if (task && task.value && task.value.ddt) {
        return task.value.ddt;
      }
      // Try to find by taskId in ddts
      return ddtMap.get(taskId) || null;
    };

    // Call compiler
    console.log('[API] Calling backend compiler...');
    const result = compileFlow(nodes, edges, {
      getTask,
      getDDT
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
      compiledBy: 'BACKEND_RUNTIME', // ✅ Flag to confirm backend compiler was used
      timestamp: new Date().toISOString()
    };

    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('✅ [API] POST /api/runtime/compile - COMPLETED');
    console.log('[API] Compile result:', {
      tasksCount: result.tasks.length,
      entryTaskId: result.entryTaskId,
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

app.listen(3100, () => {
  console.log('Backend API pronta su http://localhost:3100');
});
