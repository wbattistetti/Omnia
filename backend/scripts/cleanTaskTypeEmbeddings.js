/**
 * Script: Rimuove embeddings TaskType esistenti prima di rigenerarli
 *
 * Questo script:
 * 1. Verifica quanti embeddings type='taskType' esistono
 * 2. Li rimuove dal database
 * 3. Permette di rigenerarli con generateTaskTypeEmbeddings.js
 *
 * Usage:
 *   node cleanTaskTypeEmbeddings.js [--confirm]
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function cleanTaskTypeEmbeddings() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const factoryDb = client.db(dbFactory);
    const embeddingsCollection = factoryDb.collection('embeddings');

    // 1. Conta embeddings type='taskType'
    const count = await embeddingsCollection.countDocuments({ type: 'taskType' });
    console.log(`📋 Trovati ${count} embedding(s) con type='taskType'\n`);

    if (count === 0) {
      console.log('✅ Nessun embedding TaskType da rimuovere.');
      return;
    }

    // 2. Mostra alcuni esempi
    const examples = await embeddingsCollection.find({ type: 'taskType' }).limit(5).toArray();
    console.log('📝 Esempi di embeddings che verranno rimossi:');
    examples.forEach((emb, i) => {
      console.log(`   ${i + 1}. ${emb.id} - "${emb.text}" (taskType: ${emb.taskType})`);
    });
    if (count > 5) {
      console.log(`   ... e altri ${count - 5} embedding(s)\n`);
    } else {
      console.log('');
    }

    // 3. Verifica flag --confirm
    const args = process.argv.slice(2);
    const isConfirm = args.includes('--confirm');

    if (!isConfirm) {
      console.log('⚠️  DRY RUN: Nessuna modifica effettuata.');
      console.log('   Per rimuovere gli embeddings, usa: node cleanTaskTypeEmbeddings.js --confirm\n');
      return;
    }

    // 4. Conferma e attesa
    console.log('⚠️  ATTENZIONE: Stai per rimuovere tutti gli embeddings TaskType!');
    console.log('   Premi Ctrl+C entro 5 secondi per annullare...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 5. Rimuovi embeddings
    console.log('🗑️  Rimozione embeddings TaskType...');
    const result = await embeddingsCollection.deleteMany({ type: 'taskType' });
    console.log(`✅ Rimossi ${result.deletedCount} embedding(s) TaskType\n`);

    // 6. Verifica finale
    const remainingCount = await embeddingsCollection.countDocuments({ type: 'taskType' });
    if (remainingCount === 0) {
      console.log('✅ Verifica: Nessun embedding TaskType rimasto nel database');
      console.log('   Puoi ora rigenerarli con: node generateTaskTypeEmbeddings.js\n');
    } else {
      console.log(`⚠️  Attenzione: Rimangono ancora ${remainingCount} embedding(s) TaskType`);
    }

  } catch (error) {
    console.error('❌ ERRORE:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('✅ Connessione chiusa');
  }
}

if (require.main === module) {
  cleanTaskTypeEmbeddings();
}

module.exports = { cleanTaskTypeEmbeddings };
