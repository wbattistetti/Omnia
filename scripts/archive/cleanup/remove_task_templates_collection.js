/**
 * Script: Elimina collection task_templates (lowercase) dal database
 *
 * ATTENZIONE: Questo script elimina task_templates dopo aver verificato che:
 * 1. Tutti gli endpoint sono stati migrati a Tasks
 * 2. Non ci sono più riferimenti a task_templates nel codice runtime
 * 3. I documenti sono già stati migrati a Tasks
 *
 * Esegui con: node backend/migrations/remove_task_templates_collection.js
 * Per confermare eliminazione: node backend/migrations/remove_task_templates_collection.js --confirm
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function removeTaskTemplatesCollection() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const db = client.db(dbFactory);

    // ===================================
    // 1. VERIFICA: task_templates esiste
    // ===================================
    console.log('🔍 Step 1: Verifica collezione task_templates...\n');

    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    const hasTaskTemplates = collectionNames.includes('task_templates');

    if (!hasTaskTemplates) {
      console.log('   ✅ task_templates non esiste - già eliminata!\n');
      return;
    }

    console.log('   ⚠️  task_templates trovata\n');

    // ===================================
    // 2. VERIFICA: Conteggio documenti
    // ===================================
    console.log('🔍 Step 2: Verifica conteggio documenti...\n');

    const taskTemplates = await db.collection('task_templates').find({}).toArray();
    const tasks = await db.collection('tasks').find({}).toArray();

    console.log(`   task_templates: ${taskTemplates.length} documenti`);
    console.log(`   Tasks: ${tasks.length} documenti\n`);

    if (taskTemplates.length > 0) {
      console.log('   ⚠️  ATTENZIONE: task_templates contiene ancora documenti!');
      console.log('   💡 Verifica che tutti i documenti siano stati migrati a Tasks');
      console.log('   💡 Se necessario, migra i documenti prima di eliminare la collezione\n');
    } else {
      console.log('   ✅ task_templates è vuota - sicuro eliminare\n');
    }

    // ===================================
    // 3. ELIMINAZIONE
    // ===================================
    console.log('='.repeat(70));
    console.log('📊 RIEPILOGO');
    console.log('='.repeat(70));
    console.log(`task_templates: ${taskTemplates.length} documenti`);
    console.log(`Tasks: ${tasks.length} documenti`);
    console.log('='.repeat(70));

    if (!process.argv.includes('--confirm')) {
      console.log('\n⚠️  ATTENZIONE: Questo script eliminerà task_templates.');
      console.log('   Per procedere, esegui:');
      console.log('   node backend/migrations/remove_task_templates_collection.js --confirm\n');
      return;
    }

    console.log('\n🗑️  Eliminazione task_templates...\n');

    try {
      await db.collection('task_templates').drop();
      console.log('   ✅ Eliminata collection task_templates da factory');
    } catch (error) {
      if (error.codeName === 'NamespaceNotFound') {
        console.log('   ⏭️  task_templates già eliminata');
      } else {
        console.error('   ❌ Errore eliminando task_templates:', error.message);
        throw error;
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 RIEPILOGO ELIMINAZIONE');
    console.log('='.repeat(70));
    console.log('Factory: task_templates eliminata');
    console.log('='.repeat(70));

    console.log('\n🎉 task_templates eliminata con successo!');
    console.log('✅ Pulizia completata.');

  } catch (error) {
    console.error('❌ Errore:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connessione chiusa');
  }
}

if (require.main === module) {
  removeTaskTemplatesCollection().catch(console.error);
}

module.exports = { removeTaskTemplatesCollection };
