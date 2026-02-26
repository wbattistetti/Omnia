/**
 * Script diretto: Cancella TUTTI i task di tipo 3 e i loro embedding
 * Versione semplificata senza timeout
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function cleanAllType3TasksAndEmbeddings() {
  const client = new MongoClient(uri);

  try {
    console.log('🔄 Connessione a MongoDB...');
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const factoryDb = client.db(dbFactory);
    const tasksCollection = factoryDb.collection('tasks');
    const embeddingsCollection = factoryDb.collection('embeddings');
    const translationsCollection = factoryDb.collection('Translations');

    // 1. Trova tutti i task con type === 3
    console.log('🔍 Ricerca task di tipo 3...');
    const type3Tasks = await tasksCollection.find({ type: 3 }).toArray();
    console.log(`📋 Trovati ${type3Tasks.length} task di tipo 3\n`);

    if (type3Tasks.length === 0) {
      console.log('✅ Nessun task di tipo 3 da cancellare.');

      // Verifica se ci sono embedding che potrebbero essere orfani
      // (solo per informazione, non li cancelliamo automaticamente)
      const allTaskEmbeddings = await embeddingsCollection.find({ type: 'task' }).toArray();
      console.log(`📋 Trovati ${allTaskEmbeddings.length} embedding di tipo 'task' nel database`);

      if (allTaskEmbeddings.length > 0) {
        console.log('⚠️  Nota: Ci sono embedding di tipo "task" ma nessun task di tipo 3.');
        console.log('   Questi embedding potrebbero appartenere ad altri tipi di task.');
        console.log('   Non vengono cancellati automaticamente.');
      }

      return;
    }

    // 2. Estrai ID dei task
    const taskIds = type3Tasks.map(task => task.id || task._id?.toString()).filter(Boolean);
    console.log(`📝 Cancellazione di ${taskIds.length} task...`);

    // 3. Trova embedding corrispondenti
    const correspondingEmbeddings = await embeddingsCollection.find({
      id: { $in: taskIds },
      type: 'task'
    }).toArray();
    console.log(`📋 Trovati ${correspondingEmbeddings.length} embedding corrispondenti`);

    // 4. Trova traduzioni corrispondenti (GUID che corrispondono agli ID dei task)
    const correspondingTranslations = await translationsCollection.find({
      guid: { $in: taskIds },
      $or: [
        { projectId: null },
        { projectId: { $exists: false } }
      ]
    }).toArray();
    console.log(`📋 Trovate ${correspondingTranslations.length} traduzioni corrispondenti\n`);

    // 4. Cancella i task
    console.log('🗑️  Cancellazione task di tipo 3...');
    const deleteTasksResult = await tasksCollection.deleteMany({ type: 3 });
    console.log(`✅ Cancellati ${deleteTasksResult.deletedCount} task di tipo 3`);

    // 5. Cancella gli embedding
    if (correspondingEmbeddings.length > 0) {
      console.log('🗑️  Cancellazione embedding...');
      const deleteEmbeddingsResult = await embeddingsCollection.deleteMany({
        id: { $in: taskIds },
        type: 'task'
      });
      console.log(`✅ Cancellati ${deleteEmbeddingsResult.deletedCount} embedding`);
    }

    // 6. Cancella le traduzioni
    if (correspondingTranslations.length > 0) {
      console.log('🗑️  Cancellazione traduzioni...');
      const deleteTranslationsResult = await translationsCollection.deleteMany({
        guid: { $in: taskIds },
        $or: [
          { projectId: null },
          { projectId: { $exists: false } }
        ]
      });
      console.log(`✅ Cancellate ${deleteTranslationsResult.deletedCount} traduzioni`);
    }

    // 7. Verifica finale
    const remainingTasks = await tasksCollection.countDocuments({ type: 3 });
    const remainingEmbeddings = await embeddingsCollection.countDocuments({ type: 'task' });
    const remainingTranslations = await translationsCollection.countDocuments({
      guid: { $in: taskIds },
      $or: [
        { projectId: null },
        { projectId: { $exists: false } }
      ]
    });

    console.log(`\n📊 Verifica finale:`);
    console.log(`   Task di tipo 3 rimasti: ${remainingTasks}`);
    console.log(`   Embedding di tipo 'task' rimasti: ${remainingEmbeddings}`);
    console.log(`   Traduzioni rimaste: ${remainingTranslations}`);

    if (remainingTasks === 0 && remainingEmbeddings === 0 && remainingTranslations === 0) {
      console.log('\n✅ Pulizia completata con successo!');
    }

  } catch (error) {
    console.error('❌ ERRORE:', error.message);
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
