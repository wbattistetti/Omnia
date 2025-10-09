// backend/tools/check_factory_agentActs.js
const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const DB = 'factory';
const COLL = 'AgentActs';

const RE_REQ = /(ask|asks|request|requests)\b/i;
const RE_CONF = /(confirm|confirmation|verify|verification|check(?!out)|validate|validation)\b/i;

function getText(a) { return String(a?.name || a?.label || '').trim(); }

function expectedMode(a) {
  const t = getText(a).toLowerCase();
  if (!t) return 'Message';
  if (RE_CONF.test(t)) return 'DataConfirmation';
  if (RE_REQ.test(t)) return 'DataRequest';
  return 'Message';
}

(async () => {
  const client = new MongoClient(URI);
  try {
    await client.connect();
    const coll = client.db(DB).collection(COLL);

    const acts = await coll.find({}, { projection: { _id: 1, id: 1, name: 1, label: 1, mode: 1 } }).toArray();
    console.log(`[CHECK] Total AgentActs: ${acts.length}`);

    const withKeywords = acts.filter(a => {
      const t = getText(a);
      return RE_REQ.test(t) || RE_CONF.test(t);
    });
    console.log(`[CHECK] With keywords (ask/asks/request/confirm/verify/check/validate): ${withKeywords.length}`);

    let mismatches = 0;
    const rows = withKeywords.map(a => {
      const text = getText(a);
      const exp = expectedMode(a);
      const cur = a.mode || 'Message';
      const ok = cur === exp;
      if (!ok) mismatches++;
      return { _id: String(a._id), id: a.id || '', text, mode: cur, expected: exp, ok };
    });

    console.table(rows.slice(0, 50));
    console.log(`[CHECK] Mismatches: ${mismatches}/${withKeywords.length}`);

    // Conteggi utili
    const countByMode = acts.reduce((acc, a) => {
      const m = a.mode || 'Message';
      acc[m] = (acc[m] || 0) + 1;
      return acc;
    }, {});
    console.log('[CHECK] Count by mode:', countByMode);

  } catch (e) {
    console.error('[CHECK] error', e);
    process.exit(1);
  } finally {
    await client.close();
  }
})();