// crea_factory_dbs.js
const { MongoClient } = require('mongodb');

// INSERISCI QUI la tua connection string Atlas
const uri = 'mongodb+srv://walterbattistetti:pjzO17ATFg0uU6mf@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';


// Elenco delle industry principali
const industries = [
  'utility_gas',
  'utility_water',
  'energy',
  'banking',
  'insurance',
  'telecom',
  'healthcare',
  'manufacturing',
  'retail',
  'transportation'
];

// Collezioni fondamentali per ogni db di fabbrica
const factoryCollections = [
  'DataDialogueTemplates',
  'AgentActs',
  'UserActs',
  'BackendCalls',
  'Conditions',
  'Actions',
  'Variables',
  'Translations',
  'Flows'
];

// Definizione dei database da creare
const databases = [
  { name: 'factory', collections: factoryCollections },
  ...industries.map(ind => ({
    name: `factory_${ind}`,
    collections: factoryCollections
  }))
];

async function createDatabases() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    for (const dbDef of databases) {
      const db = client.db(dbDef.name);
      for (const coll of dbDef.collections) {
        const collections = await db.listCollections({ name: coll }).toArray();
        if (collections.length === 0) {
          await db.createCollection(coll);
          console.log(`Creata collezione ${coll} nel database ${dbDef.name}`);
        } else {
          console.log(`Collezione ${coll} già esistente in ${dbDef.name}`);
        }
      }
    }
    console.log('Tutti i database e le collezioni sono stati creati!');
  } catch (err) {
    console.error('Errore:', err);
  } finally {
    await client.close();
  }
}

createDatabases();









