/**
 * MongoDB migration — Factory `Translations` collection: bare UUID `guid` → canonical `kind:uuid`.
 *
 * Usage:
 *   set MONGODB_URI (or FACTORY_URI) and optional FACTORY_DB_NAME (default: read from env or `omnia_factory`)
 *   node scripts/migrate-factory-translation-keys.mjs
 *
 * Mapping by `type` (adjust to your schema):
 *   variable | Variable → variable:<uuid>
 *   task | Instance | LABEL (prompt) → task:<uuid>
 *   slot | Slot → slot:<uuid>
 *   flow | Flow → flow:<uuid>
 *   interface | Interface → interface:<uuid>
 *
 * Does not migrate embedded task JSON; run a separate pass if escalation params store bare UUIDs.
 */

import { MongoClient } from 'mongodb';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isBareUuid(s) {
  return typeof s === 'string' && !s.includes(':') && UUID.test(s.trim());
}

function kindForType(t) {
  const x = String(t || '').toLowerCase();
  if (x === 'variable' || x === 'variableinstance') return 'variable';
  if (x === 'slot') return 'slot';
  if (x === 'flow') return 'flow';
  if (x === 'interface') return 'interface';
  if (x === 'instance' || x === 'label' || x === 'task') return 'task';
  return 'variable';
}

function prefixed(kind, guid) {
  return `${kind}:${String(guid).trim().toLowerCase()}`;
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.FACTORY_URI;
  if (!uri) {
    console.error('Set MONGODB_URI or FACTORY_URI');
    process.exit(1);
  }
  const dbName = process.env.FACTORY_DB_NAME || 'omnia_factory';
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const coll = db.collection('Translations');

  const cursor = coll.find({
    guid: { $regex: /^[0-9a-f]{8}-/i },
  });

  let updated = 0;
  let skipped = 0;
  for await (const doc of cursor) {
    const g = doc.guid;
    if (!isBareUuid(g)) {
      skipped++;
      continue;
    }
    const kind = kindForType(doc.type);
    const newGuid = prefixed(kind, g);
    await coll.updateOne({ _id: doc._id }, { $set: { guid: newGuid } });
    updated++;
  }

  console.log(`[migrate-factory-translation-keys] db=${dbName} updated=${updated} skippedNonBare=${skipped}`);
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
