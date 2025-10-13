

const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const { runExtractor } = require('./extractionRegistry');

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

const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const fs = require('fs');
const path = require('path');
const dbFactory = 'factory';
const dbProjects = 'Projects';

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
  const c = abbreviateSlug(clientName, 6);
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
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbProjects);
    const list = await db.collection('projects_catalog').find({}).sort({ updatedAt: -1 }).toArray();
    logInfo('Catalog.list', { count: Array.isArray(list) ? list.length : 0 });
    res.json(list);
  } catch (e) {
    logError('Catalog.list', e);
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    await client.close();
  }
});

app.post('/api/projects/catalog', async (req, res) => {
  const payload = req.body || {};
  const clientName = payload.clientName;
  const projectName = payload.projectName;
  if (!clientName || !projectName) {
    return res.status(400).json({ error: 'clientName_and_projectName_required' });
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
      clientName,
      projectName,
      clientSlug: slugifyName(clientName),
      projectSlug: slugifyName(projectName),
      industry: payload.industry || null,
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
  const clientName = payload.clientName;
  const projectName = payload.projectName;
  const industry = payload.industry || null;
  const language = payload.language || 'pt';
  if (!clientName || !projectName) {
    return res.status(400).json({ error: 'clientName_and_projectName_required' });
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
      clientName,
      projectName,
      clientSlug: slugifyName(clientName),
      projectSlug: slugifyName(projectName),
      industry,
      language,
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
          clientName,
          projectName,
          clientSlug: slugifyName(clientName),
          projectSlug: slugifyName(projectName),
          industry,
          language,
          updatedAt: now
        },
        $setOnInsert: { createdAt: now }
      },
      { upsert: true }
    );

    // 4) Clona atti dalla factory
    const factoryDb = client.db(dbFactory);
    const actsColl = factoryDb.collection('AgentActs');
    // scope filtering best-effort (i doc potrebbero non avere scope/industry)
    let query = {};
    if (industry) {
      // se presenti metadati scope/industry nel futuro
      query = { $or: [ { scope: 'global' }, { scope: 'industry', industry } ] };
    }
    let acts = await actsColl.find(query).toArray();
    // Fallback: se il filtro scope/industry non produce risultati, copia tutti gli atti
    if (!acts || acts.length === 0) {
      acts = await actsColl.find({}).toArray();
    }

    const mapped = (acts || []).map((act) => ({
      _id: act._id || act.id,
      name: act.label || act.name || 'Unnamed',
      description: act.description || '',
      category: act.category || 'Uncategorized',
      mode: deriveModeFromDoc(act),
      shortLabel: act.shortLabel || null,
      data: act.data || {},
      ddtSnapshot: act.ddt || null,
      origin: 'factory',
      originId: act._id || act.id,
      originVersion: act.updatedAt || null,
      sourceHash: null,
      createdAt: now,
      updatedAt: now
    }));

    let inserted = 0;
    if (mapped.length > 0) {
      const result = await projDb.collection('project_acts').insertMany(mapped, { ordered: false });
      inserted = result.insertedCount || Object.keys(result.insertedIds || {}).length || 0;
    }

    // 5) Collezioni vuote necessarie
    await projDb.collection('act_instances').createIndex({ baseActId: 1, updatedAt: -1 }).catch(() => {});
    await projDb.collection('flow').createIndex({ updatedAt: -1 }).catch(() => {});

    logInfo('Projects.bootstrap', { projectId, dbName, insertedActs: inserted });
    res.json({ ok: true, projectId, dbName, counts: { project_acts: inserted } });
  } catch (e) {
    logError('Projects.bootstrap', e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
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
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = await getProjectDb(client, pid);
    const nodes = await db.collection('flow_nodes').find({ flowId }).toArray();
    const edges = await db.collection('flow_edges').find({ flowId }).toArray();
    logInfo('Flow.get', { projectId: pid, flowId, nodes: nodes?.length || 0, edges: edges?.length || 0 });
    res.json({ nodes, edges });
  } catch (e) {
    logError('Flow.get', e, { projectId: pid, flowId });
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    await client.close();
  }
});

app.put('/api/projects/:pid/flow', async (req, res) => {
  const pid = req.params.pid;
  const flowId = String(req.query.flowId || 'main');
  const payload = req.body || {};
  const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
  const edges = Array.isArray(payload.edges) ? payload.edges : [];
  const client = new MongoClient(uri);
  try {
    await client.connect();
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

    // Upsert nodes
    for (const n of nodes) {
      await ncoll.updateOne({ id: n.id, flowId }, { $set: { ...n, flowId, updatedAt: now } }, { upsert: true });
      nUpserts++;
      existingNodeIds.delete(n.id);
    }
    // Delete removed nodes
    if (existingNodeIds.size) {
      await ncoll.deleteMany({ id: { $in: Array.from(existingNodeIds) }, flowId });
      nDeletes = existingNodeIds.size;
    }

    // Upsert edges
    for (const e of edges) {
      await ecoll.updateOne({ id: e.id, flowId }, { $set: { ...e, flowId, updatedAt: now } }, { upsert: true });
      eUpserts++;
      existingEdgeIds.delete(e.id);
    }
    // Delete removed edges
    if (existingEdgeIds.size) {
      await ecoll.deleteMany({ id: { $in: Array.from(existingEdgeIds) }, flowId });
      eDeletes = existingEdgeIds.size;
    }

    logInfo('Flow.put', { projectId: pid, flowId, nodes: nodes.length, edges: edges.length, upserts: { nodes: nUpserts, edges: eUpserts }, deletes: { nodes: nDeletes, edges: eDeletes } });
    res.json({ ok: true, nodes: nodes.length, edges: edges.length });
  } catch (e) {
    logError('Flow.put', e, { projectId: pid, flowId });
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    await client.close();
  }
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
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const projDb = await getProjectDb(client, projectId);
    const coll = projDb.collection('project_acts');
    const filter = q ? { name: { $regex: String(q), $options: 'i' } } : {};
    const cursor = coll.find(filter).sort({ name: 1 });
    const docs = await (limit ? cursor.limit(parseInt(String(limit), 10) || 50) : cursor).toArray();
    const count = await coll.countDocuments(filter);
    res.json({ count, items: docs });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    await client.close();
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
  const client = new MongoClient(uri);
  try {
    await client.connect();
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
    const result = await coll.bulkWrite(ops, { ordered: false });
    logInfo('Acts.post.bulk', { projectId: pid, count: items.length, matched: result.matchedCount, modified: result.modifiedCount, upserted: result.upsertedCount });
    res.json({ ok: true, matchedCount: result.matchedCount, modifiedCount: result.modifiedCount, upsertedCount: result.upsertedCount });
  } catch (e) {
    logError('Acts.post.bulk', e, { projectId: pid, count: items.length });
    res.status(500).json({ error: String(e?.message || e) });
  } finally {
    await client.close();
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
    try { base = await projDb.collection('project_acts').findOne({ _id: payload.baseActId }); } catch {}
    const instance = {
      projectId,
      baseActId: payload.baseActId,
      ddtRefId: payload.baseActId,
      mode: payload.mode,
      message: payload.message || null,
      overrides: payload.overrides || null,
      baseVersion: base?.updatedAt || null,
      baseHash: null,
      ddtSnapshot: null,
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
      try { base = await projDb.collection('project_acts').findOne({ _id: it.baseActId }); } catch {}
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
    await client.connect();
    const projDb = await getProjectDb(client, projectId);

    const update = { updatedAt: new Date() };
    if (payload.message !== undefined) update['message'] = payload.message;
    if (payload.overrides !== undefined) update['overrides'] = payload.overrides;

    // optional: fork = true → copy current project_acts.ddtSnapshot into instance.ddtSnapshot
    if (payload.fork === true) {
      const curr = await projDb.collection('act_instances').findOne({ _id: iid });
      const baseId = payload.baseActId || curr?.baseActId;
      if (baseId) {
        const base = await projDb.collection('project_acts').findOne({ _id: baseId });
        if (base && base.ddtSnapshot) {
          update['ddtSnapshot'] = base.ddtSnapshot;
          update['baseVersion'] = base.updatedAt || new Date();
        }
      }
    }

    await projDb.collection('act_instances').updateOne({ _id: iid }, { $set: update });
    const saved = await projDb.collection('act_instances').findOne({ _id: iid });
    res.json(saved);
  } catch (e) {
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
    await client.connect();
    const projDb = await getProjectDb(client, projectId);
    const coll = projDb.collection('act_instances');
    const filter = ids.length ? { _id: { $in: ids } } : {};
    const items = await coll.find(filter).sort({ updatedAt: -1 }).toArray();
    res.json({ count: items.length, items });
  } catch (e) {
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
  const client = new MongoClient(uri);
  try {
    await client.connect();
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
    
    const docs = await coll.find(query).toArray();
    console.log(`>>> Found ${docs.length} Conditions with scope filtering`);
    res.json(docs);
  } catch (error) {
    console.error('Error fetching conditions with scope filtering:', error);
    res.status(500).json({ error: 'Failed to fetch conditions' });
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
    const actions = await db.collection('Actions').find({}).toArray();
    res.json(actions);
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
    const ddt = await db.collection('DataDialogueTemplates').find({}).toArray();
    try { console.log('>>> LOAD /api/factory/dialogue-templates count =', Array.isArray(ddt) ? ddt.length : 0); } catch {}
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

// --- DDT Wizard (mock) ---
// Minimal mock for detect-type to avoid relying on FastAPI during dev
// (removed) /api/ddt/step2 mock — using FastAPI /step2

app.post('/api/factory/dialogue-templates', async (req, res) => {
  try { console.log('>>> SAVE /api/factory/dialogue-templates size ~', Buffer.byteLength(JSON.stringify(req.body || {})), 'bytes'); } catch {}
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbFactory);
    // 1. Cancella tutti i DDT esistenti
    await db.collection('DataDialogueTemplates').deleteMany({});
    // 2. Inserisci i nuovi DDT ricevuti dal client, solo se ce ne sono
    const newDDTs = req.body;
    if (Array.isArray(newDDTs) && newDDTs.length > 0) {
      await db.collection('DataDialogueTemplates').insertMany(newDDTs);
    }
    res.json({ success: true });
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
    let filter;
    if (/^[a-fA-F0-9]{24}$/.test(id)) {
      filter = { _id: new ObjectId(id) };
    } else {
      filter = { _id: id };
    }
    const result = await db.collection('DataDialogueTemplates').deleteOne(filter);
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

app.listen(3100, () => {
  console.log('Backend API pronta su http://localhost:3100');
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
    const out = await runExtractor(String(kind), String(text), locale || 'it');
    res.json(out);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});
