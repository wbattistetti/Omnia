/**
 * Script: Verifica se ci sono ancora task di tipo 3 e embeddings nel database Factory
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function verifyType3Cleanup() {
  const client = new MongoClient(uri);

  try {
    console.log('🔄 Connessione a MongoDB...');
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const factoryDb = client.db(dbFactory);
    const tasksCollection = factoryDb.collection('tasks');
    const embeddingsCollection = factoryDb.collection('embeddings');

    // 1. Verifica task di tipo 3
    console.log('🔍 Verifica task di tipo 3...');
    const type3Tasks = await tasksCollection.find({ type: 3 }).toArray();
    const type3Count = await tasksCollection.countDocuments({ type: 3 });

    console.log(`📋 Trovati ${type3Count} task di tipo 3 (UtteranceInterpretation)`);

    if (type3Tasks.length > 0) {
      console.log('\n⚠️  Task di tipo 3 ancora presenti:');
      type3Tasks.slice(0, 10).forEach((task, index) => {
        const taskId = task.id || task._id?.toString();
        console.log(`  ${index + 1}. ID: ${taskId} - Label: "${task.label || 'N/A'}"`);
      });
      if (type3Tasks.length > 10) {
        console.log(`  ... e altri ${type3Tasks.length - 10} task`);
      }
    } else {
      console.log('✅ Nessun task di tipo 3 trovato nel database');
    }

    // 2. Estrai ID dei task di tipo 3 (se presenti)
    const taskIds = type3Tasks.map(task => task.id || task._id?.toString()).filter(Boolean);

    // 3. Verifica embeddings associati ai task di tipo 3
    console.log('\n🔍 Verifica embeddings associati ai task di tipo 3...');
    let correspondingEmbeddings = [];
    if (taskIds.length > 0) {
      correspondingEmbeddings = await embeddingsCollection.find({
        id: { $in: taskIds },
        type: 'task'
      }).toArray();
    }
    const correspondingEmbeddingsCount = correspondingEmbeddings.length;

    console.log(`📋 Trovati ${correspondingEmbeddingsCount} embedding associati ai task di tipo 3`);

    if (correspondingEmbeddings.length > 0) {
      console.log('\n⚠️  Embeddings ancora presenti:');
      correspondingEmbeddings.slice(0, 10).forEach((emb, index) => {
        console.log(`  ${index + 1}. ID: ${emb.id} - Type: ${emb.type}`);
      });
      if (correspondingEmbeddings.length > 10) {
        console.log(`  ... e altri ${correspondingEmbeddings.length - 10} embedding`);
      }
    } else {
      console.log('✅ Nessun embedding associato ai task di tipo 3');
    }

    // 4. Verifica tutti gli embedding di tipo 'task' (potrebbero essere orfani)
    console.log('\n🔍 Verifica tutti gli embedding di tipo "task"...');
    const allTaskEmbeddings = await embeddingsCollection.find({ type: 'task' }).toArray();
    const allTaskEmbeddingsCount = await embeddingsCollection.countDocuments({ type: 'task' });

    console.log(`📋 Trovati ${allTaskEmbeddingsCount} embedding di tipo "task" nel database`);

    if (allTaskEmbeddingsCount > correspondingEmbeddingsCount) {
      const orphanCount = allTaskEmbeddingsCount - correspondingEmbeddingsCount;
      console.log(`⚠️  Attenzione: ${orphanCount} embedding di tipo "task" potrebbero essere orfani (non associati a task di tipo 3)`);
    }

    // 5. Report finale
    console.log('\n📊 REPORT FINALE:');
    console.log('─'.repeat(50));
    if (type3Count === 0 && correspondingEmbeddingsCount === 0) {
      console.log('✅ PULIZIA COMPLETA:');
      console.log('   - Nessun task di tipo 3 nel database');
      console.log('   - Nessun embedding associato ai task di tipo 3');
      if (allTaskEmbeddingsCount > 0) {
        console.log(`   ⚠️  Nota: ${allTaskEmbeddingsCount} embedding di tipo "task" presenti, ma non associati a task di tipo 3`);
      }
    } else {
      console.log('❌ PULIZIA INCOMPLETA:');
      if (type3Count > 0) {
        console.log(`   - ${type3Count} task di tipo 3 ancora presenti`);
      }
      if (correspondingEmbeddingsCount > 0) {
        console.log(`   - ${correspondingEmbeddingsCount} embedding associati ai task di tipo 3 ancora presenti`);
      }
      console.log('\n   Per completare la pulizia, esegui:');
      console.log('   node backend/scripts/cleanAllType3TasksAndEmbeddings.js --confirm');
    }
    console.log('─'.repeat(50));

  } catch (error) {
    console.error('❌ ERRORE:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✅ Connessione chiusa');
  }
}

verifyType3Cleanup().catch(error => {
  console.error('❌ ERRORE FATALE:', error);
  process.exit(1);
});
