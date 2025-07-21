

// Script per eliminare i duplicati nella collection Translations (db: factory)
// Tiene solo il primo documento per ogni chiave 'key'
// Uso: node deduplica_translations.cjs
// Richiede: npm install mongodb

const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbName = 'factory';
const collection = 'Translations';

async function main() {
  const client = new MongoClient(uri, { useUnifiedTopology: true });
  try {
    await client.connect();
    const db = client.db(dbName);

    // Trova tutte le chiavi duplicate
    const duplicates = await db.collection(collection).aggregate([
      { $group: { _id: "$key", ids: { $push: "$_id" }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();

    let totalRemoved = 0;

    for (const dup of duplicates) {
      // Tieni solo il primo _id, elimina gli altri
      const [keep, ...toDelete] = dup.ids;
      if (toDelete.length > 0) {
        const result = await db.collection(collection).deleteMany({ _id: { $in: toDelete } });
        console.log(`Eliminati ${result.deletedCount} duplicati per la chiave: ${dup._id}`);
        totalRemoved += result.deletedCount;
      }
    }

    if (totalRemoved === 0) {
      console.log('Nessun duplicato trovato!');
    } else {
      console.log(`Totale duplicati eliminati: ${totalRemoved}`);
    }
  } catch (err) {
    console.error('Errore:', err);
  } finally {
    await client.close();
  }
}

main();