/**
 * Script per cancellare tutti i template di tipo 3 (UtteranceInterpretation) dal database Factory
 *
 * ATTENZIONE: Questa operazione è IRREVERSIBILE!
 * Cancella definitivamente tutti i template di tipo 3 dalla collection 'tasks' del database 'factory'
 */

const { MongoClient } = require('mongodb');

// MongoDB connection string
const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';
const TYPE_UTTERANCE_INTERPRETATION = 3;

async function deleteFactoryType3Templates() {
  let client;

  try {
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('🗑️  CANCELLAZIONE TEMPLATE TIPO 3 (UtteranceInterpretation) DAL FACTORY');
    console.log('═══════════════════════════════════════════════════════════════════════════\n');

    console.log('🔌 Connessione a MongoDB...');
    client = new MongoClient(uri);
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const factoryDb = client.db(dbFactory);
    const tasksCollection = factoryDb.collection('tasks');

    // ✅ 1. Conta template di tipo 3 prima della cancellazione
    const countBefore = await tasksCollection.countDocuments({ type: TYPE_UTTERANCE_INTERPRETATION });
    console.log(`📊 Template di tipo 3 trovati: ${countBefore}`);

    if (countBefore === 0) {
      console.log('✅ Nessun template di tipo 3 da cancellare. Database già pulito.\n');
      return;
    }

    // ✅ 2. Mostra alcuni esempi di template che verranno cancellati
    const sampleTemplates = await tasksCollection
      .find({ type: TYPE_UTTERANCE_INTERPRETATION })
      .limit(5)
      .toArray();

    console.log('\n📋 Esempi di template che verranno cancellati:');
    sampleTemplates.forEach((template, idx) => {
      console.log(`   [${idx + 1}] ID: ${template.id || template._id}, Label: ${template.label || 'N/A'}, Name: ${template.name || 'N/A'}`);
    });

    // ✅ 3. Conferma cancellazione
    console.log('\n⚠️  ATTENZIONE: Questa operazione è IRREVERSIBILE!');
    console.log(`   Verranno cancellati ${countBefore} template di tipo 3 dal database Factory.\n`);

    // ✅ 4. Esegui cancellazione
    console.log('🗑️  Esecuzione cancellazione...');
    const deleteResult = await tasksCollection.deleteMany({ type: TYPE_UTTERANCE_INTERPRETATION });

    console.log('✅ Cancellazione completata!');
    console.log(`   Template cancellati: ${deleteResult.deletedCount}`);

    // ✅ 5. Verifica risultato
    const countAfter = await tasksCollection.countDocuments({ type: TYPE_UTTERANCE_INTERPRETATION });
    console.log(`   Template di tipo 3 rimanenti: ${countAfter}`);

    if (countAfter === 0) {
      console.log('\n✅ Database Factory pulito: tutti i template di tipo 3 sono stati cancellati.');
    } else {
      console.warn(`\n⚠️  ATTENZIONE: Rimangono ancora ${countAfter} template di tipo 3 nel database.`);
    }

    console.log('\n═══════════════════════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('\n❌ ERRORE durante la cancellazione:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Disconnesso da MongoDB');
    }
  }
}

// Esegui script
deleteFactoryType3Templates()
  .then(() => {
    console.log('\n✅ Script completato con successo');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script fallito:', error);
    process.exit(1);
  });
