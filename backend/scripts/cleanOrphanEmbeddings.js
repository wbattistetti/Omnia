// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Script: Pulisce embedding orfani (embedding senza template corrispondente)
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function cleanOrphanEmbeddings() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isConfirm = args.includes('--confirm');

  if (!isDryRun && !isConfirm) {
    console.error('❌ ERRORE: Devi specificare --dry-run o --confirm');
    console.log('\nUsage:');
    console.log('  node cleanOrphanEmbeddings.js --dry-run    # Solo visualizza');
    console.log('  node cleanOrphanEmbeddings.js --confirm    # Elimina embedding orfani');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const factoryDb = client.db(dbFactory);
    const tasksCollection = factoryDb.collection('tasks');
    const embeddingsCollection = factoryDb.collection('embeddings');

    // 1. Carica tutti i task e crea un Set di ID validi
    const allTasks = await tasksCollection.find({}).toArray();
    const validTaskIds = new Set();

    allTasks.forEach(task => {
      const id = task.id || task._id?.toString();
      if (id) {
        validTaskIds.add(id);
      }
    });

    console.log(`📋 Task validi nel database: ${validTaskIds.size}\n`);

    // 2. Carica tutti gli embedding di tipo 'task'
    const allEmbeddings = await embeddingsCollection.find({ type: 'task' }).toArray();
    console.log(`📋 Embedding totali nel database: ${allEmbeddings.length}\n`);

    // 3. Trova embedding orfani
    const orphanEmbeddings = [];
    const validEmbeddings = [];

    allEmbeddings.forEach(emb => {
      if (!validTaskIds.has(emb.id)) {
        orphanEmbeddings.push(emb);
      } else {
        validEmbeddings.push(emb);
      }
    });

    console.log(`📊 Statistiche embedding:`);
    console.log(`   ✅ Valid (con template corrispondente): ${validEmbeddings.length}`);
    console.log(`   ❌ Orphan (senza template): ${orphanEmbeddings.length}\n`);

    if (orphanEmbeddings.length > 0) {
      console.log(`📝 Embedding orfani (primi 10):\n`);
      orphanEmbeddings.slice(0, 10).forEach((emb, index) => {
        console.log(`  ${index + 1}. ID: ${emb.id}`);
        console.log(`     Text: "${emb.text || 'N/A'}"`);
        console.log(`     OriginalText: "${emb.originalText || 'N/A'}"`);
        console.log('');
      });

      if (orphanEmbeddings.length > 10) {
        console.log(`  ... e altri ${orphanEmbeddings.length - 10} embedding orfani\n`);
      }
    }

    if (isDryRun) {
      console.log('🔍 DRY RUN: Nessuna modifica effettuata.');
      console.log('   Per eliminare gli embedding orfani, usa: --confirm');
      return;
    }

    if (isConfirm && orphanEmbeddings.length > 0) {
      console.log('\n⚠️  ATTENZIONE: Stai per eliminare embedding orfani!');
      console.log('   Premi Ctrl+C entro 5 secondi per annullare...\n');

      await new Promise(resolve => setTimeout(resolve, 5000));

      let deletedCount = 0;
      let errorCount = 0;

      for (const emb of orphanEmbeddings) {
        try {
          const result = await embeddingsCollection.deleteOne({ id: emb.id, type: 'task' });
          if (result.deletedCount > 0) {
            deletedCount++;
            console.log(`✅ Eliminato embedding orfano: ${emb.id}`);
          }
        } catch (error) {
          console.error(`❌ Errore eliminando embedding ${emb.id}: ${error.message}`);
          errorCount++;
        }
      }

      console.log(`\n✅ Pulizia completata:`);
      console.log(`   Eliminati: ${deletedCount}`);
      console.log(`   Errori: ${errorCount}`);
    } else if (orphanEmbeddings.length === 0) {
      console.log('\n✅ Nessun embedding orfano trovato.');
    }

  } catch (error) {
    console.error('❌ ERRORE:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✅ Connessione chiusa');
  }
}

cleanOrphanEmbeddings();
