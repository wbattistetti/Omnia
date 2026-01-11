/**
 * Check specific tasks to verify their type and structure
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

const tasksToCheck = [
  { id: 'bc2678c3-7157-45c9-8d5d-26ce6790ea11', label: 'Internal' },
  { id: 'b61542e3-5670-4b91-abbc-f654ff57998e', label: 'Website URL' },
  { id: '0d43d2c9-079c-46f5-a450-d187f006e8d2', label: 'Text field' },
  { id: 'da6f5fc7-010d-4c3f-a24d-b5c84e072754', label: 'Message' },
  { id: 'aa96dab7-2b9a-4845-bda3-51571163a198', label: 'Question' },
  { id: '4b290857-abb1-431f-ac7c-2cdd21311360', label: 'Number (to verify)' },
  { id: '0424b974-c573-4891-aaa5-12a0158ce6f6', label: 'POD/PDR code (to verify)' },
];

async function checkSpecificTasks() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(dbFactory);
    const coll = db.collection('Tasks');

    for (const taskInfo of tasksToCheck) {
      const task = await coll.findOne({ id: taskInfo.id });

      if (!task) {
        console.log(`❌ Task not found: ${taskInfo.label} (${taskInfo.id})`);
        continue;
      }

      const typeName = getTypeName(task.type);
      console.log(`📋 ${taskInfo.label}`);
      console.log(`   ID: ${task.id || task._id}`);
      console.log(`   Type: ${task.type} (${typeName})`);
      console.log(`   Label: ${task.label || 'N/A'}`);
      console.log(`   allowedContexts: ${JSON.stringify(task.allowedContexts || [])}`);
      console.log(`   Has mainData: ${task.mainData ? 'Yes' : 'No'}`);
      if (task.mainData) {
        console.log(`   mainData length: ${Array.isArray(task.mainData) ? task.mainData.length : 'N/A'}`);
        if (Array.isArray(task.mainData) && task.mainData.length > 0) {
          console.log(`   First mainData kind: ${task.mainData[0]?.kind || 'N/A'}`);
        }
      }
      console.log(`   Has templateId: ${task.templateId ? task.templateId : 'No'}`);
      console.log(`   Description: ${task.description || 'N/A'}`);
      console.log('');
    }

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

checkSpecificTasks()
  .then(() => {
    console.log('\n🎉 Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Check failed:', error);
    process.exit(1);
  });
