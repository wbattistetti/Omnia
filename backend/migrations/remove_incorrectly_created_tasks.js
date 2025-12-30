/**
 * Script: Rimuove task creati per errore
 *
 * Rimuove i task creati dallo script distribute_factory_types_to_tasks.js
 * che non dovevano essere creati automaticamente
 *
 * Esegui con: node backend/migrations/remove_incorrectly_created_tasks.js
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

// Task creati per errore (da rimuovere)
const TASKS_TO_REMOVE = ['email', 'dateOfBirth', 'phone'];

async function remove() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');
    console.log('='.repeat(80));
    console.log('🗑️  RIMOZIONE TASK CREATI PER ERRORE');
    console.log('='.repeat(80));
    console.log();

    const db = client.db(dbFactory);

    for (const taskId of TASKS_TO_REMOVE) {
      const result = await db.collection('Tasks').deleteOne({
        $or: [
          { id: taskId },
          { name: taskId },
          { label: { $regex: new RegExp(`^${taskId}$`, 'i') } }
        ]
      });

      if (result.deletedCount > 0) {
        console.log(`   ✅ Rimosso task: ${taskId}`);
      } else {
        console.log(`   ⚠️  Task non trovato: ${taskId}`);
      }
    }

    console.log('\n✅ Rimozione completata');
  } catch (error) {
    console.error('❌ Errore:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connessione chiusa');
  }
}

if (require.main === module) {
  remove().catch(console.error);
}

module.exports = { remove };

