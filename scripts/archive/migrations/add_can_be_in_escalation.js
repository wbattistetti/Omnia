/**
 * Migration: Add canBeInEscalation property to Tasks
 *
 * Questo script aggiunge la proprietà canBeInEscalation ai task nel database:
 * - canBeInEscalation: true per task che possono essere inseriti in escalation
 *   (type: 0, 1, 2, 4, 6-19)
 * - canBeInEscalation: false per task che NON possono essere in escalation
 *   (type: 3, 5, -1)
 *
 * Esegui con: node backend/migrations/add_can_be_in_escalation.js
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

// Task types che possono essere in escalation
const ESCALATION_TYPES = [
  0,  // SayMessage
  1,  // CloseSession
  2,  // Transfer
  4,  // BackendCall
  6,  // SendSMS
  7,  // SendEmail
  8,  // EscalateToHuman
  9,  // EscalateToGuardVR
  10, // ReadFromBackend
  11, // WriteToBackend
  12, // LogData
  13, // LogLabel
  14, // PlayJingle
  15, // Jump
  16, // HangUp
  17, // Assign
  18, // Clear
  19  // WaitForAgent
];

async function addCanBeInEscalation() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(dbFactory);
    const coll = db.collection('Tasks');

    // Conta task totali
    const totalTasks = await coll.countDocuments({});
    console.log(`📊 Total tasks in database: ${totalTasks}`);

    // Aggiorna task che possono essere in escalation
    const escalationResult = await coll.updateMany(
      { type: { $in: ESCALATION_TYPES } },
      { $set: { canBeInEscalation: true } }
    );
    console.log(`✅ Updated ${escalationResult.modifiedCount} tasks with canBeInEscalation: true`);
    console.log(`   (types: ${ESCALATION_TYPES.join(', ')})`);

    // Aggiorna task che NON possono essere in escalation
    const nonEscalationResult = await coll.updateMany(
      {
        type: { $nin: ESCALATION_TYPES },
        canBeInEscalation: { $exists: false } // Solo se non esiste già
      },
      { $set: { canBeInEscalation: false } }
    );
    console.log(`✅ Updated ${nonEscalationResult.modifiedCount} tasks with canBeInEscalation: false`);

    // Verifica risultati
    const withTrue = await coll.countDocuments({ canBeInEscalation: true });
    const withFalse = await coll.countDocuments({ canBeInEscalation: false });
    const without = await coll.countDocuments({ canBeInEscalation: { $exists: false } });

    console.log('\n📊 Final status:');
    console.log(`   - canBeInEscalation: true  → ${withTrue} tasks`);
    console.log(`   - canBeInEscalation: false → ${withFalse} tasks`);
    console.log(`   - canBeInEscalation: missing → ${without} tasks`);

    if (without > 0) {
      console.log('\n⚠️  Warning: Some tasks still don\'t have canBeInEscalation property');
      console.log('   These might be tasks with type: null or undefined');
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
addCanBeInEscalation()
  .then(() => {
    console.log('\n🎉 Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration script failed:', error);
    process.exit(1);
  });
