/**
 * Verification: Check allowedContexts property in Tasks
 *
 * Questo script verifica la proprietà allowedContexts nei task nel database:
 * - Controlla se ci sono task DataRequest (type: 3) con allowedContexts che include 'escalation' (ERRORE)
 * - Mostra un breakdown dei task con allowedContexts per type
 * - Verifica che tutti i task abbiano la proprietà allowedContexts definita
 *
 * Esegui con: node backend/migrations/verify_allowed_contexts.js
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function verifyAllowedContexts() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(dbFactory);
    const coll = db.collection('Tasks');

    // 1. Controlla se ci sono task DataRequest (type: 3) con allowedContexts che include 'escalation'
    const dataRequestWithEscalation = await coll.find({
      type: 3,
      allowedContexts: { $in: ['escalation'] }
    }).toArray();

    if (dataRequestWithEscalation.length > 0) {
      console.error(`❌ ERRORE: Trovati ${dataRequestWithEscalation.length} task DataRequest (type: 3) con allowedContexts che include 'escalation'`);
      dataRequestWithEscalation.forEach((task, idx) => {
        console.error(`   ${idx + 1}. ID: ${task.id || task._id}, Label: ${task.label || 'N/A'}, allowedContexts: ${JSON.stringify(task.allowedContexts)}`);
      });
    } else {
      console.log('✅ Nessun task DataRequest (type: 3) con allowedContexts che include \'escalation\' trovato');
    }

    // 2. Mostra un breakdown dei task con allowedContexts che include 'escalation' per type
    const tasksInEscalation = await coll.find({ allowedContexts: { $in: ['escalation'] } }).toArray();
    console.log(`\n📊 Task con allowedContexts che include 'escalation': ${tasksInEscalation.length}`);

    const typeBreakdown = tasksInEscalation.reduce((acc, task) => {
      acc[task.type] = (acc[task.type] || 0) + 1;
      return acc;
    }, {});

    console.log('   Breakdown per type:');
    for (const type in typeBreakdown) {
      console.log(`   - type: ${type} (${getTypeName(parseInt(type))}) → ${typeBreakdown[type]} task`);
    }

    // 3. Verifica che tutti i task abbiano la proprietà allowedContexts definita
    const tasksWithoutAllowedContexts = await coll.countDocuments({ allowedContexts: { $exists: false } });

    if (tasksWithoutAllowedContexts > 0) {
      console.error(`❌ ERRORE: Trovati ${tasksWithoutAllowedContexts} task senza la proprietà allowedContexts`);
    } else {
      console.log('✅ Tutti i task hanno allowedContexts definito');
    }

    // 4. Verifica che la query dell'endpoint restituisca i task corretti
    const queryResult = await coll.find({ allowedContexts: { $in: ['escalation'] } }).toArray();
    console.log(`\n📊 Query allowedContexts: { $in: ['escalation'] } restituisce ${queryResult.length} task`);

    const queryTypeBreakdown = queryResult.reduce((acc, task) => {
      acc[task.type] = (acc[task.type] || 0) + 1;
      return acc;
    }, {});

    console.log('   Breakdown per type:');
    for (const type in queryTypeBreakdown) {
      console.log(`   - type: ${type} (${getTypeName(parseInt(type))}) → ${queryTypeBreakdown[type]} task`);
    }

    // 5. Mostra esempi di allowedContexts
    const sampleTasks = await coll.find({ allowedContexts: { $exists: true, $ne: [] } }).limit(5).toArray();
    console.log('\n📊 Esempi di task con allowedContexts:');
    sampleTasks.forEach((task, idx) => {
      console.log(`   ${idx + 1}. ID: ${task.id || task._id}, Label: ${task.label || 'N/A'}, allowedContexts: ${JSON.stringify(task.allowedContexts)}`);
    });

    console.log('\n✅ Verification completed successfully!');

  } catch (error) {
    console.error('❌ Error during verification:', error);
    throw error;
  } finally {
    await client.close();
    console.log('✅ Connection closed');
  }
}

function getTypeName(type) {
  switch (type) {
    case 0: return 'SayMessage';
    case 1: return 'CloseSession';
    case 2: return 'Transfer';
    case 3: return 'DataRequest';
    case 4: return 'BackendCall';
    case 5: return 'ClassifyProblem';
    case 6: return 'SendSMS';
    case 7: return 'SendEmail';
    case 8: return 'EscalateToHuman';
    case 9: return 'EscalateToGuardVR';
    case 10: return 'ReadFromBackend';
    case 11: return 'WriteToBackend';
    case 12: return 'LogData';
    case 13: return 'LogLabel';
    case 14: return 'PlayJingle';
    case 15: return 'Jump';
    case 16: return 'HangUp';
    case 17: return 'Assign';
    case 18: return 'Clear';
    case 19: return 'WaitForAgent';
    default: return 'UNKNOWN';
  }
}

// Esegui verifica
verifyAllowedContexts()
  .then(() => {
    console.log('\n🎉 Verification script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Verification script failed:', error);
    process.exit(1);
  });
