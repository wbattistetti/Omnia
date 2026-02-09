/**
 * Script per aggiungere pattern REQUEST_DATA mancanti per italiano
 * Pattern per riconoscere "chiedi la data", "chiedi la data di nascita", ecc.
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbFactory = 'factory';

async function addDataRequestPatterns() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbFactory);
    const coll = db.collection('Heuristics');

    // Pattern esistenti per REQUEST_DATA in italiano (se esistono)
    const existing = await coll.findOne({ _id: 'DataRequest' });
    const existingPatterns = existing?.patterns || {};
    const existingIT = existingPatterns.IT || [];

    // Nuovi pattern da aggiungere per riconoscere richieste di dati
    const newPatterns = [
      'chiedi\\s+(la\\s+)?data',
      'chiedi\\s+(la\\s+)?data\\s+di\\s+nascita',
      'chiedi\\s+(la\\s+)?data\\s+di\\s+nascita\\s+del\\s+paziente',
      "chiedi\\s+(la\\s+)?data\\s+di\\s+nascita\\s+dell['']?utente",
      'chiedi\\s+(la\\s+)?data\\s+di\\s+nascita\\s+del\\s+cliente',
      'richiedi\\s+(la\\s+)?data',
      'richiedi\\s+(la\\s+)?data\\s+di\\s+nascita',
      'domanda\\s+(la\\s+)?data',
      'domanda\\s+(la\\s+)?data\\s+di\\s+nascita',
      'chiedere\\s+(la\\s+)?data',
      'chiedere\\s+(la\\s+)?data\\s+di\\s+nascita',
      'chiedi\\s+data',
      'chiedi\\s+data\\s+di\\s+nascita',
      'chiedi\\s+nascita',
      'chiedi\\s+quando\\s+.*nato',
      'chiedi\\s+quando\\s+.*nata',
      'chiedi\\s+.*data\\s+di\\s+nascita',
      'chiedi\\s+.*data\\s+nascita',
      '.*data\\s+di\\s+nascita.*',
      '.*data\\s+nascita.*'
    ];

    // Rimuovi duplicati (pattern già esistenti)
    const uniqueNewPatterns = newPatterns.filter(p => !existingIT.includes(p));

    if (uniqueNewPatterns.length === 0) {
      console.log('✅ Tutti i pattern sono già presenti nel database');
      return;
    }

    // Combina pattern esistenti con nuovi
    const updatedIT = [...existingIT, ...uniqueNewPatterns];

    // Aggiorna i pattern
    const updatedPatterns = {
      ...existingPatterns,
      IT: updatedIT
    };

    const now = new Date();
    const result = await coll.updateOne(
      { _id: 'DataRequest' },
      {
        $set: {
          patterns: updatedPatterns,
          updatedAt: now
        },
        $setOnInsert: {
          createdAt: now
        }
      },
      { upsert: true }
    );

    if (result.upsertedCount > 0) {
      console.log('✅ Creato nuovo documento Heuristics per DataRequest');
    } else if (result.modifiedCount > 0) {
      console.log('✅ Aggiornati pattern per DataRequest');
    }

    console.log(`✅ Aggiunti ${uniqueNewPatterns.length} nuovi pattern per REQUEST_DATA in italiano:`);
    uniqueNewPatterns.forEach(p => console.log(`   - ${p}`));

    const saved = await coll.findOne({ _id: 'DataRequest' });
    console.log(`\n📊 Pattern totali per REQUEST_DATA (IT): ${saved.patterns.IT.length}`);

  } catch (error) {
    console.error('❌ Errore:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Esegui lo script
if (require.main === module) {
  addDataRequestPatterns()
    .then(() => {
      console.log('\n✅ Script completato con successo');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Script fallito:', error);
      process.exit(1);
    });
}

module.exports = { addDataRequestPatterns };

