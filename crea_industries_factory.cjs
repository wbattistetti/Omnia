   
   // Script Node.js per aggiungere SOLO le industries che non esistono già in factory
// Uso: node crea_industries_factory.cjs
// Richiede: npm install mongodb

const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbTest = 'test';
const dbFactory = 'factory';
const collection = 'Industries';

async function main() {
  const client = new MongoClient(uri, { useUnifiedTopology: true });
  try {
    await client.connect();
    const testDb = client.db(dbTest);
    const factoryDb = client.db(dbFactory);

    // Prendi tutti i documenti da test.Industries
    const docs = await testDb.collection(collection).find({}).toArray();
    // Prendi tutti gli industryId già presenti in factory
    const existing = await factoryDb.collection(collection).find({}, { projection: { industryId: 1 } }).toArray();
    const existingIds = new Set(existing.map(doc => doc.industryId));

    // Filtra solo quelli che non esistono già
    const toInsert = docs.filter(doc => !existingIds.has(doc.industryId)).map(doc => {
      const { _id, ...rest } = doc;
      return rest;
    });

    if (toInsert.length > 0) {
      await factoryDb.collection(collection).insertMany(toInsert);
      console.log(`Aggiunte ${toInsert.length} nuove industries in factory.Industries`);
    } else {
      console.log('Nessuna nuova industry da aggiungere.');
    }
  } catch (err) {
    console.error('Errore:', err);
  } finally {
    await client.close();
  }
}

main();

   