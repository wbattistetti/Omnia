/**
 * Persistenza canale review agente in project_meta.agentReviewChannels[taskInstanceId].
 */

const crypto = require('crypto');

const REVIEW_EXPORT_VERSION = 1;

function stableStringify(value) {
  return JSON.stringify(value);
}

function computeContentHash(payload) {
  const text = stableStringify(payload);
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
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
  const payload = {
    agentDesignDescription: agentDesignDescription.trim(),
    useCaseBundle,
  };
  const now = new Date().toISOString();
  return {
    reviewExportVersion: REVIEW_EXPORT_VERSION,
    projectId: String(projectId || '').trim(),
    taskInstanceId: String(taskInstanceId || '').trim(),
    taskLabel: typeof body.taskLabel === 'string' ? body.taskLabel.trim() : '',
    agentDesignDescription,
    useCaseBundle,
    updatedAt: now,
    contentHash: computeContentHash(payload),
  };
}

function readChannelFromMeta(meta, taskInstanceId) {
  const channels = meta?.agentReviewChannels;
  if (!channels || typeof channels !== 'object') return null;
  const entry = channels[taskInstanceId];
  if (!entry || typeof entry !== 'object') return null;
  const doc = entry.document;
  if (!doc || typeof doc !== 'object') return null;
  return {
    document: doc,
    updatedAt: entry.updatedAt || doc.updatedAt || null,
  };
}

async function getReviewChannel(projDb, projectId, taskInstanceId) {
  const meta = await projDb.collection('project_meta').findOne({ _id: 'meta' });
  const row = readChannelFromMeta(meta, taskInstanceId);
  if (!row) {
    return { document: null, updatedAt: null };
  }
  return row;
}

async function putReviewChannel(projDb, projectId, taskInstanceId, body) {
  const document = normalizeDocument(body, projectId, taskInstanceId);
  const now = new Date();
  const fieldKey = `agentReviewChannels.${taskInstanceId}`;
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
  return { document, updatedAt: now.toISOString() };
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
        if (!entry || typeof entry !== 'object' || !entry.document) continue;
        const doc = entry.document;
        const useCases = doc.useCaseBundle?.use_cases;
        const useCaseCount = Array.isArray(useCases) ? useCases.length : 0;
        const updatedAt =
          entry.updatedAt instanceof Date
            ? entry.updatedAt.toISOString()
            : typeof entry.updatedAt === 'string'
              ? entry.updatedAt
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
        });
      }
    } catch {
      /* progetto assente o DB non raggiungibile */
    }
  }

  entries.sort((a, b) => {
    const ta = a.updatedAt ? Date.parse(a.updatedAt) : 0;
    const tb = b.updatedAt ? Date.parse(b.updatedAt) : 0;
    return tb - ta;
  });
  return entries;
}

module.exports = {
  getReviewChannel,
  putReviewChannel,
  listAllReviewChannels,
  assertReviewToken,
  computeContentHash,
};
