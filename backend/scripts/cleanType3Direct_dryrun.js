/**
 * Script DRY-RUN: Mostra cosa verrebbe cancellato SENZA cancellare nulla
 * Per eseguire la cancellazione reale, usa cleanType3Direct.js
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';
const DRY_RUN = true; // ✅ DRY RUN MODE - Nessuna cancellazione reale

async function dryRunCleanType3() {
  const client = new MongoClient(uri);

  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 DRY RUN MODE - Nessuna cancellazione verrà eseguita');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('🔄 Connessione a MongoDB...');
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const factoryDb = client.db(dbFactory);
    const tasksCollection = factoryDb.collection('tasks');
    const embeddingsCollection = factoryDb.collection('embeddings');
    const translationsCollection = factoryDb.collection('Translations');

    // ✅ VERIFICA SICUREZZA: Conta tutti i task per tipo
    console.log('🔍 Verifica sicurezza: conteggio task per tipo...');
    const allTasks = await tasksCollection.find({}).toArray();
    const tasksByType = {};
    allTasks.forEach(task => {
      const type = task.type !== undefined ? task.type : 'undefined';
      tasksByType[type] = (tasksByType[type] || 0) + 1;
    });
    console.log('📊 Task totali nel database Factory:');
    Object.keys(tasksByType).sort().forEach(type => {
      const count = tasksByType[type];
      const marker = type === 3 ? ' ⚠️  (VERREBBERO CANCELLATI)' : ' ✅ (NON toccati)';
      console.log(`   Type ${type}: ${count} task${marker}`);
    });
    console.log('');

    // 1. Trova tutti i task con type === 3
    console.log('🔍 Ricerca task di tipo 3...');
    const type3Tasks = await tasksCollection.find({ type: 3 }).toArray();
    console.log(`📋 Trovati ${type3Tasks.length} task di tipo 3\n`);

    if (type3Tasks.length === 0) {
      console.log('✅ Nessun task di tipo 3 da cancellare.');

      // Verifica se ci sono embedding che potrebbero essere orfani
      const allTaskEmbeddings = await embeddingsCollection.find({ type: 'task' }).toArray();
      console.log(`📋 Trovati ${allTaskEmbeddings.length} embedding di tipo 'task' nel database`);

      if (allTaskEmbeddings.length > 0) {
        console.log('⚠️  Nota: Ci sono embedding di tipo "task" ma nessun task di tipo 3.');
        console.log('   Questi embedding potrebbero appartenere ad altri tipi di task.');
      }

      return;
    }

    // 2. Estrai ID dei task
    const taskIds = type3Tasks.map(task => task.id || task._id?.toString()).filter(Boolean);

    // 3. Trova embedding corrispondenti
    const correspondingEmbeddings = await embeddingsCollection.find({
      id: { $in: taskIds },
      type: 'task'
    }).toArray();

    // 4. Trova traduzioni corrispondenti (SOLO factory, NON progetti)
    const correspondingTranslations = await translationsCollection.find({
      guid: { $in: taskIds },
      $or: [
        { projectId: null },
        { projectId: { $exists: false } }
      ]
    }).toArray();

    // ✅ RIEPILOGO DETTAGLIATO
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 RIEPILOGO: Cosa VERREBBE cancellato (DRY RUN)');
    console.log('═══════════════════════════════════════════════════════════');

    console.log(`\n🗑️  Task di tipo 3: ${type3Tasks.length}`);
    if (type3Tasks.length > 0) {
      console.log('   Dettagli (primi 10):');
      type3Tasks.slice(0, 10).forEach((task, idx) => {
        const label = task.label || task.name || 'N/A';
        const id = task.id || task._id?.toString() || 'N/A';
        const createdAt = task.createdAt ? new Date(task.createdAt).toISOString().split('T')[0] : 'N/A';
        console.log(`   ${idx + 1}. "${label.substring(0, 50)}"`);
        console.log(`      id: ${id}`);
        console.log(`      created: ${createdAt}`);
      });
      if (type3Tasks.length > 10) {
        console.log(`   ... e altri ${type3Tasks.length - 10} task`);
      }
    }

    console.log(`\n🗑️  Embedding corrispondenti: ${correspondingEmbeddings.length}`);
    if (correspondingEmbeddings.length > 0) {
      console.log('   Dettagli (primi 5):');
      correspondingEmbeddings.slice(0, 5).forEach((emb, idx) => {
        const text = emb.text || emb.originalText || 'N/A';
        const model = emb.model || 'N/A';
        console.log(`   ${idx + 1}. id: ${emb.id}`);
        console.log(`      text: "${text.substring(0, 60)}"`);
        console.log(`      model: ${model}`);
      });
      if (correspondingEmbeddings.length > 5) {
        console.log(`   ... e altri ${correspondingEmbeddings.length - 5} embedding`);
      }
    } else {
      console.log('   ⚠️  Nessun embedding trovato per questi task');
    }

    console.log(`\n🗑️  Traduzioni Factory corrispondenti: ${correspondingTranslations.length}`);
    if (correspondingTranslations.length > 0) {
      // Raggruppa per guid per vedere quante traduzioni per task
      const translationsByGuid = {};
      correspondingTranslations.forEach(trans => {
        const guid = trans.guid || 'unknown';
        if (!translationsByGuid[guid]) {
          translationsByGuid[guid] = [];
        }
        translationsByGuid[guid].push(trans);
      });

      console.log(`   Traduzioni per ${Object.keys(translationsByGuid).length} task diversi`);
      console.log('   Dettagli (primi 5 task):');
      Object.keys(translationsByGuid).slice(0, 5).forEach((guid, idx) => {
        const transList = translationsByGuid[guid];
        const locales = [...new Set(transList.map(t => t.locale || 'N/A'))].join(', ');
        console.log(`   ${idx + 1}. guid: ${guid}`);
        console.log(`      traduzioni: ${transList.length} (locales: ${locales})`);
      });
      if (Object.keys(translationsByGuid).length > 5) {
        console.log(`   ... e altri ${Object.keys(translationsByGuid).length - 5} task con traduzioni`);
      }
    } else {
      console.log('   ⚠️  Nessuna traduzione trovata per questi task');
    }

    // ✅ VERIFICA SICUREZZA
    const otherTasksCount = allTasks.length - type3Tasks.length;
    const allEmbeddingsCount = await embeddingsCollection.countDocuments({ type: 'task' });
    const allFactoryTranslationsCount = await translationsCollection.countDocuments({
      $or: [
        { projectId: null },
        { projectId: { $exists: false } }
      ]
    });

    console.log(`\n✅ VERIFICA SICUREZZA:`);
    console.log(`   Task di tipo 3 da cancellare: ${type3Tasks.length}`);
    console.log(`   Altri task (NON toccati): ${otherTasksCount}`);
    console.log(`   Embedding totali di tipo 'task': ${allEmbeddingsCount}`);
    console.log(`   Embedding da cancellare: ${correspondingEmbeddings.length}`);
    console.log(`   Embedding che rimarrebbero: ${allEmbeddingsCount - correspondingEmbeddings.length}`);
    console.log(`   Traduzioni Factory totali: ${allFactoryTranslationsCount}`);
    console.log(`   Traduzioni da cancellare: ${correspondingTranslations.length}`);
    console.log(`   Traduzioni che rimarrebbero: ${allFactoryTranslationsCount - correspondingTranslations.length}`);

    // ✅ Verifica che non ci siano task tipo 3 con embedding/traduzioni mancanti
    const tasksWithoutEmbeddings = type3Tasks.filter(task => {
      const taskId = task.id || task._id?.toString();
      return !correspondingEmbeddings.some(emb => emb.id === taskId);
    });
    const tasksWithoutTranslations = type3Tasks.filter(task => {
      const taskId = task.id || task._id?.toString();
      return !correspondingTranslations.some(trans => trans.guid === taskId);
    });

    if (tasksWithoutEmbeddings.length > 0) {
      console.log(`\n⚠️  ${tasksWithoutEmbeddings.length} task tipo 3 NON hanno embedding corrispondenti`);
    }
    if (tasksWithoutTranslations.length > 0) {
      console.log(`⚠️  ${tasksWithoutTranslations.length} task tipo 3 NON hanno traduzioni corrispondenti`);
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ DRY RUN COMPLETATO - Nessuna cancellazione eseguita');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\nPer eseguire la cancellazione reale, usa:');
    console.log('  node backend/scripts/cleanType3Direct.js');

  } catch (error) {
    console.error('❌ ERRORE:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✅ Connessione chiusa');
  }
}

dryRunCleanType3().catch(error => {
  console.error('❌ ERRORE FATALE:', error);
  process.exit(1);
});
