/**
 * Persistenza canale review agente in project_meta.agentReviewChannels[taskInstanceId].
 */

const crypto = require('crypto');

const REVIEW_EXPORT_VERSION = 1;

const REVIEW_AUDIENCES = ['customer', 'internal', 'auditing'];

const REVIEW_STRUCTURED_SECTION_IDS = [
  'goal',
  'operational_sequence',
  'context',
  'constraints',
];

function normalizeAudience(value) {
  const s = String(value || 'customer').trim().toLowerCase();
  return REVIEW_AUDIENCES.includes(s) ? s : 'customer';
}

function stableStringify(value) {
  return JSON.stringify(value);
}

function computeContentHash(payload) {
  const text = stableStringify(payload);
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Rimuove undefined/null ricorsivi (BSON/Mongo non accetta undefined). */
function stripUndefinedDeep(value) {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) {
    return value.map(stripUndefinedDeep).filter((v) => v !== undefined);
  }
  if (typeof value === 'object' && !(value instanceof Date)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const cleaned = stripUndefinedDeep(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out;
  }
  return value;
}

function normalizeDocument(body, projectId, taskInstanceId) {
  if (!body || typeof body !== 'object') {
    throw new Error('document_object_required');
  }
  const agentDesignDescription =
    typeof body.agentDesignDescription === 'string' ? body.agentDesignDescription : '';
  const bundle = body.useCaseBundle;
  if (!bundle || typeof bundle !== 'object' || !Array.isArray(bundle.use_cases)) {
    throw new Error('useCaseBundle_required');
  }
  const useCaseBundle = {
    useCaseBundleSchemaVersion:
      typeof bundle.useCaseBundleSchemaVersion === 'number' ? bundle.useCaseBundleSchemaVersion : 3,
    categories: Array.isArray(bundle.categories) ? bundle.categories : [],
    use_cases: bundle.use_cases,
  };
  const agentStructuredSections = parseStructuredSectionsField(body.agentStructuredSections);
  const payload = {
    agentDesignDescription: agentDesignDescription.trim(),
    useCaseBundle,
  };
  if (agentStructuredSections && Object.keys(agentStructuredSections).length > 0) {
    payload.agentStructuredSections = agentStructuredSections;
  }
  const now = new Date().toISOString();
  const audience = normalizeAudience(body.reviewAudience);
  const logicalSteps = Array.isArray(body.agentLogicalSteps) ? body.agentLogicalSteps : undefined;
  const out = {
    reviewExportVersion: REVIEW_EXPORT_VERSION,
    projectId: String(projectId || '').trim(),
    taskInstanceId: String(taskInstanceId || '').trim(),
    taskLabel: typeof body.taskLabel === 'string' ? body.taskLabel.trim() : '',
    agentDesignDescription,
    useCaseBundle,
    updatedAt: now,
    contentHash: computeContentHash(payload),
    reviewAudience: audience,
  };
  if (logicalSteps && logicalSteps.length > 0) {
    out.agentLogicalSteps = logicalSteps;
  }
  if (agentStructuredSections && Object.keys(agentStructuredSections).length > 0) {
    out.agentStructuredSections = agentStructuredSections;
  }
  if (body.knowledgeBase && typeof body.knowledgeBase === 'object') {
    out.knowledgeBase = stripUndefinedDeep(body.knowledgeBase);
  }
  if (body.backends && typeof body.backends === 'object') {
    out.backends = stripUndefinedDeep(body.backends);
  }
  if (body.conversation && typeof body.conversation === 'object') {
    out.conversation = stripUndefinedDeep(body.conversation);
  }
  return out;
}

function parseStructuredSectionsField(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const out = {};
  let hasAny = false;
  for (const id of REVIEW_STRUCTURED_SECTION_IDS) {
    const v = raw[id];
    if (typeof v === 'string' && v.trim()) {
      out[id] = v;
      hasAny = true;
    }
  }
  return hasAny ? out : undefined;
}

/** Legge sotto-canale per audience; compat: entry piatta con `.document` = customer. */
function readChannelFromMeta(meta, taskInstanceId, audience) {
  const aud = normalizeAudience(audience);
  const channels = meta?.agentReviewChannels;
  if (!channels || typeof channels !== 'object') return null;
  const entry = channels[taskInstanceId];
  if (!entry || typeof entry !== 'object') return null;

  if (entry.document && typeof entry.document === 'object') {
    if (aud !== 'customer') return null;
    return {
      document: entry.document,
      updatedAt: entry.updatedAt || entry.document.updatedAt || null,
      reviewAudience: 'customer',
    };
  }

  const sub = entry[aud];
  if (!sub || typeof sub !== 'object' || !sub.document) return null;
  return {
    document: sub.document,
    updatedAt: sub.updatedAt || sub.document.updatedAt || null,
    reviewAudience: aud,
  };
}

async function getReviewChannel(projDb, projectId, taskInstanceId, audience) {
  const meta = await projDb.collection('project_meta').findOne({ _id: 'meta' });
  const row = readChannelFromMeta(meta, taskInstanceId, audience);
  if (!row) {
    return { document: null, updatedAt: null, reviewAudience: normalizeAudience(audience) };
  }
  return row;
}

async function putReviewChannel(projDb, projectId, taskInstanceId, body, audience) {
  const aud = normalizeAudience(audience || body.reviewAudience);
  const document = stripUndefinedDeep(normalizeDocument(body, projectId, taskInstanceId));
  document.reviewAudience = aud;
  const now = new Date();
  const taskKey = String(taskInstanceId || '').trim();
  if (!taskKey) throw new Error('taskInstanceId_required');
  if (taskKey.includes('.') || taskKey.includes('$')) {
    throw new Error('taskInstanceId_invalid_for_storage');
  }
  const fieldKey = `agentReviewChannels.${taskKey}.${aud}`;
  await projDb.collection('project_meta').updateOne(
    { _id: 'meta' },
    {
      $set: {
        [fieldKey]: {
          document,
          updatedAt: now,
        },
        updatedAt: now,
      },
      $setOnInsert: {
        _id: 'meta',
        projectId,
        createdAt: now,
      },
    },
    { upsert: true }
  );
  return { document, updatedAt: now.toISOString(), reviewAudience: aud };
}

/** Id progetto stabile da riga catalogo Mongo. */
function catalogProjectId(rec) {
  if (rec?.projectId != null && String(rec.projectId).trim()) {
    return String(rec.projectId).trim();
  }
  if (rec?._id != null) return String(rec._id).trim();
  return '';
}

function assertReviewToken(req) {
  const expected = String(process.env.AGENT_REVIEW_CHANNEL_TOKEN || '').trim();
  if (!expected) return true;
  const header = req.get('x-review-token') || req.get('X-Review-Token') || '';
  const query = typeof req.query?.token === 'string' ? req.query.token : '';
  const got = String(header || query || '').trim();
  return got === expected;
}

/** Dev locale: niente token dal browser → accetta con il segreto di backend/.env. */
function reviewChannelDevAutoAuthEnabled() {
  const expected = String(process.env.AGENT_REVIEW_CHANNEL_TOKEN || '').trim();
  if (!expected) return false;
  if (process.env.OMNIA_REVIEW_CHANNEL_STRICT_AUTH === '1') return false;
  return process.env.NODE_ENV !== 'production';
}

function isReviewChannelApiPath(pathname) {
  const p = String(pathname || '');
  return (
    p === '/api/agent-review-channels' ||
    p.includes('/review-channel')
  );
}

/**
 * Middleware Express: in dev inietta il token review se il client non lo invia.
 */
function reviewChannelDevAutoAuthMiddleware(req, _res, next) {
  if (!reviewChannelDevAutoAuthEnabled()) return next();
  if (!isReviewChannelApiPath(req.path)) return next();
  if (assertReviewToken(req)) return next();
  req.headers['x-review-token'] = process.env.AGENT_REVIEW_CHANNEL_TOKEN;
  next();
}

/**
 * Elenco di tutti i canali review pubblicati (scan catalogo progetti + project_meta).
 * @param {import('mongodb').MongoClient} mongoClient
 * @param {(client: import('mongodb').MongoClient, projectId: string) => Promise<import('mongodb').Db>} getProjectDbFn
 * @param {string} dbProjectsName
 */
async function listAllReviewChannels(mongoClient, getProjectDbFn, dbProjectsName) {
  const catalogDb = mongoClient.db(dbProjectsName);
  const catalog = await catalogDb.collection('projects_catalog').find({}).toArray();
  const entries = [];

  for (const rec of catalog) {
    const projectId = catalogProjectId(rec);
    if (!projectId) continue;
    try {
      const projDb = await getProjectDbFn(mongoClient, projectId);
      const meta = await projDb.collection('project_meta').findOne({ _id: 'meta' });
      const channels = meta?.agentReviewChannels;
      if (!channels || typeof channels !== 'object' || Array.isArray(channels)) continue;

      const projectLabel = String(
        rec.projectName || rec.clientName || meta?.projectName || meta?.clientName || projectId
      ).trim();

      for (const [taskInstanceId, entry] of Object.entries(channels)) {
        if (!entry || typeof entry !== 'object') continue;

        const pushRow = (doc, metaEntry, audience) => {
          if (!doc || typeof doc !== 'object') return;
          const useCases = doc.useCaseBundle?.use_cases;
          const useCaseCount = Array.isArray(useCases) ? useCases.length : 0;
          const updatedAt =
            metaEntry?.updatedAt instanceof Date
              ? metaEntry.updatedAt.toISOString()
              : typeof metaEntry?.updatedAt === 'string'
                ? metaEntry.updatedAt
                : typeof doc.updatedAt === 'string'
                  ? doc.updatedAt
                  : null;
          entries.push({
            projectId,
            projectLabel,
            taskInstanceId: String(taskInstanceId).trim(),
            taskLabel: String(doc.taskLabel || taskInstanceId).trim(),
            updatedAt,
            useCaseCount,
            reviewAudience: audience,
          });
        };

        if (entry.document && typeof entry.document === 'object') {
          pushRow(entry.document, entry, 'customer');
          continue;
        }

        for (const aud of REVIEW_AUDIENCES) {
          const sub = entry[aud];
          if (sub && typeof sub === 'object') {
            pushRow(sub.document, sub, aud);
          }
        }
      }
    } catch {
      /* progetto assente o DB non raggiungibile */
    }
  }

  const byTask = new Map();
  for (const row of entries) {
    const key = `${row.projectId}:${row.taskInstanceId}`;
    const prev = byTask.get(key);
    if (!prev) {
      byTask.set(key, row);
      continue;
    }
    const prevTs = prev.updatedAt ? Date.parse(prev.updatedAt) : 0;
    const nextTs = row.updatedAt ? Date.parse(row.updatedAt) : 0;
    if (nextTs >= prevTs) {
      byTask.set(key, row);
    }
  }

  const deduped = [...byTask.values()];
  deduped.sort((a, b) => {
    const ta = a.updatedAt ? Date.parse(a.updatedAt) : 0;
    const tb = b.updatedAt ? Date.parse(b.updatedAt) : 0;
    return tb - ta;
  });
  return deduped;
}

module.exports = {
  getReviewChannel,
  putReviewChannel,
  listAllReviewChannels,
  assertReviewToken,
  reviewChannelDevAutoAuthMiddleware,
  computeContentHash,
};
