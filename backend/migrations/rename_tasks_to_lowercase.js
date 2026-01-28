/**
 * Script: Rinomina collezione Tasks → tasks (lowercase) nel database factory
 *
 * ATTENZIONE: Questo script rinomina la collezione Tasks in tasks per standardizzare
 * il naming convention (tutte le collezioni in minuscola).
 *
 * Esegui con: node backend/migrations/rename_tasks_to_lowercase.js
 * Per confermare: node backend/migrations/rename_tasks_to_lowercase.js --confirm
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function renameTasksToLowercase() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const db = client.db(dbFactory);

    // ===================================
    // 1. VERIFICA: Tasks esiste
    // ===================================
    console.log('🔍 Step 1: Verifica collezione Tasks...\n');

    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    const hasTasks = collectionNames.includes('Tasks');
    const hasTasksLower = collectionNames.includes('tasks');

    if (!hasTasks) {
      if (hasTasksLower) {
        console.log('   ✅ tasks (lowercase) già esiste - migrazione già completata!\n');
        return;
      } else {
        console.log('   ⚠️  Tasks non esiste - nessuna collezione da rinominare\n');
        return;
      }
    }

    console.log('   ⚠️  Tasks trovata\n');

    // ===================================
    // 2. VERIFICA: Conteggio documenti
    // ===================================
    console.log('🔍 Step 2: Verifica conteggio documenti...\n');

    const tasksCount = await db.collection('Tasks').countDocuments();
    console.log(`   Tasks: ${tasksCount} documenti\n`);

    if (tasksCount === 0) {
      console.log('   ⚠️  Tasks è vuota - sicuro rinominare?\n');
    } else {
      console.log('   ✅ Tasks contiene documenti - procedere con rinomina\n');
    }

    // ===================================
    // 3. VERIFICA: tasks esiste già?
    // ===================================
    if (hasTasksLower) {
      console.log('   ⚠️  ATTENZIONE: tasks (lowercase) esiste già!');
      console.log('   💡 Verifica se devi unificare le collezioni prima di rinominare\n');
    }

    // ===================================
    // 4. RINOMINA
    // ===================================
    console.log('='.repeat(70));
    console.log('📊 RIEPILOGO');
    console.log('='.repeat(70));
    console.log(`Tasks: ${tasksCount} documenti`);
    console.log(`tasks esiste già: ${hasTasksLower}`);
    console.log('='.repeat(70));

    if (!process.argv.includes('--confirm')) {
      console.log('\n⚠️  ATTENZIONE: Questo script rinomina Tasks → tasks.');
      console.log('   Per procedere, esegui:');
      console.log('   node backend/migrations/rename_tasks_to_lowercase.js --confirm\n');
      return;
    }

    console.log('\n🔄 Rinomina Tasks → tasks...\n');

    try {
      // MongoDB renameCollection
      await db.collection('Tasks').rename('tasks');
      console.log('   ✅ Rinomina Tasks → tasks completata');
    } catch (error) {
      if (error.codeName === 'NamespaceNotFound') {
        console.log('   ⏭️  Tasks già rinominata o non esiste');
      } else if (error.codeName === 'NamespaceExists') {
        console.error('   ❌ Errore: tasks esiste già!');
        console.error('   💡 Unifica le collezioni manualmente prima di rinominare');
        throw error;
      } else {
        console.error('   ❌ Errore durante la rinomina:', error.message);
        throw error;
      }
    }

    // ===================================
    // 5. VERIFICA: Rinomina completata
    // ===================================
    console.log('\n🔍 Step 5: Verifica rinomina...\n');

    const collectionsAfter = await db.listCollections().toArray();
    const collectionNamesAfter = collectionsAfter.map(c => c.name);
    const hasTasksAfter = collectionNamesAfter.includes('Tasks');
    const hasTasksLowerAfter = collectionNamesAfter.includes('tasks');

    if (!hasTasksAfter && hasTasksLowerAfter) {
      const tasksCountAfter = await db.collection('tasks').countDocuments();
      console.log(`   ✅ Rinomina completata: tasks contiene ${tasksCountAfter} documenti`);
      if (tasksCountAfter !== tasksCount) {
        console.warn(`   ⚠️  Conteggio diverso: prima=${tasksCount}, dopo=${tasksCountAfter}`);
      }
    } else {
      console.error('   ❌ Rinomina non completata correttamente');
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 RIEPILOGO MIGRAZIONE');
    console.log('='.repeat(70));
    console.log('Factory: Tasks → tasks');
    console.log('='.repeat(70));

    console.log('\n🎉 Migrazione completata con successo!');
    console.log('✅ Collezione unificata a tasks (lowercase).');

  } catch (error) {
    console.error('❌ Errore:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connessione chiusa');
  }
}

if (require.main === module) {
  renameTasksToLowercase().catch(console.error);
}

module.exports = { renameTasksToLowercase };
