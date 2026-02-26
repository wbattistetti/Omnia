/**
 * Script completo: Cancella task tipo 3 + traduzioni orfane
 *
 * 1. Cancella tutti i task di tipo 3 e i loro embedding/traduzioni
 * 2. Trova tutte le traduzioni orfane (guid non corrispondenti a nessun task esistente)
 * 3. Cancella le traduzioni orfane
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function cleanType3AndOrphanTranslations() {
  const client = new MongoClient(uri);

  try {
    console.log('🔄 Connessione a MongoDB...');
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const factoryDb = client.db(dbFactory);
    const tasksCollection = factoryDb.collection('tasks');
    const embeddingsCollection = factoryDb.collection('embeddings');
    const translationsCollection = factoryDb.collection('Translations');

    // ============================================================================
    // PARTE 1: Cancella task di tipo 3
    // ============================================================================
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('PARTE 1: Cancellazione task di tipo 3');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // 1. Trova tutti i task con type === 3
    console.log('🔍 Ricerca task di tipo 3...');
    const type3Tasks = await tasksCollection.find({ type: 3 }).toArray();
    console.log(`📋 Trovati ${type3Tasks.length} task di tipo 3\n`);

    let type3TaskIds = [];
    let deletedType3Tasks = 0;
    let deletedType3Embeddings = 0;
    let deletedType3Translations = 0;

    if (type3Tasks.length > 0) {
      // 2. Estrai ID dei task
      type3TaskIds = type3Tasks.map(task => task.id || task._id?.toString()).filter(Boolean);
      console.log(`📝 Task ID di tipo 3 da cancellare: ${type3TaskIds.length}`);

      // 3. Trova embedding corrispondenti
      const correspondingEmbeddings = await embeddingsCollection.find({
        id: { $in: type3TaskIds },
        type: 'task'
      }).toArray();
      console.log(`📋 Trovati ${correspondingEmbeddings.length} embedding corrispondenti`);

      // 4. Trova traduzioni corrispondenti
      const correspondingTranslations = await translationsCollection.find({
        guid: { $in: type3TaskIds },
        $or: [
          { projectId: null },
          { projectId: { $exists: false } }
        ]
      }).toArray();
      console.log(`📋 Trovate ${correspondingTranslations.length} traduzioni corrispondenti\n`);

      // 5. Verifica con --confirm flag
      const args = process.argv.slice(2);
      const confirmFlag = args.includes('--confirm');

      if (!confirmFlag) {
        console.log('⚠️  DRY RUN - Nessuna cancellazione verrà eseguita.');
        console.log('   Per eseguire la cancellazione, aggiungi --confirm:\n');
        console.log('   node backend/scripts/cleanType3AndOrphans.js --confirm\n');
      } else {
        // 6. Cancella i task
        console.log('🗑️  Cancellazione task di tipo 3...');
        const deleteTasksResult = await tasksCollection.deleteMany({ type: 3 });
        deletedType3Tasks = deleteTasksResult.deletedCount;
        console.log(`✅ Cancellati ${deletedType3Tasks} task di tipo 3`);

        // 7. Cancella gli embedding
        if (correspondingEmbeddings.length > 0) {
          console.log('🗑️  Cancellazione embedding...');
          const deleteEmbeddingsResult = await embeddingsCollection.deleteMany({
            id: { $in: type3TaskIds },
            type: 'task'
          });
          deletedType3Embeddings = deleteEmbeddingsResult.deletedCount;
          console.log(`✅ Cancellati ${deletedType3Embeddings} embedding`);
        }

        // 8. Cancella le traduzioni
        if (correspondingTranslations.length > 0) {
          console.log('🗑️  Cancellazione traduzioni di tipo 3...');
          const deleteTranslationsResult = await translationsCollection.deleteMany({
            guid: { $in: type3TaskIds },
            $or: [
              { projectId: null },
              { projectId: { $exists: false } }
            ]
          });
          deletedType3Translations = deleteTranslationsResult.deletedCount;
          console.log(`✅ Cancellate ${deletedType3Translations} traduzioni di tipo 3`);
        }
      }
    } else {
      console.log('✅ Nessun task di tipo 3 da cancellare.\n');
    }

    // ============================================================================
    // PARTE 2: Trova e cancella traduzioni orfane
    // ============================================================================
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('PARTE 2: Cancellazione traduzioni orfane');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // 1. Trova TUTTI i task esistenti (tutti i tipi)
    console.log('🔍 Ricerca tutti i task esistenti...');
    const allTasks = await tasksCollection.find({}).toArray();
    console.log(`📋 Trovati ${allTasks.length} task totali nel database`);

    // 2. Estrai TUTTI gli ID dei task esistenti
    const allValidTaskIds = new Set(
      allTasks
        .map(task => task.id || task._id?.toString())
        .filter(Boolean)
    );
    console.log(`📝 Task ID validi totali: ${allValidTaskIds.size}`);
    console.log(`   Esempi: ${Array.from(allValidTaskIds).slice(0, 5).join(', ')}${allValidTaskIds.size > 5 ? '...' : ''}\n`);

    // 3. Trova tutte le traduzioni template (projectId: null o non esiste)
    console.log('🔍 Ricerca traduzioni template (projectId: null)...');
    const allTemplateTranslations = await translationsCollection.find({
      $or: [
        { projectId: null },
        { projectId: { $exists: false } }
      ]
    }).toArray();
    console.log(`📋 Trovate ${allTemplateTranslations.length} traduzioni template totali\n`);

    // 4. Identifica traduzioni orfane (guid NON corrisponde a nessun task esistente)
    const orphanTranslations = allTemplateTranslations.filter(
      trans => !allValidTaskIds.has(trans.guid)
    );
    console.log(`📊 Traduzioni orfane trovate: ${orphanTranslations.length}`);
    console.log(`   (GUID che non corrispondono a nessun task esistente)\n`);

    let deletedOrphanTranslations = 0;

    if (orphanTranslations.length === 0) {
      console.log('✅ Nessuna traduzione orfana trovata. Tutte le traduzioni sono collegate a task esistenti.\n');
    } else {
      // Mostra esempi di traduzioni orfane
      console.log('📋 Esempi di traduzioni orfane:');
      orphanTranslations.slice(0, 10).forEach((trans, idx) => {
        console.log(`   ${idx + 1}. GUID: ${trans.guid}, Language: ${trans.language || 'N/A'}, Text: ${(trans.text || '').substring(0, 50)}...`);
      });
      if (orphanTranslations.length > 10) {
        console.log(`   ... e altre ${orphanTranslations.length - 10} traduzioni orfane\n`);
      } else {
        console.log('');
      }

      // 5. Verifica con --confirm flag
      const args = process.argv.slice(2);
      const confirmFlag = args.includes('--confirm');

      if (!confirmFlag) {
        console.log('⚠️  DRY RUN - Nessuna traduzione orfana verrà cancellata.');
        console.log('   Per eseguire la cancellazione, aggiungi --confirm:\n');
        console.log('   node backend/scripts/cleanType3AndOrphans.js --confirm\n');
      } else {
        // 6. Estrai GUID delle traduzioni orfane
        const orphanGuids = orphanTranslations.map(trans => trans.guid).filter(Boolean);
        console.log(`📝 GUID orfani da cancellare: ${orphanGuids.length}`);

        // 7. Cancella traduzioni orfane
        console.log('🗑️  Cancellazione traduzioni orfane...');
        const deleteOrphansResult = await translationsCollection.deleteMany({
          guid: { $in: orphanGuids },
          $or: [
            { projectId: null },
            { projectId: { $exists: false } }
          ]
        });
        deletedOrphanTranslations = deleteOrphansResult.deletedCount;
        console.log(`✅ Cancellate ${deletedOrphanTranslations} traduzioni orfane\n`);
      }
    }

    // ============================================================================
    // PARTE 3: Report finale
    // ============================================================================
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('REPORT FINALE');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const args = process.argv.slice(2);
    const confirmFlag = args.includes('--confirm');

    if (confirmFlag) {
      console.log('📊 Statistiche cancellazione:');
      console.log(`   Task tipo 3 cancellati: ${deletedType3Tasks}`);
      console.log(`   Embedding tipo 3 cancellati: ${deletedType3Embeddings}`);
      console.log(`   Traduzioni tipo 3 cancellate: ${deletedType3Translations}`);
      console.log(`   Traduzioni orfane cancellate: ${deletedOrphanTranslations}\n`);

      // Verifica finale
      const remainingType3Tasks = await tasksCollection.countDocuments({ type: 3 });
      const remainingTemplateTranslations = await translationsCollection.countDocuments({
        $or: [
          { projectId: null },
          { projectId: { $exists: false } }
        ]
      });

      // Verifica traduzioni ancora orfane
      const allTasksAfter = await tasksCollection.find({}).toArray();
      const allValidTaskIdsAfter = new Set(
        allTasksAfter
          .map(task => task.id || task._id?.toString())
          .filter(Boolean)
      );
      const remainingTemplateTranslationsAfter = await translationsCollection.find({
        $or: [
          { projectId: null },
          { projectId: { $exists: false } }
        ]
      }).toArray();
      const stillOrphan = remainingTemplateTranslationsAfter.filter(
        trans => !allValidTaskIdsAfter.has(trans.guid)
      ).length;

      console.log('📊 Verifica finale:');
      console.log(`   Task tipo 3 rimasti: ${remainingType3Tasks}`);
      console.log(`   Traduzioni template rimaste: ${remainingTemplateTranslations}`);
      console.log(`   Traduzioni ancora orfane: ${stillOrphan}`);

      if (remainingType3Tasks === 0 && stillOrphan === 0) {
        console.log('\n✅ Pulizia completata con successo!');
        console.log('   Tutti i task di tipo 3 e le traduzioni orfane sono state rimosse.');
      } else {
        console.log('\n⚠️  Pulizia parziale:');
        if (remainingType3Tasks > 0) {
          console.log(`   - Rimangono ${remainingType3Tasks} task di tipo 3`);
        }
        if (stillOrphan > 0) {
          console.log(`   - Rimangono ${stillOrphan} traduzioni orfane`);
        }
      }
    } else {
      console.log('📊 Statistiche (DRY RUN):');
      console.log(`   Task tipo 3 da cancellare: ${type3Tasks.length}`);
      console.log(`   Traduzioni orfane da cancellare: ${orphanTranslations.length}`);
      console.log('\n⚠️  Per eseguire la cancellazione, esegui:');
      console.log('   node backend/scripts/cleanType3AndOrphans.js --confirm\n');
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

// Esegui script
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: node backend/scripts/cleanType3AndOrphans.js [--confirm]');
  console.log('');
  console.log('Questo script:');
  console.log('  1. Cancella tutti i task di tipo 3 e i loro embedding/traduzioni');
  console.log('  2. Trova e cancella tutte le traduzioni orfane (guid non collegati a task esistenti)');
  console.log('');
  console.log('Options:');
  console.log('  --confirm    Esegue la cancellazione (senza questo flag è solo dry-run)');
  console.log('  --help, -h   Mostra questo messaggio');
  process.exit(0);
}

cleanType3AndOrphanTranslations().catch(error => {
  console.error('❌ ERRORE FATALE:', error);
  process.exit(1);
});
