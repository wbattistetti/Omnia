/**
 * Script: Cancella TUTTI i task di tipo 3 (UtteranceInterpretation) e i loro embedding
 * Versione migliorata con output dettagliato
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function cleanAllType3TasksAndEmbeddings() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isConfirm = args.includes('--confirm');

  if (!isDryRun && !isConfirm) {
    console.error('❌ ERRORE: Devi specificare --dry-run o --confirm');
    console.log('\nUsage:');
    console.log('  node cleanAllType3TasksAndEmbeddings_v2.js --dry-run    # Solo visualizza');
    console.log('  node cleanAllType3TasksAndEmbeddings_v2.js --confirm    # Esegue cancellazione');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    console.log('🔄 Connessione a MongoDB...');
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const factoryDb = client.db(dbFactory);
    const tasksCollection = factoryDb.collection('tasks');
    const embeddingsCollection = factoryDb.collection('embeddings');

    // 1. Trova tutti i task con type === 3
    console.log('🔍 Ricerca task di tipo 3...');
    const type3Tasks = await tasksCollection.find({
      type: 3
    }).toArray();

    console.log(`📋 Trovati ${type3Tasks.length} task di tipo 3 (UtteranceInterpretation)\n`);

    if (type3Tasks.length === 0) {
      console.log('✅ Nessun task di tipo 3 da cancellare. Database già pulito.');

      // Verifica anche gli embedding
      const type3Embeddings = await embeddingsCollection.find({ type: 'task' }).toArray();
      console.log(`📋 Trovati ${type3Embeddings.length} embedding di tipo 'task' nel database`);

      if (type3Embeddings.length > 0) {
        console.log('⚠️  Attenzione: Ci sono embedding ma nessun task di tipo 3. Questi sono embedding orfani.');
        if (isConfirm) {
          console.log('\n⚠️  Stai per eliminare TUTTI gli embedding di tipo "task"!');
          console.log('   Premi Ctrl+C entro 5 secondi per annullare...\n');
          await new Promise(resolve => setTimeout(resolve, 5000));

          const deleteEmbeddingsResult = await embeddingsCollection.deleteMany({ type: 'task' });
          console.log(`\n✅ Eliminati ${deleteEmbeddingsResult.deletedCount} embedding orfani`);
        }
      }

      return;
    }

    // 2. Estrai tutti gli ID dei task di tipo 3
    const taskIds = type3Tasks.map(task => task.id || task._id?.toString()).filter(Boolean);
    console.log(`📝 ID dei task che verranno cancellati (primi 10):`);
    taskIds.slice(0, 10).forEach((id, index) => {
      const task = type3Tasks.find(t => (t.id || t._id?.toString()) === id);
      console.log(`  ${index + 1}. ${id} - "${task?.label || 'N/A'}"`);
    });
    if (taskIds.length > 10) {
      console.log(`  ... e altri ${taskIds.length - 10} task\n`);
    }

    // 3. Trova gli embedding corrispondenti
    console.log('🔍 Ricerca embedding corrispondenti...');
    const correspondingEmbeddings = await embeddingsCollection.find({
      id: { $in: taskIds },
      type: 'task'
    }).toArray();

    console.log(`\n📋 Trovati ${correspondingEmbeddings.length} embedding corrispondenti ai task di tipo 3\n`);

    if (isDryRun) {
      console.log('🔍 DRY RUN: Nessuna modifica effettuata.');
      console.log(`   Verrebbero cancellati:`);
      console.log(`   - ${type3Tasks.length} task di tipo 3`);
      console.log(`   - ${correspondingEmbeddings.length} embedding corrispondenti`);
      console.log('   Per eseguire la cancellazione, usa: --confirm');
      return;
    }

    if (isConfirm) {
      console.log('\n⚠️  ATTENZIONE: Stai per cancellare:');
      console.log(`   - ${type3Tasks.length} task di tipo 3 dal database factory`);
      console.log(`   - ${correspondingEmbeddings.length} embedding corrispondenti`);
      console.log('   Premi Ctrl+C entro 5 secondi per annullare...\n');

      await new Promise(resolve => setTimeout(resolve, 5000));

      // 4. Cancella i task
      console.log('🗑️  Cancellazione task di tipo 3...');
      const deleteTasksResult = await tasksCollection.deleteMany({
        type: 3
      });
      console.log(`✅ Cancellati ${deleteTasksResult.deletedCount} task di tipo 3 dal database factory`);

      // 5. Cancella gli embedding corrispondenti
      if (correspondingEmbeddings.length > 0) {
        console.log('🗑️  Cancellazione embedding corrispondenti...');
        const deleteEmbeddingsResult = await embeddingsCollection.deleteMany({
          id: { $in: taskIds },
          type: 'task'
        });
        console.log(`✅ Cancellati ${deleteEmbeddingsResult.deletedCount} embedding corrispondenti`);
      }

      // 6. Verifica che siano stati cancellati
      console.log('🔍 Verifica finale...');
      const remainingTasks = await tasksCollection.countDocuments({ type: 3 });
      const remainingEmbeddings = await embeddingsCollection.countDocuments({ type: 'task' });

      console.log(`\n📊 Verifica finale:`);
      if (remainingTasks === 0) {
        console.log('✅ Nessun task di tipo 3 rimasto nel database');
      } else {
        console.log(`⚠️  Attenzione: Rimangono ancora ${remainingTasks} task di tipo 3 nel database`);
      }

      if (remainingEmbeddings === 0) {
        console.log('✅ Nessun embedding di tipo "task" rimasto nel database');
      } else {
        console.log(`⚠️  Attenzione: Rimangono ancora ${remainingEmbeddings} embedding di tipo "task" nel database`);
        console.log('   Questi potrebbero essere embedding orfani o appartenere ad altri tipi di task');
      }
    }

  } catch (error) {
    console.error('❌ ERRORE:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✅ Connessione chiusa');
  }
}

cleanAllType3TasksAndEmbeddings().catch(error => {
  console.error('❌ ERRORE FATALE:', error);
  process.exit(1);
});
