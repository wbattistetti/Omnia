/**
 * Check which tasks have allowedContexts: ['escalation'] and their types
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function checkEscalationTasks() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(dbFactory);
    const coll = db.collection('Tasks');
    
    // Find all tasks with allowedContexts that includes 'escalation'
    const escalationTasks = await coll.find({ allowedContexts: { $in: ['escalation'] } }).toArray();
    
    console.log(`\n📊 Tasks with allowedContexts: ['escalation']: ${escalationTasks.length}\n`);
    
    // Group by type
    const byType = {};
    escalationTasks.forEach(task => {
      const type = task.type;
      if (!byType[type]) {
        byType[type] = [];
      }
      byType[type].push(task);
    });
    
    // Print breakdown by type
    Object.keys(byType).sort().forEach(type => {
      const tasks = byType[type];
      const typeName = getTypeName(parseInt(type));
      console.log(`Type ${type} (${typeName}): ${tasks.length} tasks`);
      tasks.forEach((task, idx) => {
        console.log(`  ${idx + 1}. ${task.label || task.id || 'N/A'} (id: ${task.id || task._id})`);
      });
      console.log('');
    });
    
    // Check for DataRequest (type: 3) - these should NOT be in escalation
    const dataRequestTasks = escalationTasks.filter(t => t.type === 3);
    if (dataRequestTasks.length > 0) {
      console.error(`\n❌ ERRORE: Trovati ${dataRequestTasks.length} task DataRequest (type: 3) con allowedContexts: ['escalation']:`);
      dataRequestTasks.forEach((task, idx) => {
        console.error(`  ${idx + 1}. ${task.label || task.id || 'N/A'} (id: ${task.id || task._id})`);
      });
    } else {
      console.log('\n✅ Nessun task DataRequest (type: 3) con allowedContexts: ["escalation"] trovato');
    }
    
    // Simulate backend query
    console.log('\n📊 Simulating backend query: { allowedContexts: { $in: ["escalation"] } }');
    const queryResult = await coll.find({ allowedContexts: { $in: ['escalation'] } }).toArray();
    console.log(`   Result: ${queryResult.length} tasks\n`);
    
  } catch (error) {
    console.error('❌ Error:', error);
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

checkEscalationTasks()
  .then(() => {
    console.log('\n🎉 Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Check failed:', error);
    process.exit(1);
  });
