/**
 * Check for SayMessage (type: 0) tasks that should be in escalation
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function checkSayMessageTasks() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(dbFactory);
    const coll = db.collection('Tasks');

    // Check all SayMessage tasks (type: 0)
    const allSayMessage = await coll.find({ type: 0 }).toArray();
    console.log(`📊 Total SayMessage tasks (type: 0): ${allSayMessage.length}\n`);

    allSayMessage.forEach((task, idx) => {
      console.log(`${idx + 1}. ${task.label || task.id || 'N/A'}`);
      console.log(`   ID: ${task.id || task._id}`);
      console.log(`   allowedContexts: ${JSON.stringify(task.allowedContexts || [])}`);
      console.log(`   Has mainData: ${task.mainData ? 'Yes' : 'No'}`);
      console.log('');
    });

    // Check for SayMessage with escalation context
    const sayMessageInEscalation = await coll.find({
      type: 0,
      allowedContexts: { $in: ['escalation'] }
    }).toArray();

    console.log(`\n📊 SayMessage tasks with allowedContexts: ['escalation']: ${sayMessageInEscalation.length}`);
    if (sayMessageInEscalation.length === 0) {
      console.log('   ⚠️  No SayMessage tasks found for escalation!');
    }

    // Check for "sayMessage" template (common ID)
    const sayMessageTemplate = await coll.findOne({
      $or: [
        { id: 'sayMessage' },
        { _id: 'sayMessage' },
        { label: { $regex: /^say\s*message$/i } },
        { label: { $regex: /^message$/i } },
        { label: { $regex: /^prompt$/i } }
      ]
    });

    if (sayMessageTemplate) {
      console.log('\n📋 Found potential SayMessage template:');
      console.log(`   ID: ${sayMessageTemplate.id || sayMessageTemplate._id}`);
      console.log(`   Label: ${sayMessageTemplate.label || 'N/A'}`);
      console.log(`   Type: ${sayMessageTemplate.type} (${getTypeName(sayMessageTemplate.type)})`);
      console.log(`   allowedContexts: ${JSON.stringify(sayMessageTemplate.allowedContexts || [])}`);
    } else {
      console.log('\n⚠️  No SayMessage template found with common IDs/labels');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
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

checkSayMessageTasks()
  .then(() => {
    console.log('\n🎉 Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Check failed:', error);
    process.exit(1);
  });
