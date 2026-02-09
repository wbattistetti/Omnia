/**
 * Verifica: Controlla se ci sono task con type: 3 (DataRequest) che hanno canBeInEscalation: true
 *
 * Esegui con: node backend/migrations/verify_can_be_in_escalation.js
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function verifyCanBeInEscalation() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(dbFactory);
    const coll = db.collection('Tasks');

    // Trova task con type: 3 che hanno canBeInEscalation: true (ERRORE!)
    const dataRequestWithTrue = await coll.find({
      type: 3,
      canBeInEscalation: true
    }).toArray();

    if (dataRequestWithTrue.length > 0) {
      console.log(`\n❌ ERRORE: Trovati ${dataRequestWithTrue.length} task DataRequest (type: 3) con canBeInEscalation: true`);
      console.log('   Questi task NON dovrebbero essere in escalation!');
      dataRequestWithTrue.forEach((task, idx) => {
        console.log(`   ${idx + 1}. ID: ${task.id || task._id}, Label: ${task.label || 'N/A'}, Type: ${task.type}`);
      });
    } else {
      console.log('\n✅ Nessun task DataRequest (type: 3) con canBeInEscalation: true trovato');
    }

    // Trova task con canBeInEscalation: true e type: 3
    const allWithTrue = await coll.find({ canBeInEscalation: true }).toArray();
    console.log(`\n📊 Task con canBeInEscalation: true: ${allWithTrue.length}`);
    console.log('   Breakdown per type:');
    const typeCount = {};
    allWithTrue.forEach(task => {
      const type = task.type;
      typeCount[type] = (typeCount[type] || 0) + 1;
    });
    Object.entries(typeCount).sort((a, b) => a[0] - b[0]).forEach(([type, count]) => {
      console.log(`   - type: ${type} → ${count} task`);
    });

    // Trova task senza canBeInEscalation
    const without = await coll.find({ canBeInEscalation: { $exists: false } }).toArray();
    if (without.length > 0) {
      console.log(`\n⚠️  Trovati ${without.length} task senza canBeInEscalation:`);
      without.slice(0, 10).forEach((task, idx) => {
        console.log(`   ${idx + 1}. ID: ${task.id || task._id}, Label: ${task.label || 'N/A'}, Type: ${task.type || 'undefined'}`);
      });
      if (without.length > 10) {
        console.log(`   ... e altri ${without.length - 10} task`);
      }
    } else {
      console.log('\n✅ Tutti i task hanno canBeInEscalation definito');
    }

    // Verifica query per taskType=Action
    const actionQuery = { canBeInEscalation: true };
    const actionResults = await coll.find(actionQuery).toArray();
    console.log(`\n📊 Query canBeInEscalation: true restituisce ${actionResults.length} task`);

    const actionTypeCount = {};
    actionResults.forEach(task => {
      const type = task.type;
      actionTypeCount[type] = (actionTypeCount[type] || 0) + 1;
    });
    console.log('   Breakdown per type:');
    Object.entries(actionTypeCount).sort((a, b) => a[0] - b[0]).forEach(([type, count]) => {
      const typeName = {
        0: 'SayMessage',
        1: 'CloseSession',
        2: 'Transfer',
        3: 'DataRequest',
        4: 'BackendCall',
        5: 'ClassifyProblem',
        6: 'SendSMS',
        7: 'SendEmail',
        8: 'EscalateToHuman',
        9: 'EscalateToGuardVR',
        10: 'ReadFromBackend',
        11: 'WriteToBackend',
        12: 'LogData',
        13: 'LogLabel',
        14: 'PlayJingle',
        15: 'Jump',
        16: 'HangUp',
        17: 'Assign',
        18: 'Clear',
        19: 'WaitForAgent'
      }[type] || 'Unknown';
      console.log(`   - type: ${type} (${typeName}) → ${count} task`);
    });

  } catch (error) {
    console.error('❌ Error during verification:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

verifyCanBeInEscalation()
  .then(() => {
    console.log('\n🎉 Verification completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Verification failed:', error);
    process.exit(1);
  });
