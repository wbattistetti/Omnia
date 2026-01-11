/**
 * Fix suspicious SayMessage (type: 0) tasks that look like DataRequest
 * These tasks should have allowedContexts: [] instead of ['escalation']
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

// Labels that suggest a task is DataRequest, not a SayMessage for escalation
const suspiciousLabels = [
  'number',
  'text field',
  'internal',
  'pod/pdr code',
  'website url',
  'message', // Generic message, not a specific action
  'question' // Generic question, not a specific action
];

async function fixSuspiciousSayMessageTasks() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(dbFactory);
    const coll = db.collection('Tasks');
    
    // Find SayMessage (type: 0) tasks with allowedContexts: ['escalation']
    const sayMessageTasks = await coll.find({
      type: 0,
      allowedContexts: { $in: ['escalation'] }
    }).toArray();
    
    console.log(`\n📊 Found ${sayMessageTasks.length} SayMessage tasks with allowedContexts: ['escalation']\n`);
    
    // Filter suspicious ones
    const suspiciousTasks = sayMessageTasks.filter(task => {
      const labelLower = (task.label || '').toLowerCase();
      return suspiciousLabels.some(suspicious => labelLower.includes(suspicious));
    });
    
    console.log(`📊 Suspicious SayMessage tasks found: ${suspiciousTasks.length}\n`);
    
    if (suspiciousTasks.length > 0) {
      suspiciousTasks.forEach((task, idx) => {
        console.log(`${idx + 1}. ${task.label || task.id || 'N/A'} (id: ${task.id || task._id})`);
      });
      
      // Update them to remove 'escalation' from allowedContexts
      const taskIds = suspiciousTasks.map(t => t.id || t._id);
      const result = await coll.updateMany(
        { 
          type: 0,
          allowedContexts: { $in: ['escalation'] },
          $or: suspiciousLabels.map(label => ({
            label: { $regex: new RegExp(label, 'i') }
          }))
        },
        { 
          $set: { allowedContexts: [] } // Remove escalation context
        }
      );
      
      console.log(`\n✅ Updated ${result.modifiedCount} suspicious SayMessage tasks`);
      console.log(`   Changed allowedContexts from ['escalation'] to []\n`);
    } else {
      console.log('✅ No suspicious SayMessage tasks found\n');
    }
    
    // Verify results
    const remainingSayMessage = await coll.find({
      type: 0,
      allowedContexts: { $in: ['escalation'] }
    }).toArray();
    
    console.log(`📊 Remaining SayMessage tasks with allowedContexts: ['escalation']: ${remainingSayMessage.length}`);
    if (remainingSayMessage.length > 0) {
      console.log('   These are legitimate SayMessage tasks for escalation:');
      remainingSayMessage.forEach((task, idx) => {
        console.log(`   ${idx + 1}. ${task.label || task.id || 'N/A'}`);
      });
    }
    
    console.log('\n✅ Fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during fix:', error);
    throw error;
  } finally {
    await client.close();
    console.log('✅ Connection closed');
  }
}

// Esegui fix
fixSuspiciousSayMessageTasks()
  .then(() => {
    console.log('\n🎉 Fix script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fix script failed:', error);
    process.exit(1);
  });
