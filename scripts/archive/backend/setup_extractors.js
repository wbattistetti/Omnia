/*
 Simple one-shot initializer for centralized Data-Extraction Contracts ("Extractors") in the factory DB.
 Usage (Windows PowerShell or WSL):
   node backend/setup_extractors.js
 It will create collections and seed initial docs for address.it and phone.it if absent.
*/

const { MongoClient } = require('mongodb');

// Reuse the same Atlas URI used by Express backend
const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const DB_FACTORY = 'factory';

async function ensureCollections(db) {
  const names = new Set((await db.listCollections().toArray()).map(c => c.name));
  if (!names.has('Extractors')) {
    await db.createCollection('Extractors');
    await db.collection('Extractors').createIndex({ kind: 1, locale: 1, version: -1 }, { unique: false });
    await db.collection('Extractors').createIndex({ active: 1 });
  }
  if (!names.has('ExtractorBindings')) {
    await db.createCollection('ExtractorBindings');
    await db.collection('ExtractorBindings').createIndex({ scope: 1, targetId: 1, kind: 1, locale: 1 }, { unique: true });
  }
}

function seedDocs() {
  const now = new Date().toISOString();
  return [
    {
      _id: 'address.it.v1',
      kind: 'address',
      locale: 'it',
      version: 1,
      active: true,
      engine: 'libpostal+rules',
      preNormalize: { rules: ['collapseSpaces', 'lowerPrepositions'] },
      postSanitize: {
        rules: [
          'stripLeadingPrepositions',
          'cityInStreetToCity',
          'moveTrailingNumberToHouse',
          'moveCapFromStreet',
          'titleCaseFields',
          'dedupeCountry'
        ]
      },
      options: {
        stripLeadingPrepositions: true,
        moveTrailingNumber: true,
        capFromStreet: true
      },
      tests: [
        {
          text: 'residente ad Acqui Terme in via Chiabrera 20, cap 15011 Italia',
          expected: { street: 'Via Chiabrera', number: '20', city: 'Acqui Terme', postal_code: '15011', country: 'Italy' }
        }
      ],
      createdAt: now,
      updatedAt: now
    },
    {
      _id: 'phone.it.v1',
      kind: 'phone',
      locale: 'it',
      version: 1,
      active: true,
      engine: 'regex+normalize',
      preNormalize: { rules: ['stripSpacesAndDashes'] },
      postSanitize: { rules: ['ensureCountryPrefixOptional'] },
      options: { defaultCountryCode: '+39' },
      tests: [
        { text: 'il mio cellulare è 393 920 8239', expected: { number: '3939208239' } },
        { text: 'telefono: +39 393-920-8239', expected: { number: '+393939208239' } }
      ],
      createdAt: now,
      updatedAt: now
    },
    {
      _id: 'email.it.v1',
      kind: 'email',
      locale: 'it',
      version: 1,
      active: true,
      engine: 'regex',
      preNormalize: { rules: ['collapseSpaces'] },
      postSanitize: { rules: [] },
      options: {},
      tests: [
        { text: 'la mia email è mario.rossi@example.com', expected: { email: 'mario.rossi@example.com' } }
      ],
      createdAt: now,
      updatedAt: now
    },
    {
      _id: 'date.it.v1',
      kind: 'date',
      locale: 'it',
      version: 1,
      active: true,
      engine: 'regex+rules',
      preNormalize: { rules: ['collapseSpaces'] },
      postSanitize: { rules: ['normalizeTwoDigitYear'] },
      options: { formats: ['dd/mm/yyyy', 'd/m/yyyy', 'dd-mm-yyyy'] },
      tests: [
        { text: 'nato il 16/12/1961', expected: { day: 16, month: 12, year: 1961 } },
        { text: 'il 16 dicembre 1961', expected: { day: 16, month: 12, year: 1961 } }
      ],
      createdAt: now,
      updatedAt: now
    },
    {
      _id: 'name.it.v1',
      kind: 'name',
      locale: 'it',
      version: 1,
      active: true,
      engine: 'heuristic',
      preNormalize: { rules: ['collapseSpaces'] },
      postSanitize: { rules: ['titleCaseFields'] },
      options: { patterns: ['mi chiamo <first> <last>', 'nome è <first> <last>'] },
      tests: [
        { text: 'mi chiamo Mario Rossi', expected: { firstname: 'Mario', lastname: 'Rossi' } }
      ],
      createdAt: now,
      updatedAt: now
    },
    {
      _id: 'number.it.v1',
      kind: 'number',
      locale: 'it',
      version: 1,
      active: true,
      engine: 'regex',
      preNormalize: { rules: ['stripSpacesExceptDecimal'] },
      postSanitize: { rules: [] },
      options: { allowDecimal: true },
      tests: [
        { text: 'valore 123.45', expected: { value: 123.45 } }
      ],
      createdAt: now,
      updatedAt: now
    },
    {
      _id: 'text.it.v1',
      kind: 'text',
      locale: 'it',
      version: 1,
      active: true,
      engine: 'passthrough',
      preNormalize: { rules: ['trim'] },
      postSanitize: { rules: [] },
      options: {},
      tests: [ { text: 'qualunque descrizione', expected: { value: 'qualunque descrizione' } } ],
      createdAt: now,
      updatedAt: now
    }
  ];
}

async function upsertIfMissing(coll, doc) {
  const existing = await coll.findOne({ _id: doc._id });
  if (!existing) {
    await coll.insertOne(doc);
    console.log('Inserted', doc._id);
  } else {
    console.log('Exists   ', doc._id);
  }
}

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(DB_FACTORY);
    await ensureCollections(db);
    const extractors = db.collection('Extractors');
    const bindings = db.collection('ExtractorBindings');

    for (const d of seedDocs()) {
      // defensive: stamp fields to ensure shape
      await upsertIfMissing(extractors, d);
    }

    // Global bindings (apply to all projects by default)
    const bindingDocs = [
      { scope: 'global', targetId: '*', kind: 'address', locale: 'it', extractorId: 'address.it.v1' },
      { scope: 'global', targetId: '*', kind: 'phone', locale: 'it', extractorId: 'phone.it.v1' },
      { scope: 'global', targetId: '*', kind: 'email', locale: 'it', extractorId: 'email.it.v1' },
      { scope: 'global', targetId: '*', kind: 'date', locale: 'it', extractorId: 'date.it.v1' },
      { scope: 'global', targetId: '*', kind: 'name', locale: 'it', extractorId: 'name.it.v1' },
      { scope: 'global', targetId: '*', kind: 'number', locale: 'it', extractorId: 'number.it.v1' },
      { scope: 'global', targetId: '*', kind: 'text', locale: 'it', extractorId: 'text.it.v1' }
    ];
    for (const b of bindingDocs) {
      await bindings.updateOne(
        { scope: b.scope, targetId: b.targetId, kind: b.kind, locale: b.locale },
        { $setOnInsert: { ...b, createdAt: new Date().toISOString() } },
        { upsert: true }
      );
    }
    console.log('Bindings ensured');
  } finally {
    await client.close();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });


