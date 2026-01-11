/**
 * Check if there are DataRequest tasks for "Number" and "POD/PDR code"
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function checkNumberTasks() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(dbFactory);
    const coll = db.collection('Tasks');

    // Check for DataRequest tasks with "number" in label
    const numberTasks = await coll.find({
      type: 3,
      label: { $regex: /number/i }
    }).toArray();

    console.log(`📊 DataRequest tasks with "number" in label: ${numberTasks.length}`);
    numberTasks.forEach((task, idx) => {
      console.log(`   ${idx + 1}. ${task.label} (id: ${task.id || task._id})`);
      if (task.mainData && Array.isArray(task.mainData) && task.mainData.length > 0) {
        console.log(`      mainData[0].kind: ${task.mainData[0]?.kind || 'N/A'}`);
      }
    });

    // Check for DataRequest tasks with "pod" or "pdr" in label
    const podTasks = await coll.find({
      type: 3,
      label: { $regex: /pod|pdr/i }
    }).toArray();

    console.log(`\n📊 DataRequest tasks with "pod/pdr" in label: ${podTasks.length}`);
    podTasks.forEach((task, idx) => {
      console.log(`   ${idx + 1}. ${task.label} (id: ${task.id || task._id})`);
      if (task.mainData && Array.isArray(task.mainData) && task.mainData.length > 0) {
        console.log(`      mainData[0].kind: ${task.mainData[0]?.kind || 'N/A'}`);
      }
    });

    // Check the specific SayMessage tasks
    console.log('\n📊 Checking SayMessage tasks to delete/fix:');
    const sayMessageTasks = await coll.find({
      type: 0,
      id: { $in: ['4b290857-abb1-431f-ac7c-2cdd21311360', '0424b974-c573-4891-aaa5-12a0158ce6f6'] }
    }).toArray();

    sayMessageTasks.forEach((task, idx) => {
      console.log(`   ${idx + 1}. ${task.label} (id: ${task.id || task._id})`);
      console.log(`      Type: ${task.type} (SayMessage)`);
      console.log(`      Has mainData: ${task.mainData ? 'Yes' : 'No'}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

checkNumberTasks()
  .then(() => {
    console.log('\n🎉 Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Check failed:', error);
    process.exit(1);
  });
