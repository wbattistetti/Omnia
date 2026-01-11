/**
 * Migration: Convert canBeInEscalation → allowedContexts
 *
 * Questo script converte tutti i task da canBeInEscalation: boolean a allowedContexts: string[]
 *
 * Logica:
 * - canBeInEscalation: true → allowedContexts: ['escalation']
 * - canBeInEscalation: false → allowedContexts: []
 * - Se mancante → allowedContexts: [] (default safe)
 *
 * Esegui con: node backend/migrations/migrate_to_allowed_contexts.js
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function migrateToAllowedContexts() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(dbFactory);
    const coll = db.collection('Tasks');

    // Conta task totali
    const totalTasks = await coll.countDocuments({});
    console.log(`📊 Total tasks in database: ${totalTasks}`);

    // Trova task con canBeInEscalation: true
    const tasksWithTrue = await coll.find({ canBeInEscalation: true }).toArray();
    console.log(`📊 Tasks with canBeInEscalation: true: ${tasksWithTrue.length}`);

    // Trova task con canBeInEscalation: false
    const tasksWithFalse = await coll.find({ canBeInEscalation: false }).toArray();
    console.log(`📊 Tasks with canBeInEscalation: false: ${tasksWithFalse.length}`);

    // Trova task senza canBeInEscalation
    const tasksWithout = await coll.find({ canBeInEscalation: { $exists: false } }).toArray();
    console.log(`📊 Tasks without canBeInEscalation: ${tasksWithout.length}`);

    // Migra task con canBeInEscalation: true → allowedContexts: ['escalation']
    if (tasksWithTrue.length > 0) {
      const resultTrue = await coll.updateMany(
        { canBeInEscalation: true },
        {
          $set: { allowedContexts: ['escalation'] },
          $unset: { canBeInEscalation: '' }
        }
      );
      console.log(`✅ Migrated ${resultTrue.modifiedCount} tasks: canBeInEscalation: true → allowedContexts: ['escalation']`);
    }

    // Migra task con canBeInEscalation: false → allowedContexts: []
    if (tasksWithFalse.length > 0) {
      const resultFalse = await coll.updateMany(
        { canBeInEscalation: false },
        {
          $set: { allowedContexts: [] },
          $unset: { canBeInEscalation: '' }
        }
      );
      console.log(`✅ Migrated ${resultFalse.modifiedCount} tasks: canBeInEscalation: false → allowedContexts: []`);
    }

    // Migra task senza canBeInEscalation → allowedContexts: [] (default safe)
    if (tasksWithout.length > 0) {
      const resultWithout = await coll.updateMany(
        { canBeInEscalation: { $exists: false } },
        { $set: { allowedContexts: [] } }
      );
      console.log(`✅ Migrated ${resultWithout.modifiedCount} tasks: no canBeInEscalation → allowedContexts: [] (default)`);
    }

    // Verifica risultati finali
    const withEscalation = await coll.countDocuments({ allowedContexts: { $in: ['escalation'] } });
    const withEmpty = await coll.countDocuments({ allowedContexts: { $size: 0 } });
    const stillWithCanBeInEscalation = await coll.countDocuments({ canBeInEscalation: { $exists: true } });

    console.log('\n📊 Final status:');
    console.log(`   - allowedContexts includes 'escalation' → ${withEscalation} tasks`);
    console.log(`   - allowedContexts is empty → ${withEmpty} tasks`);
    console.log(`   - Still has canBeInEscalation → ${stillWithCanBeInEscalation} tasks`);

    if (stillWithCanBeInEscalation > 0) {
      console.log('\n⚠️  Warning: Some tasks still have canBeInEscalation property');
      console.log('   These should be manually reviewed');
    }

    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  } finally {
    await client.close();
    console.log('✅ Connection closed');
  }
}

// Esegui migrazione
migrateToAllowedContexts()
  .then(() => {
    console.log('\n🎉 Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration script failed:', error);
    process.exit(1);
  });
