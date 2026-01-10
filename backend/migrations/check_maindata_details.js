/**
 * Verifica dettagli dei task con mainData ma senza steps
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function checkMainDataDetails() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(dbFactory);
    const collection = db.collection('Tasks');

    // Find tasks with mainData
    const query = {
      mainData: { $exists: true, $ne: null }
    };

    const tasks = await collection.find(query).toArray();
    console.log(`📋 Found ${tasks.length} tasks with mainData\n`);

    for (const task of tasks) {
      console.log('='.repeat(70));
      console.log(`Task ID: ${task.id || task._id}`);
      console.log(`Label: ${task.label || 'N/A'}`);
      console.log(`Type: ${task.type || 'N/A'}`);
      console.log(`TemplateId: ${task.templateId || 'null'}`);
      console.log(`Has dialogueSteps: ${task.dialogueSteps ? 'YES' : 'NO'}`);

      if (task.mainData && Array.isArray(task.mainData)) {
        console.log(`\nmainData array length: ${task.mainData.length}`);

        for (let i = 0; i < task.mainData.length; i++) {
          const main = task.mainData[i];
          console.log(`\n  mainData[${i}]:`);
          console.log(`    id: ${main.id || 'N/A'}`);
          console.log(`    label: ${main.label || 'N/A'}`);
          console.log(`    has steps: ${main.steps ? 'YES' : 'NO'}`);
          console.log(`    has subData: ${main.subData ? 'YES' : 'NO'}`);

          if (main.steps) {
            const stepsType = Array.isArray(main.steps) ? 'array' : typeof main.steps;
            console.log(`    steps type: ${stepsType}`);
            if (Array.isArray(main.steps)) {
              console.log(`    steps count: ${main.steps.length}`);
            } else if (typeof main.steps === 'object') {
              console.log(`    steps keys: ${Object.keys(main.steps).join(', ')}`);
            }
          }

          if (main.subData && Array.isArray(main.subData)) {
            console.log(`    subData count: ${main.subData.length}`);
            for (let j = 0; j < main.subData.length; j++) {
              const sub = main.subData[j];
              console.log(`      subData[${j}]:`);
              console.log(`        id: ${sub.id || 'N/A'}`);
              console.log(`        label: ${sub.label || 'N/A'}`);
              console.log(`        has steps: ${sub.steps ? 'YES' : 'NO'}`);
            }
          }
        }
      }

      console.log('\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('✅ Connection closed');
  }
}

if (require.main === module) {
  checkMainDataDetails().catch(console.error);
}

module.exports = { checkMainDataDetails };

